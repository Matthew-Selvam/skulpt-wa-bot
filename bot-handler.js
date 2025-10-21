// bot-handler.js - WhatsApp Business API Message Handler
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import WhatsAppBusinessAPI from "./whatsapp-api-client.js";

dotenv.config();

// Initialize WhatsApp API client
const whatsappAPI = new WhatsAppBusinessAPI();

// -------------------- DB SETUP --------------------
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/trophybot")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const TrophySchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
});

const OrderSchema = new mongoose.Schema({
  userId: String,
  items: Array,
  total: Number,
  customization: String,
  status: String,
  orderRef: { type: String, unique: true, default: () => Date.now().toString() },
  groupId: String,
  createdAt: { type: Date, default: Date.now },
});

const Trophy = mongoose.model("Trophy", TrophySchema);
const Order = mongoose.model("Order", OrderSchema);

// -------------------- CONFIGURATION --------------------
const BOT_NUMBER = process.env.BOT_NUMBER || "918838975981";
const BOT_NAME = process.env.BOT_NAME || "Skulpt";
const USE_LETTERHEAD = process.env.USE_LETTERHEAD === "true" || false;
const LETTERHEAD_PATH = process.env.LETTERHEAD_PATH || "./letterhead_template.png";
const COMPANY_NAME = process.env.COMPANY_NAME || "THYNK UNLIMITED";
const COMPANY_TAGLINE = process.env.COMPANY_TAGLINE || "Creative Company";

// -------------------- SESSION MANAGEMENT --------------------
const sessions = new Map();

// -------------------- INVOICE GENERATOR --------------------
async function generateInvoice(order, useLetterhead = false, letterheadPath = null) {
  const filePath = path.join(process.cwd(), `invoice_${order._id}.pdf`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    if (useLetterhead && letterheadPath && fs.existsSync(letterheadPath)) {
      doc.image(letterheadPath, 0, 0, { width: 612, height: 792 });
      
      doc.fontSize(18).text("🏆 Trophy Order Invoice", 50, 200, { align: "center" });
      doc.moveDown(2);

      doc.fontSize(12).text(`Order ID: ${order._id}`, 50, 250);
      doc.text(`Date: ${order.createdAt.toDateString()}`, 50, 270);
      doc.text(`Customer: ${order.userId}`, 50, 290);
      doc.moveDown(2);

      let yPosition = 350;
      doc.text("Items:", 50, yPosition);
      yPosition += 20;
      
      order.items.forEach((item, index) => {
        doc.text(`${index + 1}. ${item.name}`, 70, yPosition);
        doc.text(`₹${item.price}`, 450, yPosition, { align: "right" });
        yPosition += 20;
      });

      if (order.customization) {
        doc.text(`Customization: ${order.customization}`, 50, yPosition + 10);
        yPosition += 30;
      }

      doc.fontSize(14).text(`Total: ₹${order.total}`, 450, yPosition + 20, { align: "right" });
    } else {
      doc.fontSize(20).text("🏆 Trophy Order Invoice", { align: "center" });
      doc.moveDown();

      doc.fontSize(12).text(`Order ID: ${order._id}`);
      doc.text(`Date: ${order.createdAt.toDateString()}`);
      doc.text(`Customer: ${order.userId}`);
      doc.moveDown();

      order.items.forEach((item, index) => {
        doc.text(`${index + 1}. ${item.name} - ₹${item.price}`);
      });

      if (order.customization) {
        doc.moveDown();
        doc.text(`Customization: ${order.customization}`);
      }

      doc.moveDown();
      doc.fontSize(14).text(`Total: ₹${order.total}`, { align: "right" });
    }

    doc.end();

    stream.on("finish", () => resolve(filePath));
    stream.on("error", (err) => reject(err));
  });
}

// -------------------- MESSAGE SENDER --------------------
async function sendMessage(to, message, mediaUrl = null) {
  try {
    console.log(`📤 Sending message to ${to}:`, message);
    
    if (mediaUrl) {
      console.log(`📎 Media URL: ${mediaUrl}`);
      // Send as document
      return await whatsappAPI.sendMediaMessage(to, mediaUrl, message, "document");
    } else {
      // Send as text message
      return await whatsappAPI.sendMessage(to, message);
    }
  } catch (error) {
    console.error("❌ Error sending message:", error);
    return { success: false, error: error.message };
  }
}

