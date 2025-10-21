// bot.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";
import qrcode from "qrcode-terminal";
import fs from "fs";
import path from "path";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth, MessageMedia } = pkg;

dotenv.config();

// -------------------- BOT CONFIGURATION --------------------
const BOT_NUMBER = "918838975981"; // Replace with your bot's WhatsApp number (without +)
const BOT_NAME = "Skulpt"; // Bot name for mentions

// -------------------- INVOICE CONFIGURATION --------------------
const USE_LETTERHEAD = true; // Set to true when you have letterhead template
const LETTERHEAD_PATH = "./letterhead_template.png"; // Path to your letterhead template
const COMPANY_NAME = "THYNK UNLIMITED"; // Your company name
const COMPANY_TAGLINE = "Creative Company"; // Your company tagline

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
  groupId: String, // Store group ID for group orders
  createdAt: { type: Date, default: Date.now },
});


const Trophy = mongoose.model("Trophy", TrophySchema);
const Order = mongoose.model("Order", OrderSchema);

// -------------------- SAMPLE DATA SETUP --------------------
async function setupSampleData() {
  try {
    const trophyCount = await Trophy.countDocuments();
    if (trophyCount === 0) {
      const sampleTrophies = [
        { name: "🏆 Golden Trophy", price: 1500, image: "golden_trophy.jpg" },
        { name: "🥇 Silver Medal", price: 800, image: "silver_medal.jpg" },
        { name: "🏅 Bronze Medal", price: 500, image: "bronze_medal.jpg" },
        { name: "🎖️ Achievement Award", price: 1200, image: "achievement_award.jpg" },
        { name: "🏆 Championship Cup", price: 2000, image: "championship_cup.jpg" },
        { name: "🥉 Participation Medal", price: 300, image: "participation_medal.jpg" }
      ];
      
      await Trophy.insertMany(sampleTrophies);
      console.log("✅ Sample trophies added to database");
    }
  } catch (err) {
    console.error("❌ Error setting up sample data:", err);
  }
}

// -------------------- WHATSAPP SETUP --------------------
const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  console.log("📲 Scan this QR to log in:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  console.log("✅ TrophyBot is ready!");
  await setupSampleData();
});

// -------------------- SESSION HANDLER --------------------
const sessions = new Map();

