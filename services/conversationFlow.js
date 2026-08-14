// services/conversationFlow.js - The order conversation state machine.
//
// This is the single source of truth for the flow that used to be copy-pasted
// across bot.js, services/messageHandler.js, and bot-handler.js. Keeping three
// copies is how the production path ended up missing working invoice delivery
// and delivery tracking (fixed in v1.1.0) — a fix applied to one copy simply
// never reached the others.
//
// It deliberately does NOT send anything. It returns a list of actions for the
// caller to execute with whatever transport it has (Cloud API, whatsapp-web.js),
// which keeps the branching logic pure and unit-testable.
//
// Customer-facing text lives in locales/ (see services/i18n.js); this file
// holds only control flow. Command keywords stay English — they're what the
// customer types, and the parser only recognises the English forms.
//
// The session object is mutated in place; persisting it is the caller's job
// (see services/sessionStore.js).
import { translator, parseLanguageCommand, parseLanguageChoice, normalizeLocale } from "./i18n.js";

/** Action kinds returned to the transport adapter. */
export const ACTIONS = {
  TEXT: "text",
  DOCUMENT: "document",
  DELIVERY_TRACKING: "delivery-tracking",
  NOTIFY_ADMIN: "notify-admin",
  SET_LOCALE: "set-locale",
};

// \b throughout: without it "hi" matches "history", "start" matches "started",
// and those commands become unreachable.
const GREETING_RE =
  /^(hi|hello|hey|hii|hiii|good morning|good afternoon|good evening|namaste|namaskar)\b/;
const HELP_RE = /^(help|menu|start|begin|commands?)\b/;
// \b matters: without it "my orders" would match the "my order" alternative
// here and never reach HISTORY_RE below.
const STATUS_RE = /^(status|order|my order|track)\b/;
const HISTORY_RE = /^(history|past orders?|my orders)\b/;
const REORDER_RE = /^reorder\s*(\d+)/;

const STATUS_ICONS = { pending: "🕒", paid: "✅", cancelled: "🚫" };

/** Working-day estimate shown at checkout, before payment. */
const DELIVERY_DAYS = Number(process.env.DELIVERY_ESTIMATE_DAYS || 5);

function deliveryEstimate(days = DELIVERY_DAYS) {
  const eta = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return eta.toDateString();
}

/**
 * Advance the conversation by one message.
 *
 * @param {object}  args
 * @param {string}  args.text     - Cleaned, lowercased message text (mentions stripped)
 * @param {string}  args.rawText  - Original message text (used verbatim for customization)
 * @param {object}  args.session  - Session state, mutated in place
 * @param {boolean} args.isGroup  - Whether this is a group conversation
 * @param {string}  args.mention  - Display handle for group replies (e.g. "919999999999")
 * @param {object}  args.deps     - { Trophy, Order, generateInvoice, useLetterhead, letterheadPath, adminNumber }
 * @returns {Promise<Array<object>>} actions for the caller to execute, in order
 */
