// bot-handler.js - WhatsApp Cloud API adapter.
//
// Transport + routing only. The conversation state machine lives in
// services/conversationFlow.js and is shared with the other entry points;
// this file translates Cloud API webhook payloads into flow input, then
// executes the actions the flow returns using the Cloud API client.
import mongoose from "mongoose";
import path from "path";
import dotenv from "dotenv";
import WhatsAppBusinessAPI from "./whatsapp-api-client.js";
import { Trophy } from "./models/Trophy.js";
import { Order } from "./models/Order.js";
import { Client } from "./models/Client.js";
import {
  handleAdminCommand,
  handleClientReply,
} from "./services/outreachService.js";
import { mockDeliveryUpdates } from "./utils/deliveryTracker.js";
import { getSession, saveSession } from "./services/sessionStore.js";
import { runConversation, ACTIONS } from "./services/conversationFlow.js";
import { generateInvoice } from "./utils/invoiceGenerator.js";

dotenv.config();

// Initialize WhatsApp API client
const whatsappAPI = new WhatsAppBusinessAPI();

// -------------------- DB SETUP --------------------
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/trophybot")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// -------------------- CONFIGURATION --------------------
const BOT_NUMBER = process.env.BOT_NUMBER || "918838975981";
const BOT_NAME = process.env.BOT_NAME || "Skulpt";
const USE_LETTERHEAD = process.env.USE_LETTERHEAD === "true" || false;
const LETTERHEAD_PATH = process.env.LETTERHEAD_PATH || "./letterhead_template.png";

// -------------------- MESSAGE SENDER --------------------
async function sendMessage(to, message, mediaUrl = null) {
  try {
    console.log(`📤 Sending message to ${to}:`, message);

    if (mediaUrl) {
      console.log(`📎 Media: ${mediaUrl}`);
      // Local files must be uploaded first — the Cloud API only accepts a
      // publicly reachable URL in `link`, so a filesystem path silently fails.
      if (!/^https?:\/\//i.test(mediaUrl)) {
        return await whatsappAPI.sendDocumentFromFile(
          to,
          mediaUrl,
          path.basename(mediaUrl),
          message
        );
      }
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

/** Execute the actions returned by the conversation flow. */
async function executeActions(actions, { from, mention }) {
  for (const action of actions) {
    switch (action.type) {
      case ACTIONS.TEXT:
        await sendMessage(from, action.body);
        break;

      case ACTIONS.DOCUMENT:
        await sendMessage(from, action.caption, action.path);
        break;

      case ACTIONS.NOTIFY_ADMIN: {
        const admin = process.env.ADMIN_NUMBER;
        if (admin) {
          try {
            await sendMessage(admin.replace(/\D/g, ""), action.body);
          } catch (err) {
            // A failed admin notice must never fail the customer's order
            console.error("⚠️ Failed to notify admin:", err.message);
          }
        }
        break;
      }

      case ACTIONS.DELIVERY_TRACKING:
        mockDeliveryUpdates(from, (to, text) => sendMessage(to, text), action.prefix || "");
        break;

      default:
        console.warn("⚠️ Unknown action type:", action.type);
    }
  }
}

// -------------------- MESSAGE HANDLER --------------------
export async function botHandler(message, businessAccountId) {
  try {
    const from = message.from;
    const text = message.text?.body || "";

    console.log(`📩 Processing message from ${from}: ${text}`);

    // Check if it's a group message
    const isGroup = from.includes("@g.us");
    const isGroupMention =
      isGroup && text.toLowerCase().includes(`@${BOT_NAME.toLowerCase()}`);
    const isBotNumberMention =
      isGroup && text.includes("@") && text.includes(BOT_NUMBER);
    const isReplyToBot = message.context?.replied_message_id; // This would need to be tracked

    // Skip if it's a group message without proper mention
    if (isGroup && !isGroupMention && !isBotNumberMention && !isReplyToBot) {
      return;
    }

    const userId = isGroup ? message.from : from;
    const sessionKey = isGroup ? `${from}_${userId}` : from;
    const mention = userId.split("@")[0];

    // Clean text for processing
    let cleanText = text.toLowerCase();
    if (isGroupMention) {
      cleanText = cleanText
        .replace(new RegExp(`@${BOT_NAME.toLowerCase()}\\s*`, "gi"), "")
        .trim();
    }
    if (isBotNumberMention) {
      cleanText = cleanText.replace(/@\d+\s*/g, "").trim();
    }

    // Load (or create) the persistent session for this chat
    const { session, created } = await getSession(sessionKey, {
      isGroup: isGroup,
      groupId: isGroup ? from : null,
      userId: userId,
    });

    if (created) {
      const welcomeMsg = isGroup
        ? `👋 Welcome to TrophyBot! @${mention}\nReply *browse* to see our trophies.`
        : "👋 Welcome to TrophyBot!\nReply *browse* to see our trophies.";

      await sendMessage(from, welcomeMsg);
      return;
    }

    // Admin-only client management & outreach commands
    const adminResponse = await handleAdminCommand(from, text);
    if (adminResponse.handled) {
      for (const msg of adminResponse.messages) {
        await sendMessage(from, msg);
      }
      return;
    }

    // Client outreach reply handling (replies to recurring reminders).
    // Only intercept when the user isn't mid-order, and only in DMs.
    // Skip known bot commands so a normal "browse" isn't mistaken for a reply.
    const isOutreachCommand =
      /^(browse|checkout|pay|reset|menu|start|back)\b|^\d+$/.test(cleanText);
    if (
      !isGroup &&
      !isOutreachCommand &&
      (session.step === "welcome" || session.step === "done")
    ) {
      const reply = await handleClientReply(from, text);
      if (reply.handled) {
        for (const msg of reply.messages) {
          await sendMessage(from, msg);
        }
        if (reply.positive) {
          session.step = "browse"; // ready to select a trophy
          await saveSession(sessionKey, session);
        }
        return;
      }
    }

    // --- Shared conversation flow ---
    const stepBefore = session.step;
    const actions = await runConversation({
      text: cleanText,
      rawText: text,
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

    // Register / update the client record for future outreach, on the
    // checkout -> payment transition (i.e. an order was just created).
    if (!isGroup && stepBefore === "checkout" && session.step === "payment") {
      try {
        const cleanPhone = from.replace(/\D/g, "");
        if (cleanPhone) {
          const existing = await Client.findOne({ phone: cleanPhone });
          if (existing) {
            existing.lastOrderAt = new Date();
            await existing.save();
          } else {
            await Client.create({
              name: `Client ${cleanPhone.slice(-4)}`,
              phone: cleanPhone,
              source: "order",
              lastOrderAt: new Date(),
            });
          }
        }
      } catch (err) {
        console.error("⚠️ Failed to register client:", err.message);
      }
    }

    await executeActions(actions, { from, mention });

    // Persist whatever the flow mutated (step/cart/customization/orderId)
    await saveSession(sessionKey, session);
  } catch (error) {
    console.error("❌ Error processing message:", error);
  }
}
