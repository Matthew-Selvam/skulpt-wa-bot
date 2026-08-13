// bot.js - whatsapp-web.js (QR login) adapter, for local development.
//
// Transport only. The conversation state machine lives in
// services/conversationFlow.js and is shared with bot-handler.js (the deployed
// Cloud API path) and services/messageHandler.js.
//
// This entry point is not what render.yaml runs; it exists for local testing
// against a real WhatsApp account without Cloud API credentials.
import mongoose from "mongoose";
import dotenv from "dotenv";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";

import { Trophy } from "./models/Trophy.js";
import { Order } from "./models/Order.js";
import { generateInvoice } from "./utils/invoiceGenerator.js";
import { mockDeliveryUpdates } from "./utils/deliveryTracker.js";
import { runConversation, ACTIONS } from "./services/conversationFlow.js";

const { Client, LocalAuth, MessageMedia } = pkg;

dotenv.config();

// -------------------- BOT CONFIGURATION --------------------
const BOT_NUMBER = process.env.BOT_NUMBER || "918838975981";
const BOT_NAME = process.env.BOT_NAME || "Skulpt";
const USE_LETTERHEAD = process.env.USE_LETTERHEAD === "true" || false;
const LETTERHEAD_PATH = process.env.LETTERHEAD_PATH || "./letterhead_template.png";

// -------------------- DB SETUP --------------------
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/trophybot")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

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
        { name: "🥉 Participation Medal", price: 300, image: "participation_medal.jpg" },
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

/** Execute flow actions over the whatsapp-web.js client. */
async function executeActions(actions, chatId) {
  for (const action of actions) {
    switch (action.type) {
      case ACTIONS.TEXT:
        await client.sendMessage(chatId, action.body);
        break;

      case ACTIONS.DOCUMENT:
        try {
          // whatsapp-web.js attaches local files directly — no upload step
          const media = MessageMedia.fromFilePath(action.path);
          await client.sendMessage(chatId, media, { caption: action.caption });
        } catch (err) {
          console.error("⚠️ Failed to attach invoice:", err.message);
          await client.sendMessage(chatId, action.caption);
        }
        break;

      case ACTIONS.NOTIFY_ADMIN:
        if (process.env.ADMIN_NUMBER) {
          try {
            await client.sendMessage(
              process.env.ADMIN_NUMBER + "@c.us",
              action.body
            );
          } catch (err) {
            console.error("⚠️ Failed to notify admin:", err.message);
          }
        }
        break;

      case ACTIONS.DELIVERY_TRACKING:
        mockDeliveryUpdates(
          chatId,
          (to, text) => client.sendMessage(to, text),
          action.prefix || ""
        );
        break;

      default:
        console.warn("⚠️ Unknown action type:", action.type);
    }
  }
}

// -------------------- MESSAGE HANDLER --------------------
client.on("message", async (msg) => {
  try {
    console.log("📩 Message received:", msg.body, "from", msg.from);

    const inGroup = msg.from.includes("@g.us");

    // Group activation: @Skulpt / @sculpt by name, @<number> from the mention
    // popup, or a reply to one of the bot's own messages.
    const isGroupMention =
      inGroup &&
      (msg.body.toLowerCase().includes(`@${BOT_NAME.toLowerCase()}`) ||
        msg.body.toLowerCase().includes("@sculpt"));
    const isBotNumberMention =
      inGroup &&
      msg.body.includes("@") &&
      (msg.body.includes(BOT_NUMBER) || msg.body.includes(`+${BOT_NUMBER}`));
    const isReplyToBot = msg.hasQuotedMsg && inGroup;

    const isGroup = isGroupMention || isBotNumberMention || isReplyToBot;

    // Skip group messages that aren't addressed to the bot
    if (inGroup && !isGroup) return;

    const chatId = msg.from;
    const userId = isGroup ? msg.author : msg.from;
    const mention = msg.author ? msg.author.split("@")[0] : "User";
    const sessionKey = isGroup ? `${chatId}_${userId}` : chatId;

    if (!sessions.has(sessionKey)) {
      sessions.set(sessionKey, {
        step: "welcome",
        cart: [],
        customization: "",
        isGroup: isGroup,
        groupId: isGroup ? chatId : null,
        userId: userId,
      });

      const welcomeMsg = isGroup
        ? `👋 Welcome to TrophyBot! @${mention}\nReply *browse* to see our trophies.`
        : "👋 Welcome to TrophyBot!\nReply *browse* to see our trophies.";

      await client.sendMessage(chatId, welcomeMsg);
      return;
    }

    const session = sessions.get(sessionKey);

    // Strip the mention so "@Skulpt browse" reads as "browse"
    let text = msg.body.trim().toLowerCase();
    if (isGroupMention) {
      text = text
        .replace(new RegExp(`@${BOT_NAME.toLowerCase()}\\s*`, "gi"), "")
        .replace(/@sculpt\s*/gi, "")
        .trim();
    }
    if (isBotNumberMention) {
      text = text.replace(/@\d+\s*/g, "").trim();
    }

    const actions = await runConversation({
      text,
      rawText: msg.body,
      session,
      isGroup,
      mention,
      deps: {
        Trophy,
        Order,
        generateInvoice,
        useLetterhead: USE_LETTERHEAD,
        letterheadPath: LETTERHEAD_PATH,
        adminNumber: process.env.ADMIN_NUMBER,
      },
    });

    await executeActions(actions, chatId);
  } catch (error) {
    console.error("❌ Error processing message:", error);
  }
});

// -------------------- START BOT --------------------
client.initialize();