export async function runConversation({
  text,
  rawText,
  session,
  isGroup = false,
  mention = "",
  deps,
}) {
  const { Trophy, Order, generateInvoice, useLetterhead, letterheadPath, adminNumber } = deps;

  const actions = [];
  // In groups every reply is @-prefixed so users can tell whose order is whose.
  const at = isGroup ? `@${mention} ` : "";
  const say = (body) => actions.push({ type: ACTIONS.TEXT, body: at + body });

  const locale = normalizeLocale(session.locale);
  const _ = translator(locale);

  // --- Intent shortcuts: these answer immediately without advancing the flow ---
  //
  // Suppressed while awaiting customization text, otherwise a customer cannot
  // engrave "Hello 2026" or "Team Status Award" — the greeting/status branch
  // would swallow it and leave them stuck. `cancel` and `reset` still work as
  // escape hatches from that step (handled below).
  const awaitingCustomization = session.step === "customization";

  // --- Language selection ---
  // Checked before everything else so a customer can always change language,
  // and answered before the greeting branch can claim "hindi"/"english".
  if (session.awaitingLanguage) {
    const picked = parseLanguageChoice(text);
    if (picked) {
      session.locale = picked;
      session.awaitingLanguage = false;
      actions.push({ type: ACTIONS.SET_LOCALE, locale: picked });
      say(translator(picked)("languageSet"));
      return actions;
    }
    say(_("languagePrompt"));
    return actions;
  }

  if (!awaitingCustomization) {
    const langRequest = parseLanguageCommand(text);
    if (langRequest === "prompt") {
      session.awaitingLanguage = true;
      say(_("languagePrompt"));
      return actions;
    }
    if (langRequest) {
      session.locale = langRequest;
      actions.push({ type: ACTIONS.SET_LOCALE, locale: langRequest });
      say(translator(langRequest)("languageSet"));
      return actions;
    }
  }

  if (!awaitingCustomization && GREETING_RE.test(text)) {
    say(_("greeting"));
    return actions;
  }

  if (!awaitingCustomization && HELP_RE.test(text)) {
    say(_("help"));
    return actions;
  }

  if (!awaitingCustomization && STATUS_RE.test(text)) {
    if (session.orderId) {
      const order = await Order.findById(session.orderId);
      if (order) {
        say(
          _("orderStatus", {
            id: order._id,
            total: order.total,
            status: order.status,
            date: order.createdAt.toDateString(),
            items: order.items.map((i) => i.name).join(", "),
          })
        );
        return actions;
      }
    }
    say(_("noActiveOrders"));
    return actions;
  }

  // --- Order history ---
  if (!awaitingCustomization && HISTORY_RE.test(text)) {
    const past = await Order.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .limit(5);

    if (!past.length) {
      say(_("historyEmpty"));
      return actions;
    }

    let response = _("historyHeader");
    past.forEach((o, i) => {
      const items = o.items.map((it) => it.name).join(", ");
      response += `${i + 1}. ${STATUS_ICONS[o.status] || ""} *${o.status}* — ₹${o.total}\n   ${items}\n   ${o.createdAt.toDateString()}\n\n`;
    });
    response += _("historyFooter");
    say(response);
    return actions;
  }

  // --- Reorder: copy a past order's items into a fresh cart ---
  const reorderMatch = awaitingCustomization ? null : text.match(REORDER_RE);
  if (reorderMatch) {
    const past = await Order.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .limit(5);
    const chosen = past[parseInt(reorderMatch[1], 10) - 1];

    if (!chosen) {
      say(_("reorderNotFound"));
      return actions;
    }

    session.cart = chosen.items.map((it) => ({ ...it }));
    session.customization = chosen.customization || "";
    session.pendingImage = null;
    session.step = "checkout";

    const total = session.cart.reduce((sum, item) => sum + item.price, 0);
    say(
      _("reordering", {
        items: session.cart.map((i) => `• ${i.name} - ₹${i.price}`).join("\n"),
        customization: session.customization,
        total,
      })
    );
    return actions;
  }

  // --- Cancel an unpaid order ---
  if (!awaitingCustomization && text === "cancel") {
    if (!session.orderId) {
      say(_("cancelNothing"));
      return actions;
    }
    const order = await Order.findById(session.orderId);
    if (!order) {
      say(_("cancelNothing"));
      return actions;
    }
    if (order.status === "paid") {
      say(_("cancelAlreadyPaid", { id: order._id }));
      return actions;
    }

    order.status = "cancelled";
    await order.save();
    session.step = "welcome";
    session.cart = [];
    session.customization = "";
    session.orderId = null;
    session.pendingImage = null;
    say(_("cancelled"));
    return actions;
  }

  // Starting a new order after finishing one
  if (text === "browse" && session.step === "done") {
    session.step = "welcome";
    session.cart = [];
    session.customization = "";
  }

  // --- The state machine proper ---

  // welcome -> browse
  if (session.step === "welcome" && text.includes("browse")) {
    const trophies = await Trophy.find();
    if (trophies.length === 0) {
      say(_("catalogEmpty"));
      return actions;
    }

    let response = _("catalogHeader");
    trophies.forEach((t, i) => {
      response += `${i + 1}. ${t.name} - *₹${t.price}*\n`;
    });
    response += _("catalogFooter");

    session.step = "browse";
    say(response);
    return actions;
  }

  // browse -> customization (numeric selection)
  if (session.step === "browse" && text !== "" && !isNaN(text)) {
    const index = parseInt(text, 10) - 1;
    const trophies = await Trophy.find();
    const trophy = trophies[index];

    if (!trophy) {
      say(_("invalidChoice"));
      return actions;
    }

    // Store a plain object — the cart round-trips through MongoDB on save.
    session.cart.push(typeof trophy.toObject === "function" ? trophy.toObject() : trophy);
    session.step = "customization";
    say(_("trophyAdded", { name: trophy.name }));
    return actions;
  }

  // customization -> checkout (free text captured verbatim)
  if (session.step === "customization") {
    // Escape hatch: the intent shortcuts are suppressed in this step, so
    // these are the only way out short of finishing the customization.
    if (text === "cancel" || text === "reset") {
      session.step = "welcome";
      session.cart = [];
      session.customization = "";
      session.pendingImage = null;
      say(_("customizationCancelled"));
      return actions;
    }

    session.customization = rawText;
    session.step = "checkout";

    say(
      _("customizationAdded", {
        text: rawText,
        photoNote: session.pendingImage ? _("photoReceived") : _("photoHint"),
      })
    );
    return actions;
  }

  // checkout -> payment (creates the Order)
  if (session.step === "checkout" && text.includes("checkout")) {
    const total = session.cart.reduce((sum, item) => sum + item.price, 0);
    const order = new Order({
      userId: session.userId,
      items: session.cart,
      total,
      customization: session.customization,
      status: "pending",
      groupId: session.groupId,
      // Carry across the reference photo the adapter downloaded, if any
      ...(session.pendingImage
        ? {
            referenceImage: {
              data: Buffer.from(session.pendingImage.data, "base64"),
              contentType: session.pendingImage.contentType,
              receivedAt: new Date(),
            },
          }
        : {}),
    });
    await order.save();

    session.orderId = order._id;
    session.step = "payment";
    session.pendingImage = null; // now persisted on the order

    say(
      _("orderSummary", {
        items: session.cart.map((item) => `• ${item.name} - ₹${item.price}`).join("\n"),
        customization: session.customization,
        total,
        eta: deliveryEstimate(),
        photoLine: order.referenceImage?.data ? _("photoAttached") : "",
      })
    );
    return actions;
  }

  // payment -> done (invoice, admin notice, delivery tracking)
  if (session.step === "payment" && text.includes("pay")) {
    const order = await Order.findById(session.orderId);
    order.status = "paid";
    await order.save();

    const caption = at + _("orderConfirmed");

    try {
      const invoicePath = await generateInvoice(order, useLetterhead, letterheadPath);
      actions.push({
        type: ACTIONS.DOCUMENT,
        path: invoicePath,
        filename: `Invoice_${order._id}.pdf`,
        caption,
      });
    } catch (err) {
      console.error("❌ Invoice generation failed:", err);
      say(_("invoiceFailed"));
    }

    if (adminNumber) {
      // Admin messages stay in English — the operator is a fixed, known person
      actions.push({
        type: ACTIONS.NOTIFY_ADMIN,
        body: `📢 New Order Paid!\nID: ${order._id}\nTotal: ₹${order.total}${
          session.groupId ? `\nGroup: ${session.groupId}` : ""
        }\nCustomer: ${session.userId}`,
      });
    }

    // Tracking starts regardless of invoice outcome — the order is paid, so the
    // customer should get status updates either way.
    actions.push({
      type: ACTIONS.DELIVERY_TRACKING,
      prefix: at,
      orderId: String(order._id),
    });

    session.step = "done";
    return actions;
  }

  // Reset
  if (text === "reset" || text === "start" || text === "menu") {
    session.step = "welcome";
    session.cart = [];
    session.customization = "";
    say(_("reset"));
    return actions;
  }

  // Step-aware fallback
  // No "customization" entry: that step consumes any text as the engraving,
  // so it can never reach this fallback.
  const fallbackKeys = {
    welcome: "fallbackWelcome",
    browse: "fallbackBrowse",
    checkout: "fallbackCheckout",
    payment: "fallbackPayment",
  };
  say(_(fallbackKeys[session.step] || "fallbackGeneric"));
  return actions;
}
