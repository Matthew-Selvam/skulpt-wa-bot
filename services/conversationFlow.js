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

const GREETING_RE =
  /^(hi|hello|hey|hii|hiii|good morning|good afternoon|good evening|namaste|namaskar)/;
const HELP_RE = /^(help|menu|start|begin|commands?)/;
const STATUS_RE = /^(status|order|my order|track)/;

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

  if (GREETING_RE.test(text)) {
    say(
      `👋 ${isGroup ? `Hello @${mention}!` : "Hello!"} Welcome to TrophyBot! 🏆\n\nI can help you:\n• Browse our trophy collection\n• Place custom orders\n• Track your deliveries\n\nType *browse* to see our trophies or *help* for more options!`
    );
    return actions;
  }

  if (HELP_RE.test(text)) {
    say(
      `🆘 ${at}Here's how to use TrophyBot:\n\n📋 *Commands:*\n• *browse* - See available trophies\n• *reset* - Start over\n• *status* - Check your order\n• *help* - Show this menu\n\n🛒 *Order Process:*\n1. Browse trophies\n2. Select by number\n3. Add customization\n4. Checkout & pay\n5. Track delivery`
    );
    return actions;
  }

  if (STATUS_RE.test(text)) {
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
    session.customization = rawText;
    session.step = "checkout";
    say(
      `✅ ${at}*Customization added!* ✨\n\n📝 *Your customization:* "${rawText}"\n\n🛒 *Ready to checkout?*\nReply *checkout* to proceed with your order!`
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
    });
    await order.save();

    session.orderId = order._id;
    session.step = "payment";

    say(
      `🛒 ${at}*Order Summary:*\n\n📦 *Items:*\n${session.cart
        .map((item) => `• ${item.name} - ₹${item.price}`)
        .join("\n")}\n\n📝 *Customization:* "${session.customization}"\n\n💰 *Total Amount: ₹${total}*\n\n💳 *Ready to pay?*\nReply *pay* to confirm your order!`
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