// -------------------- INVOICE GENERATOR --------------------
async function generateInvoice(order, useLetterhead = false, letterheadPath = null) {
  const filePath = path.join(process.cwd(), `invoice_${order._id}.pdf`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // If letterhead template is provided, use it
    if (useLetterhead && letterheadPath && fs.existsSync(letterheadPath)) {
      // Add letterhead as background image
      doc.image(letterheadPath, 0, 0, { width: 612, height: 792 }); // A4 size
      
      // Add content in the blank area (adjust coordinates based on letterhead design)
      doc.fontSize(18).text("🏆 Trophy Order Invoice", 50, 200, { align: "center" });
      doc.moveDown(2);

      doc.fontSize(12).text(`Order ID: ${order._id}`, 50, 250);
      doc.text(`Date: ${order.createdAt.toDateString()}`, 50, 270);
      doc.text(`Customer: ${order.userId}`, 50, 290);
      doc.moveDown(2);

      // Items table
      let yPosition = 350;
      doc.text("Items:", 50, yPosition);
      yPosition += 20;
      
      order.items.forEach((item, index) => {
        doc.text(`${index + 1}. ${item.name}`, 70, yPosition);
        doc.text(`₹${item.price}`, 450, yPosition, { align: "right" });
        yPosition += 20;
      });

      // Customization
      if (order.customization) {
        doc.text(`Customization: ${order.customization}`, 50, yPosition + 10);
        yPosition += 30;
      }

      // Total
      doc.fontSize(14).text(`Total: ₹${order.total}`, 450, yPosition + 20, { align: "right" });
      
    } else {
      // Default invoice without letterhead
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

// -------------------- MOCK PORTER DELIVERY --------------------
function mockDeliveryUpdates(chatId, isGroup = false, userId = null) {
  const updates = [
    "📦 Order packed at warehouse.",
    "🚚 Assigned to Porter delivery partner.",
    "🛵 Rider picked up the package.",
    "📍 Rider is near your location.",
    "✅ Order delivered successfully!",
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i < updates.length) {
      const message = isGroup && userId 
        ? `${updates[i]} @${userId.split('@')[0]}`
        : updates[i];
      client.sendMessage(chatId, message);
      i++;
    } else {
      clearInterval(interval);
    }
  }, 10000); // every 10s for demo
}

// -------------------- MESSAGE HANDLER --------------------
client.on("message", async (msg) => {
  console.log("📩 Message received:", msg.body, "from", msg.from);

  // Check if it's a group message with @skulpt mention (case insensitive)
  const isGroupMention = msg.from.includes('@g.us') && 
    (msg.body.toLowerCase().includes(`@${BOT_NAME.toLowerCase()}`) || msg.body.toLowerCase().includes('@sculpt'));
  
  // Check if it's a mention of the bot's number (from @ popup selection)
  const isBotNumberMention = msg.from.includes('@g.us') && 
    msg.body.includes('@') && 
    (msg.body.includes(BOT_NUMBER) || msg.body.includes(`+${BOT_NUMBER}`));
  
  // Debug logging for @ popup detection
  if (msg.from.includes('@g.us') && msg.body.includes('@')) {
    console.log(`🔍 @ popup detection: "${msg.body}" | looking for: ${BOT_NUMBER} | found: ${isBotNumberMention}`);
  }
  
  // Check if it's a reply to bot's message
  const isReplyToBot = msg.hasQuotedMsg && msg.from.includes('@g.us');
  
  // Check if it's a direct message
  const isDirectMessage = !msg.from.includes('@g.us');
  
  // Skip if it's a group message without @skulpt mention, bot number mention, or reply to bot
  if (!isDirectMessage && !isGroupMention && !isBotNumberMention && !isReplyToBot) {
    return;
  }

  const chatId = msg.from;
  const userId = (isGroupMention || isBotNumberMention || isReplyToBot) ? msg.author : msg.from;
  
  // Extract clean user number for display
  const getUserDisplayName = (msg) => {
    if (!msg.author) return "User";
    // Extract number from msg.author (format: 919966701272@c.us)
    const number = msg.author.split('@')[0];
    return number;
  };
  
  // Create session key for group users
  const sessionKey = (isGroupMention || isBotNumberMention || isReplyToBot) ? `${chatId}_${userId}` : chatId;
  
  if (!sessions.has(sessionKey)) {
    sessions.set(sessionKey, { 
      step: "welcome", 
      cart: [], 
      customization: "",
      isGroup: isGroupMention || isBotNumberMention || isReplyToBot,
      groupId: (isGroupMention || isBotNumberMention || isReplyToBot) ? chatId : null,
      userId: userId
    });
    
    const welcomeMsg = (isGroupMention || isBotNumberMention || isReplyToBot)
      ? `👋 Welcome to TrophyBot! @${getUserDisplayName(msg)}\nReply *browse* to see our trophies.`
      : "👋 Welcome to TrophyBot!\nReply *browse* to see our trophies.";
      
    await client.sendMessage(chatId, welcomeMsg);
    return;
  }

  const session = sessions.get(sessionKey);
  
  // Clean the text by removing @skulpt mentions and bot number mentions for processing
  let text = msg.body.trim().toLowerCase();
  if (isGroupMention) {
    text = text.replace(new RegExp(`@${BOT_NAME.toLowerCase()}\\s*`, 'gi'), '').replace(/@sculpt\s*/gi, '').trim();
  }
  if (isBotNumberMention) {
    text = text.replace(/@\d+\s*/g, '').trim(); // Remove @number mentions
  }
  
  // Detect greetings and common phrases
  const isGreeting = /^(hi|hello|hey|hii|hiii|good morning|good afternoon|good evening|namaste|namaskar)/.test(text);
  const isHelpRequest = /^(help|menu|start|begin|commands?)/.test(text);
  const isStatusRequest = /^(status|order|my order|track)/.test(text);
  
  console.log(`🔍 Processing message: "${msg.body}" -> cleaned: "${text}" | step: ${session.step} | isGroup: ${session.isGroup} | isReply: ${isReplyToBot} | botMention: ${isBotNumberMention} | greeting: ${isGreeting}`);

  // Handle greetings
  if (isGreeting) {
    const greetingMsg = session.isGroup 
      ? `👋 Hello @${getUserDisplayName(msg)}! Welcome to TrophyBot! 🏆\n\nI can help you:\n• Browse our trophy collection\n• Place custom orders\n• Track your deliveries\n\nType *browse* to see our trophies or *help* for more options!`
      : "👋 Hello! Welcome to TrophyBot! 🏆\n\nI can help you:\n• Browse our trophy collection\n• Place custom orders\n• Track your deliveries\n\nType *browse* to see our trophies or *help* for more options!";
    await client.sendMessage(chatId, greetingMsg);
    return;
  }

  // Handle help requests
  if (isHelpRequest) {
    const helpMsg = session.isGroup 
      ? `🆘 @${getUserDisplayName(msg)} Here's how to use TrophyBot:\n\n📋 **Commands:**\n• *browse* - See available trophies\n• *reset* - Start over\n• *status* - Check your order\n• *help* - Show this menu\n\n🛒 **Order Process:**\n1. Browse trophies\n2. Select by number\n3. Add customization\n4. Checkout & pay\n5. Track delivery\n\n💡 **Tip:** You can reply to my messages or use @skulpt commands!`
      : "🆘 Here's how to use TrophyBot:\n\n📋 **Commands:**\n• *browse* - See available trophies\n• *reset* - Start over\n• *status* - Check your order\n• *help* - Show this menu\n\n🛒 **Order Process:**\n1. Browse trophies\n2. Select by number\n3. Add customization\n4. Checkout & pay\n5. Track delivery";
    await client.sendMessage(chatId, helpMsg);
    return;
  }

  // Handle status requests
  if (isStatusRequest) {
    if (session.orderId) {
      const order = await Order.findById(session.orderId);
      if (order) {
        const statusMsg = session.isGroup 
          ? `📦 @${getUserDisplayName(msg)} Your Order Status:\n\n🆔 Order ID: ${order._id}\n💰 Total: ₹${order.total}\n📊 Status: ${order.status}\n📅 Date: ${order.createdAt.toDateString()}\n\nItems: ${order.items.map(item => item.name).join(', ')}`
          : `📦 Your Order Status:\n\n🆔 Order ID: ${order._id}\n💰 Total: ₹${order.total}\n📊 Status: ${order.status}\n📅 Date: ${order.createdAt.toDateString()}\n\nItems: ${order.items.map(item => item.name).join(', ')}`;
        await client.sendMessage(chatId, statusMsg);
        return;
      }
    }
    const noOrderMsg = session.isGroup 
      ? `❓ @${getUserDisplayName(msg)} No active orders found. Type *browse* to start shopping!`
      : "❓ No active orders found. Type *browse* to start shopping!";
    await client.sendMessage(chatId, noOrderMsg);
    return;
  }

  // Reset session if user says browse and session is done
  if (text === "browse" && session.step === "done") {
    session.step = "welcome";
    session.cart = [];
    session.customization = "";
    console.log("🔄 Session reset for user");
  }

  // Step 1: Browse
  if (session.step === "welcome" && (text === "browse" || text.includes("browse"))) {
    const trophies = await Trophy.find();
    if (trophies.length === 0) {
    const noTrophiesMsg = session.isGroup 
      ? `⚠️ @${getUserDisplayName(msg)} No trophies found in catalog.`
      : "⚠️ No trophies found in catalog.";
    await client.sendMessage(chatId, noTrophiesMsg);
      return;
    }

  let response = session.isGroup 
    ? `🏆 *Available Trophies* @${getUserDisplayName(msg)}:\n\n`
    : "🏆 *Available Trophies:*\n\n";
    trophies.forEach((t, i) => {
      response += `${i + 1}. ${t.name} - *₹${t.price}*\n`;
    });
    response += "\n💡 *How to order:*\n• Reply with the *number* to select a trophy\n• Add your customization text\n• Proceed to checkout\n\n🛒 Ready to start? Just reply with a number!";
    session.step = "browse";
    await client.sendMessage(chatId, response);
  }

  // Step 2: Add to cart
  else if (session.step === "browse" && !isNaN(text)) {
    const index = parseInt(text) - 1;
    const trophies = await Trophy.find();
    if (trophies[index]) {
      const trophy = trophies[index];
      session.cart.push(trophy);
      session.step = "customization";
      const customMsg = session.isGroup 
        ? `✅ @${getUserDisplayName(msg)} *${trophy.name}* added to cart! 🛒\n\n🖊 *Customization:*\nPlease enter the text you want engraved on this trophy.\n\n💡 *Examples:*\n• "Best Employee 2024"\n• "Championship Winner"\n• "Outstanding Performance"\n\nJust reply with your customization text!`
        : `✅ *${trophy.name}* added to cart! 🛒\n\n🖊 *Customization:*\nPlease enter the text you want engraved on this trophy.\n\n💡 *Examples:*\n• "Best Employee 2024"\n• "Championship Winner"\n• "Outstanding Performance"\n\nJust reply with your customization text!`;
      await client.sendMessage(chatId, customMsg);
    } else {
      const invalidMsg = session.isGroup 
        ? `⚠️ @${getUserDisplayName(msg)} Invalid choice. Try again.`
        : "⚠️ Invalid choice. Try again.";
      await client.sendMessage(chatId, invalidMsg);
    }
  }

  // Step 3: Customization
  else if (session.step === "customization") {
    session.customization = msg.body;
    session.step = "checkout";
    const checkoutMsg = session.isGroup 
      ? `✅ @${getUserDisplayName(msg)} *Customization added!* ✨\n\n📝 *Your customization:* "${msg.body}"\n\n🛒 *Ready to checkout?*\nReply *checkout* to proceed with your order!`
      : `✅ *Customization added!* ✨\n\n📝 *Your customization:* "${msg.body}"\n\n🛒 *Ready to checkout?*\nReply *checkout* to proceed with your order!`;
    await client.sendMessage(chatId, checkoutMsg);
  }

  // Step 4: Checkout
  else if (session.step === "checkout" && (text === "checkout" || text.includes("checkout"))) {
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

    const paymentMsg = session.isGroup 
      ? `🛒 @${getUserDisplayName(msg)} *Order Summary:*\n\n📦 *Items:*\n${session.cart.map(item => `• ${item.name} - ₹${item.price}`).join('\n')}\n\n📝 *Customization:* "${session.customization}"\n\n💰 *Total Amount: ₹${total}*\n\n💳 *Ready to pay?*\nReply *pay* to confirm your order!`
      : `🛒 *Order Summary:*\n\n📦 *Items:*\n${session.cart.map(item => `• ${item.name} - ₹${item.price}`).join('\n')}\n\n📝 *Customization:* "${session.customization}"\n\n💰 *Total Amount: ₹${total}*\n\n💳 *Ready to pay?*\nReply *pay* to confirm your order!`;
    await client.sendMessage(chatId, paymentMsg);
  }

  // Step 5: Payment
  else if (session.step === "payment" && (text === "pay" || text.includes("pay"))) {
    const order = await Order.findById(session.orderId);
    order.status = "paid";
    await order.save();

    try {
      // Generate invoice safely
      const invoicePath = await generateInvoice(order, USE_LETTERHEAD, LETTERHEAD_PATH);
      const media = MessageMedia.fromFilePath(invoicePath);
      const invoiceCaption = session.isGroup 
        ? `🎉 @${getUserDisplayName(msg)} *Order Confirmed!* ✅\n\n📄 *Invoice attached*\n🚚 *Delivery tracking will start soon*\n\nThank you for choosing TrophyBot! 🏆`
        : "🎉 *Order Confirmed!* ✅\n\n📄 *Invoice attached*\n🚚 *Delivery tracking will start soon*\n\nThank you for choosing TrophyBot! 🏆";
      await client.sendMessage(chatId, media, {
        caption: invoiceCaption,
      });
    } catch (err) {
      console.error("❌ Invoice generation failed:", err);
      const errorMsg = session.isGroup 
        ? `⚠️ @${getUserDisplayName(msg)} Could not generate invoice.`
        : "⚠️ Could not generate invoice.";
      await client.sendMessage(chatId, errorMsg);
    }

    // Notify admin
    if (process.env.ADMIN_NUMBER) {
      const adminNumber = process.env.ADMIN_NUMBER + "@c.us";
      const adminMsg = session.isGroup 
        ? `📢 New Order Paid!\nID: ${order._id}\nTotal: ₹${order.total}\nGroup: ${session.groupId}\nCustomer: ${session.userId}`
        : `📢 New Order Paid!\nID: ${order._id}\nTotal: ₹${order.total}`;
      await client.sendMessage(adminNumber, adminMsg);
    }

    // Mock Porter Delivery
    mockDeliveryUpdates(chatId, session.isGroup, session.userId);

    session.step = "done";
  }

  // Reset command
  else if (text === "reset" || text === "start" || text === "menu") {
    session.step = "welcome";
    session.cart = [];
    session.customization = "";
    const resetMsg = session.isGroup 
      ? `🔄 @${getUserDisplayName(msg)} Session reset! Reply *browse* to see our trophies.`
      : "🔄 Session reset! Reply *browse* to see our trophies.";
    await client.sendMessage(chatId, resetMsg);
  }

  // Fallback
  else {
    let fallbackMsg;
    if (session.step === "welcome") {
      fallbackMsg = session.isGroup 
        ? `❓ @${getUserDisplayName(msg)} I didn't understand that. Try:\n• *browse* - See trophies\n• *help* - Show commands\n• *hi* - Get started`
        : "❓ I didn't understand that. Try:\n• *browse* - See trophies\n• *help* - Show commands\n• *hi* - Get started";
    } else if (session.step === "browse") {
      fallbackMsg = session.isGroup 
        ? `❓ @${getUserDisplayName(msg)} Please reply with a *number* to select a trophy, or *help* for options.`
        : "❓ Please reply with a *number* to select a trophy, or *help* for options.";
    } else if (session.step === "customization") {
      fallbackMsg = session.isGroup 
        ? `❓ @${getUserDisplayName(msg)} Please enter your *customization text* for the trophy.`
        : "❓ Please enter your *customization text* for the trophy.";
    } else if (session.step === "checkout") {
      fallbackMsg = session.isGroup 
        ? `❓ @${getUserDisplayName(msg)} Reply *checkout* to proceed with your order.`
        : "❓ Reply *checkout* to proceed with your order.";
    } else if (session.step === "payment") {
      fallbackMsg = session.isGroup 
        ? `❓ @${getUserDisplayName(msg)} Reply *pay* to confirm your order.`
        : "❓ Reply *pay* to confirm your order.";
    } else {
      fallbackMsg = session.isGroup 
        ? `❓ @${getUserDisplayName(msg)} Please reply *browse* to see products, *reset* to start over, or *help* for options.`
        : "❓ Please reply *browse* to see products, *reset* to start over, or *help* for options.";
    }
    await client.sendMessage(chatId, fallbackMsg);
  }
});

// -------------------- START BOT --------------------
client.initialize();

