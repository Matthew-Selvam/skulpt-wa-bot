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
// The session object is mutated in place; persisting it is the caller's job
// (see services/sessionStore.js).

/** Action kinds returned to the transport adapter. */
export const ACTIONS = {
  TEXT: "text",
  DOCUMENT: "document",
  DELIVERY_TRACKING: "delivery-tracking",
  NOTIFY_ADMIN: "notify-admin",
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
  const say = (body) => actions.push({ type: ACTIONS.TEXT, body });
  // In groups every reply is @-prefixed so users can tell whose order is whose.
  const at = isGroup ? `@${mention} ` : "";

  // --- Intent shortcuts: these answer immediately without advancing the flow ---
  //
  // Suppressed while awaiting customization text, otherwise a customer cannot
  // engrave "Hello 2026" or "Team Status Award" — the greeting/status branch
  // would swallow it and leave them stuck. `cancel` and `reset` still work as
  // escape hatches from that step (handled below).
  const awaitingCustomization = session.step === "customization";

  if (!awaitingCustomization && GREETING_RE.test(text)) {
    say(
      `👋 ${isGroup ? `Hello @${mention}!` : "Hello!"} Welcome to TrophyBot! 🏆\n\nI can help you:\n• Browse our trophy collection\n• Place custom orders\n• Track your deliveries\n\nType *browse* to see our trophies or *help* for more options!`
    );
    return actions;
  }

  if (!awaitingCustomization && HELP_RE.test(text)) {
    say(
      `🆘 ${at}Here's how to use TrophyBot:\n\n📋 *Commands:*\n• *browse* - See available trophies\n• *history* - Your recent orders\n• *reorder 1* - Order a past one again\n• *status* - Check your current order\n• *cancel* - Cancel an unpaid order\n• *reset* - Start over\n• *help* - Show this menu\n\n🛒 *Order Process:*\n1. Browse trophies\n2. Select by number\n3. Add customization (text, or send a *photo*)\n4. Checkout & pay\n5. Track delivery`
    );
    return actions;
  }

  if (!awaitingCustomization && STATUS_RE.test(text)) {
    if (session.orderId) {
      const order = await Order.findById(session.orderId);
      if (order) {
        say(
          `📦 ${at}Your Order Status:\n\n🆔 Order ID: ${order._id}\n💰 Total: ₹${order.total}\n📊 Status: ${order.status}\n📅 Date: ${order.createdAt.toDateString()}\n\nItems: ${order.items.map((i) => i.name).join(", ")}`
        );
        return actions;
      }
    }
    say(`❓ ${at}No active orders found. Type *browse* to start shopping!`);
    return actions;
  }

  // --- Order history ---
  if (!awaitingCustomization && HISTORY_RE.test(text)) {
    const past = await Order.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .limit(5);

    if (!past.length) {
      say(`📭 ${at}No past orders yet. Reply *browse* to place your first one!`);
      return actions;
    }

    let response = `📚 ${at}*Your recent orders:*\n\n`;
    past.forEach((o, i) => {
      const items = o.items.map((it) => it.name).join(", ");
      response += `${i + 1}. ${STATUS_ICONS[o.status] || ""} *${o.status}* — ₹${o.total}\n   ${items}\n   ${o.createdAt.toDateString()}\n\n`;
    });
    response += "🔁 Reply *reorder 1* (or another number) to order the same again.";
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
      say(`⚠️ ${at}No such order. Reply *history* to see your recent orders.`);
      return actions;
    }

    session.cart = chosen.items.map((it) => ({ ...it }));
    session.customization = chosen.customization || "";
    session.pendingImage = null;
    session.step = "checkout";

    const total = session.cart.reduce((sum, item) => sum + item.price, 0);
    say(
      `🔁 ${at}*Reordering:*\n\n📦 ${session.cart.map((i) => `• ${i.name} - ₹${i.price}`).join("\n")}\n📝 *Customization:* "${session.customization}"\n💰 *Total: ₹${total}*\n\nReply *checkout* to confirm, or *reset* to start over.`
    );
    return actions;
  }

  // --- Cancel an unpaid order ---
  if (!awaitingCustomization && text === "cancel") {
    if (!session.orderId) {
      say(`❓ ${at}Nothing to cancel. Reply *browse* to start an order.`);
      return actions;
    }
    const order = await Order.findById(session.orderId);
    if (!order) {
      say(`❓ ${at}Nothing to cancel. Reply *browse* to start an order.`);
      return actions;
    }
    if (order.status === "paid") {
      say(
        `⚠️ ${at}Order *${order._id}* is already paid and can't be cancelled here.\nPlease contact us directly for help.`
      );
      return actions;
    }

    order.status = "cancelled";
    await order.save();
    session.step = "welcome";
    session.cart = [];
    session.customization = "";
    session.orderId = null;
    session.pendingImage = null;
    say(`🚫 ${at}Order cancelled. Reply *browse* to start a new one.`);
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
      say(`⚠️ ${at}No trophies found in catalog.`);
      return actions;
    }

    let response = isGroup
      ? `🏆 *Available Trophies* @${mention}:\n\n`
      : "🏆 *Available Trophies:*\n\n";
    trophies.forEach((t, i) => {
      response += `${i + 1}. ${t.name} - *₹${t.price}*\n`;
    });
    response +=
      "\n💡 *How to order:*\n• Reply with the *number* to select a trophy\n• Add your customization text\n• Proceed to checkout\n\n🛒 Ready to start? Just reply with a number!";

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
      say(`⚠️ ${at}Invalid choice. Try again.`);
      return actions;
    }

    // Store a plain object — the cart round-trips through MongoDB on save.
    session.cart.push(typeof trophy.toObject === "function" ? trophy.toObject() : trophy);
    session.step = "customization";
    say(
      `✅ ${at}*${trophy.name}* added to cart! 🛒\n\n🖊 *Customization:*\nPlease enter the text you want engraved on this trophy.\n\n💡 *Examples:*\n• "Best Employee 2024"\n• "Championship Winner"\n• "Outstanding Performance"\n\nJust reply with your customization text!`
    );
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
      say(`🔄 ${at}Cancelled. Reply *browse* to start again.`);
      return actions;
    }

    session.customization = rawText;
    session.step = "checkout";

    const photoNote = session.pendingImage
      ? "\n🖼 *Reference image received*"
      : "\n💡 You can also send a *photo* as a design reference.";

    say(
      `✅ ${at}*Customization added!* ✨\n\n📝 *Your customization:* "${rawText}"${photoNote}\n\n🛒 *Ready to checkout?*\nReply *checkout* to proceed with your order!`
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

    const photoLine = order.referenceImage?.data ? "\n🖼 *Reference image attached*" : "";

    say(
      `🛒 ${at}*Order Summary:*\n\n📦 *Items:*\n${session.cart
        .map((item) => `• ${item.name} - ₹${item.price}`)
        .join("\n")}\n\n📝 *Customization:* "${session.customization}"${photoLine}\n\n💰 *Total Amount: ₹${total}*\n🚚 *Estimated delivery:* ${deliveryEstimate()}\n\n💳 *Ready to pay?*\nReply *pay* to confirm your order!\n\n_Reply *cancel* to cancel this order._`
    );
    return actions;
  }

  // payment -> done (invoice, admin notice, delivery tracking)
  if (session.step === "payment" && text.includes("pay")) {
    const order = await Order.findById(session.orderId);
    order.status = "paid";
    await order.save();

    const caption = `🎉 ${at}*Order Confirmed!* ✅\n\n📄 *Invoice attached*\n🚚 *Delivery tracking will start soon*\n\nThank you for choosing TrophyBot! 🏆`;

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
      say(`⚠️ ${at}Could not generate invoice.`);
    }

    if (adminNumber) {
      actions.push({
        type: ACTIONS.NOTIFY_ADMIN,
        body: `📢 New Order Paid!\nID: ${order._id}\nTotal: ₹${order.total}${
          session.groupId ? `\nGroup: ${session.groupId}` : ""
        }\nCustomer: ${session.userId}`,
      });
    }

    // Tracking starts regardless of invoice outcome — the order is paid, so the
    // customer should get status updates either way.
    actions.push({ type: ACTIONS.DELIVERY_TRACKING, prefix: at });

    session.step = "done";
    return actions;
  }

  // Reset
  if (text === "reset" || text === "start" || text === "menu") {
    session.step = "welcome";
    session.cart = [];
    session.customization = "";
    say(`🔄 ${at}Session reset! Reply *browse* to see our trophies.`);
    return actions;
  }

  // Step-aware fallback
  // No "customization" entry: that step consumes any text as the engraving,
  // so it can never reach this fallback.
  const fallbacks = {
    welcome: `❓ ${at}I didn't understand that. Try:\n• *browse* - See trophies\n• *help* - Show commands\n• *hi* - Get started`,
    browse: `❓ ${at}Please reply with a *number* to select a trophy, or *help* for options.`,
    checkout: `❓ ${at}Reply *checkout* to proceed with your order.`,
    payment: `❓ ${at}Reply *pay* to confirm your order.`,
  };
  say(
    fallbacks[session.step] ||
      `❓ ${at}Please reply *browse* to see products, *reset* to start over, or *help* for options.`
  );
  return actions;
}
