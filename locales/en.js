// locales/en.js - English strings (the default locale, and the fallback for
// any key missing from another locale).
//
// Values are either strings or functions of a params object. Keep the
// WhatsApp formatting (*bold*) and emoji in the translation, since both are
// part of how the message reads.
export default {
  welcome: "👋 Welcome to TrophyBot!\nReply *browse* to see our trophies.",

  greeting:
    "👋 Hello! Welcome to TrophyBot! 🏆\n\nI can help you:\n• Browse our trophy collection\n• Place custom orders\n• Track your deliveries\n\nType *browse* to see our trophies or *help* for more options!",

  help: "🆘 Here's how to use TrophyBot:\n\n📋 *Commands:*\n• *browse* - See available trophies\n• *history* - Your recent orders\n• *reorder 1* - Order a past one again\n• *status* - Check your current order\n• *cancel* - Cancel an unpaid order\n• *language* - Change language\n• *reset* - Start over\n• *help* - Show this menu\n\n🛒 *Order Process:*\n1. Browse trophies\n2. Select by number\n3. Add customization (text, or send a *photo*)\n4. Checkout & pay\n5. Track delivery",

  catalogHeader: "🏆 *Available Trophies:*\n\n",
  catalogFooter:
    "\n💡 *How to order:*\n• Reply with the *number* to select a trophy\n• Add your customization text\n• Proceed to checkout\n\n🛒 Ready to start? Just reply with a number!",
  catalogEmpty: "⚠️ No trophies found in catalog.",

  trophyAdded: ({ name }) =>
    `✅ *${name}* added to cart! 🛒\n\n🖊 *Customization:*\nPlease enter the text you want engraved on this trophy.\n\n💡 *Examples:*\n• "Best Employee 2024"\n• "Championship Winner"\n• "Outstanding Performance"\n\nJust reply with your customization text!`,
  invalidChoice: "⚠️ Invalid choice. Try again.",

  customizationAdded: ({ text, photoNote }) =>
    `✅ *Customization added!* ✨\n\n📝 *Your customization:* "${text}"${photoNote}\n\n🛒 *Ready to checkout?*\nReply *checkout* to proceed with your order!`,
  // Two wordings on purpose: "received" acknowledges the upload at the
  // customization step; "attached" confirms it on the final order summary.
  photoReceived: "\n🖼 *Reference image received*",
  photoAttached: "\n🖼 *Reference image attached*",
  photoHint: "\n💡 You can also send a *photo* as a design reference.",

  orderSummary: ({ items, customization, total, eta, photoLine }) =>
    `🛒 *Order Summary:*\n\n📦 *Items:*\n${items}\n\n📝 *Customization:* "${customization}"${photoLine}\n\n💰 *Total Amount: ₹${total}*\n🚚 *Estimated delivery:* ${eta}\n\n💳 *Ready to pay?*\nReply *pay* to confirm your order!\n\n_Reply *cancel* to cancel this order._`,

  orderConfirmed:
    "🎉 *Order Confirmed!* ✅\n\n📄 *Invoice attached*\n🚚 *Delivery tracking will start soon*\n\nThank you for choosing TrophyBot! 🏆",
  invoiceFailed: "⚠️ Could not generate invoice.",

  orderStatus: ({ id, total, status, date, items }) =>
    `📦 Your Order Status:\n\n🆔 Order ID: ${id}\n💰 Total: ₹${total}\n📊 Status: ${status}\n📅 Date: ${date}\n\nItems: ${items}`,
  noActiveOrders: "❓ No active orders found. Type *browse* to start shopping!",

  historyHeader: "📚 *Your recent orders:*\n\n",
  historyFooter: "🔁 Reply *reorder 1* (or another number) to order the same again.",
  historyEmpty: "📭 No past orders yet. Reply *browse* to place your first one!",

  reordering: ({ items, customization, total }) =>
    `🔁 *Reordering:*\n\n📦 ${items}\n📝 *Customization:* "${customization}"\n💰 *Total: ₹${total}*\n\nReply *checkout* to confirm, or *reset* to start over.`,
  reorderNotFound: "⚠️ No such order. Reply *history* to see your recent orders.",

  cancelled: "🚫 Order cancelled. Reply *browse* to start a new one.",
  cancelNothing: "❓ Nothing to cancel. Reply *browse* to start an order.",
  cancelAlreadyPaid: ({ id }) =>
    `⚠️ Order *${id}* is already paid and can't be cancelled here.\nPlease contact us directly for help.`,
  customizationCancelled: "🔄 Cancelled. Reply *browse* to start again.",

  reset: "🔄 Session reset! Reply *browse* to see our trophies.",

  languagePrompt:
    "🌐 *Choose your language:*\n\n1. English\n2. हिन्दी (Hindi)\n\nReply with the number.",
  languageSet: "✅ Language set to English.",

  fallbackWelcome:
    "❓ I didn't understand that. Try:\n• *browse* - See trophies\n• *help* - Show commands\n• *hi* - Get started",
  fallbackBrowse: "❓ Please reply with a *number* to select a trophy, or *help* for options.",
  fallbackCheckout: "❓ Reply *checkout* to proceed with your order.",
  fallbackPayment: "❓ Reply *pay* to confirm your order.",
  fallbackGeneric:
    "❓ Please reply *browse* to see products, *reset* to start over, or *help* for options.",
};