// -------------------- MESSAGE HANDLER --------------------
export async function botHandler(message, businessAccountId) {
  try {
    const from = message.from;
    const text = message.text?.body || "";
    const messageType = message.type;
    
    console.log(`📩 Processing message from ${from}: ${text}`);

    // Check if it's a group message
    const isGroup = from.includes('@g.us');
    const isGroupMention = isGroup && text.toLowerCase().includes(`@${BOT_NAME.toLowerCase()}`);
    const isBotNumberMention = isGroup && text.includes('@') && text.includes(BOT_NUMBER);
    const isReplyToBot = message.context?.replied_message_id; // This would need to be tracked

    // Skip if it's a group message without proper mention
    if (isGroup && !isGroupMention && !isBotNumberMention && !isReplyToBot) {
      return;
    }

    const userId = isGroup ? message.from : from;
    const sessionKey = isGroup ? `${from}_${userId}` : from;

    // Clean text for processing
    let cleanText = text.toLowerCase();
    if (isGroupMention) {
      cleanText = cleanText.replace(new RegExp(`@${BOT_NAME.toLowerCase()}\\s*`, 'gi'), '').trim();
    }
    if (isBotNumberMention) {
      cleanText = cleanText.replace(/@\d+\s*/g, '').trim();
    }

    // Initialize session if not exists
    if (!sessions.has(sessionKey)) {
      sessions.set(sessionKey, {
        step: "welcome",
        cart: [],
        customization: "",
        isGroup: isGroup,
        groupId: isGroup ? from : null,
        userId: userId
      });

      const welcomeMsg = isGroup
        ? `👋 Welcome to TrophyBot! @${userId.split('@')[0]}\nReply *browse* to see our trophies.`
        : "👋 Welcome to TrophyBot!\nReply *browse* to see our trophies.";
      
      await sendMessage(from, welcomeMsg);
      return;
    }

    const session = sessions.get(sessionKey);

    // Detect greetings and commands
    const isGreeting = /^(hi|hello|hey|hii|hiii|good morning|good afternoon|good evening|namaste|namaskar)/.test(cleanText);
    const isHelpRequest = /^(help|menu|start|begin|commands?)/.test(cleanText);
    const isStatusRequest = /^(status|order|my order|track)/.test(cleanText);

    // Handle greetings
    if (isGreeting) {
      const greetingMsg = isGroup
        ? `👋 Hello @${userId.split('@')[0]}! Welcome to TrophyBot! 🏆\n\nI can help you:\n• Browse our trophy collection\n• Place custom orders\n• Track your deliveries\n\nType *browse* to see our trophies or *help* for more options!`
        : "👋 Hello! Welcome to TrophyBot! 🏆\n\nI can help you:\n• Browse our trophy collection\n• Place custom orders\n• Track your deliveries\n\nType *browse* to see our trophies or *help* for more options!";
      await sendMessage(from, greetingMsg);
      return;
    }

    // Handle help requests
    if (isHelpRequest) {
      const helpMsg = isGroup
        ? `🆘 @${userId.split('@')[0]} Here's how to use TrophyBot:\n\n📋 **Commands:**\n• *browse* - See available trophies\n• *reset* - Start over\n• *status* - Check your order\n• *help* - Show this menu\n\n🛒 **Order Process:**\n1. Browse trophies\n2. Select by number\n3. Add customization\n4. Checkout & pay\n5. Track delivery\n\n💡 **Tip:** You can reply to my messages or use @skulpt commands!`
        : "🆘 Here's how to use TrophyBot:\n\n📋 **Commands:**\n• *browse* - See available trophies\n• *reset* - Start over\n• *status* - Check your order\n• *help* - Show this menu\n\n🛒 **Order Process:**\n1. Browse trophies\n2. Select by number\n3. Add customization\n4. Checkout & pay\n5. Track delivery";
      await sendMessage(from, helpMsg);
      return;
    }

    // Handle status requests
    if (isStatusRequest) {
      if (session.orderId) {
        const order = await Order.findById(session.orderId);
        if (order) {
          const statusMsg = isGroup
            ? `📦 @${userId.split('@')[0]} Your Order Status:\n\n🆔 Order ID: ${order._id}\n💰 Total: ₹${order.total}\n📊 Status: ${order.status}\n📅 Date: ${order.createdAt.toDateString()}\n\nItems: ${order.items.map(item => item.name).join(', ')}`
            : `📦 Your Order Status:\n\n🆔 Order ID: ${order._id}\n💰 Total: ₹${order.total}\n📊 Status: ${order.status}\n📅 Date: ${order.createdAt.toDateString()}\n\nItems: ${order.items.map(item => item.name).join(', ')}`;
          await sendMessage(from, statusMsg);
          return;
        }
      }
      const noOrderMsg = isGroup
        ? `❓ @${userId.split('@')[0]} No active orders found. Type *browse* to start shopping!`
        : "❓ No active orders found. Type *browse* to start shopping!";
      await sendMessage(from, noOrderMsg);
      return;
    }

    // Reset session if user says browse and session is done
    if (cleanText === "browse" && session.step === "done") {
      session.step = "welcome";
      session.cart = [];
      session.customization = "";
    }

    // Handle browse command
    if (session.step === "welcome" && (cleanText === "browse" || cleanText.includes("browse"))) {
      const trophies = await Trophy.find();
      if (trophies.length === 0) {
        const noTrophiesMsg = isGroup
          ? `⚠️ @${userId.split('@')[0]} No trophies found in catalog.`
          : "⚠️ No trophies found in catalog.";
        await sendMessage(from, noTrophiesMsg);
        return;
      }

      let response = isGroup
        ? `🏆 *Available Trophies* @${userId.split('@')[0]}:\n\n`
        : "🏆 *Available Trophies:*\n\n";
      trophies.forEach((t, i) => {
        response += `${i + 1}. ${t.name} - *₹${t.price}*\n`;
      });
      response += "\n💡 *How to order:*\n• Reply with the *number* to select a trophy\n• Add your customization text\n• Proceed to checkout\n\n🛒 Ready to start? Just reply with a number!";
      session.step = "browse";
      await sendMessage(from, response);
    }

    // Handle trophy selection
    else if (session.step === "browse" && !isNaN(cleanText)) {
      const index = parseInt(cleanText) - 1;
      const trophies = await Trophy.find();
      if (trophies[index]) {
        const trophy = trophies[index];
        session.cart.push(trophy);
        session.step = "customization";
        const customMsg = isGroup
          ? `✅ @${userId.split('@')[0]} *${trophy.name}* added to cart! 🛒\n\n🖊 *Customization:*\nPlease enter the text you want engraved on this trophy.\n\n💡 *Examples:*\n• "Best Employee 2024"\n• "Championship Winner"\n• "Outstanding Performance"\n\nJust reply with your customization text!`
          : `✅ *${trophy.name}* added to cart! 🛒\n\n🖊 *Customization:*\nPlease enter the text you want engraved on this trophy.\n\n💡 *Examples:*\n• "Best Employee 2024"\n• "Championship Winner"\n• "Outstanding Performance"\n\nJust reply with your customization text!`;
        await sendMessage(from, customMsg);
      } else {
        const invalidMsg = isGroup
          ? `⚠️ @${userId.split('@')[0]} Invalid choice. Try again.`
          : "⚠️ Invalid choice. Try again.";
        await sendMessage(from, invalidMsg);
      }
    }

    // Handle customization
    else if (session.step === "customization") {
      session.customization = text;
      session.step = "checkout";
      const checkoutMsg = isGroup
        ? `✅ @${userId.split('@')[0]} *Customization added!* ✨\n\n📝 *Your customization:* "${text}"\n\n🛒 *Ready to checkout?*\nReply *checkout* to proceed with your order!`
        : `✅ *Customization added!* ✨\n\n📝 *Your customization:* "${text}"\n\n🛒 *Ready to checkout?*\nReply *checkout* to proceed with your order!`;
      await sendMessage(from, checkoutMsg);
    }

    // Handle checkout
    else if (session.step === "checkout" && (cleanText === "checkout" || cleanText.includes("checkout"))) {
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

      const paymentMsg = isGroup
        ? `🛒 @${userId.split('@')[0]} *Order Summary:*\n\n📦 *Items:*\n${session.cart.map(item => `• ${item.name} - ₹${item.price}`).join('\n')}\n\n📝 *Customization:* "${session.customization}"\n\n💰 *Total Amount: ₹${total}*\n\n💳 *Ready to pay?*\nReply *pay* to confirm your order!`
        : `🛒 *Order Summary:*\n\n📦 *Items:*\n${session.cart.map(item => `• ${item.name} - ₹${item.price}`).join('\n')}\n\n📝 *Customization:* "${session.customization}"\n\n💰 *Total Amount: ₹${total}*\n\n💳 *Ready to pay?*\nReply *pay* to confirm your order!`;
      await sendMessage(from, paymentMsg);
    }

    // Handle payment
    else if (session.step === "payment" && (cleanText === "pay" || cleanText.includes("pay"))) {
      const order = await Order.findById(session.orderId);
      order.status = "paid";
      await order.save();

      try {
        const invoicePath = await generateInvoice(order, USE_LETTERHEAD, LETTERHEAD_PATH);
        const invoiceCaption = isGroup
          ? `🎉 @${userId.split('@')[0]} *Order Confirmed!* ✅\n\n📄 *Invoice attached*\n🚚 *Delivery tracking will start soon*\n\nThank you for choosing TrophyBot! 🏆`
          : "🎉 *Order Confirmed!* ✅\n\n📄 *Invoice attached*\n🚚 *Delivery tracking will start soon*\n\nThank you for choosing TrophyBot! 🏆";
        
        // TODO: Send invoice as media message
        await sendMessage(from, invoiceCaption, invoicePath);
      } catch (err) {
        console.error("❌ Invoice generation failed:", err);
        const errorMsg = isGroup
          ? `⚠️ @${userId.split('@')[0]} Could not generate invoice.`
          : "⚠️ Could not generate invoice.";
        await sendMessage(from, errorMsg);
      }

      session.step = "done";
    }

    // Reset command
    else if (cleanText === "reset" || cleanText === "start" || cleanText === "menu") {
      session.step = "welcome";
      session.cart = [];
      session.customization = "";
      const resetMsg = isGroup
        ? `🔄 @${userId.split('@')[0]} Session reset! Reply *browse* to see our trophies.`
        : "🔄 Session reset! Reply *browse* to see our trophies.";
      await sendMessage(from, resetMsg);
    }

    // Fallback
    else {
      let fallbackMsg;
      if (session.step === "welcome") {
        fallbackMsg = isGroup
          ? `❓ @${userId.split('@')[0]} I didn't understand that. Try:\n• *browse* - See trophies\n• *help* - Show commands\n• *hi* - Get started`
          : "❓ I didn't understand that. Try:\n• *browse* - See trophies\n• *help* - Show commands\n• *hi* - Get started";
      } else if (session.step === "browse") {
        fallbackMsg = isGroup
          ? `❓ @${userId.split('@')[0]} Please reply with a *number* to select a trophy, or *help* for options.`
          : "❓ Please reply with a *number* to select a trophy, or *help* for options.";
      } else if (session.step === "customization") {
        fallbackMsg = isGroup
          ? `❓ @${userId.split('@')[0]} Please enter your *customization text* for the trophy.`
          : "❓ Please enter your *customization text* for the trophy.";
      } else if (session.step === "checkout") {
        fallbackMsg = isGroup
          ? `❓ @${userId.split('@')[0]} Reply *checkout* to proceed with your order.`
          : "❓ Reply *checkout* to proceed with your order.";
      } else if (session.step === "payment") {
        fallbackMsg = isGroup
          ? `❓ @${userId.split('@')[0]} Reply *pay* to confirm your order.`
          : "❓ Reply *pay* to confirm your order.";
      } else {
        fallbackMsg = isGroup
          ? `❓ @${userId.split('@')[0]} Please reply *browse* to see products, *reset* to start over, or *help* for options.`
          : "❓ Please reply *browse* to see products, *reset* to start over, or *help* for options.";
      }
      await sendMessage(from, fallbackMsg);
    }

  } catch (error) {
    console.error("❌ Error processing message:", error);
  }
}
