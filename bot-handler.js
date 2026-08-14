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
import { startDelivery, activeProvider } from "./services/delivery/index.js";
import { getSession, saveSession } from "./services/sessionStore.js";
import { runConversation, ACTIONS } from "./services/conversationFlow.js";
import { translator } from "./services/i18n.js";
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
// Keep reference images well under MongoDB's 16MB document cap
const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_BYTES || 5 * 1024 * 1024);

// Warehouse/pickup address handed to the delivery provider. Only used when
// Porter is configured; the mock provider ignores it.
const PORTER_PICKUP = {
  address: {
    street_address1: process.env.PICKUP_ADDRESS || "",
    city: process.env.PICKUP_CITY || "",
    pincode: process.env.PICKUP_PINCODE || "",
    contact_details: {
      name: process.env.PICKUP_CONTACT_NAME || process.env.COMPANY_NAME || "TrophyBot",
      phone_number: process.env.PICKUP_CONTACT_PHONE || process.env.ADMIN_NUMBER || "",
    },
  },
};

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

      case ACTIONS.DELIVERY_TRACKING: {
        // Fire-and-forget: a slow dispatch call must not delay the customer's
        // order confirmation. startDelivery falls back to the mock provider
        // unless Porter is configured.
        const order = action.orderId ? await Order.findById(action.orderId) : null;
        startDelivery(order || { _id: action.orderId }, (to, text) => sendMessage(to, text), {
          to: from,
          prefix: action.prefix || "",
          pickup: PORTER_PICKUP,
          drop: { address: { contact_details: { phone_number: from } } },
          onDeliveryCreated: async ({ deliveryId, trackingUrl }) => {
            if (!order) return;
            order.deliveryId = deliveryId;
            order.trackingUrl = trackingUrl;
            await order.save();
          },
        }).catch((err) => console.error("❌ Delivery dispatch failed:", err.message));
        break;
      }

      case ACTIONS.SET_LOCALE:
        // Mirror the language choice onto the Client record so reminders sent
        // outside a conversation use it too. No upsert: a Client may not exist
        // yet (it's created at checkout), and inserting one here would fail
        // validation on the required `name`. Checkout carries session.locale
        // across for that case.
        try {
          const phone = from.replace(/\D/g, "");
          if (phone) await Client.updateOne({ phone }, { $set: { locale: action.locale } });
        } catch (err) {
          console.error("⚠️ Failed to persist locale on client:", err.message);
        }
        break;

      default:
        console.warn("⚠️ Unknown action type:", action.type);
    }
  }
}

// -------------------- MESSAGE HANDLER --------------------
/**
 * Pull an image the customer sent down from the Cloud API.
 * Meta's media URLs are short-lived and require auth, so the bytes have to be
 * fetched now and stored — a URL kept for later would stop resolving.
 * Returns { data (base64), contentType } or null.
 */
async function downloadInboundImage(mediaId) {
  try {
    const urlRes = await whatsappAPI.getMediaUrl(mediaId);
    if (!urlRes.success) {
      console.error("⚠️ Could not resolve media URL:", urlRes.error);
      return null;
    }
    const dl = await whatsappAPI.downloadMedia(urlRes.url);
    if (!dl.success) {
      console.error("⚠️ Could not download media:", dl.error);
      return null;
    }
    if (dl.data.length > MAX_IMAGE_BYTES) {
      console.warn(`⚠️ Reference image too large (${dl.data.length} bytes), skipping`);
      return null;
    }
    // base64 in the session doc; converted back to a Buffer on the Order
    return { data: dl.data.toString("base64"), contentType: dl.contentType || "image/jpeg" };
  } catch (err) {
    console.error("⚠️ Error downloading reference image:", err.message);
    return null;
  }
}

export async function botHandler(message, businessAccountId) {
  try {
    const from = message.from;
    // An image's caption arrives on the image object, not as a text message
    const text = message.text?.body || message.image?.caption || "";

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

    // A returning customer's language preference lives on their Client record,
    // so a new session picks up where the last one left off.
    let knownLocale = null;
    if (!isGroup) {
      try {
        const phone = from.replace(/\D/g, "");
        if (phone) knownLocale = (await Client.findOne({ phone }))?.locale || null;
      } catch { /* not fatal — fall back to the default locale */ }
    }

    // Load (or create) the persistent session for this chat
    const { session, created } = await getSession(sessionKey, {
      isGroup: isGroup,
      groupId: isGroup ? from : null,
      userId: userId,
      locale: knownLocale,
    });

    if (created) {
      const _ = translator(session.locale);
      const welcomeMsg = isGroup ? `@${mention} ${_("welcome")}` : _("welcome");
      await sendMessage(from, welcomeMsg);
      return;
    }

    // Reference photo for the engraving/design. Accepted while the customer is
    // choosing or describing their trophy; the bytes are attached to the Order
    // at checkout. An image caption still flows through as normal text.
    if (message.type === "image" && message.image?.id) {
      if (["browse", "customization", "checkout"].includes(session.step)) {
        const image = await downloadInboundImage(message.image.id);
        if (image) {
          session.pendingImage = image;
          await saveSession(sessionKey, session);
          await sendMessage(
            from,
            `🖼 ${isGroup ? `@${mention} ` : ""}Reference image received! It'll be attached to your order.` +
              (session.step === "customization"
                ? "\n\n🖊 Now send the *text* you'd like engraved."
                : "")
          );
        } else {
          await sendMessage(
            from,
            `⚠️ ${isGroup ? `@${mention} ` : ""}Couldn't process that image. Please try a smaller one, or continue with text.`
          );
        }
      } else {
        await sendMessage(
          from,
          `📷 ${isGroup ? `@${mention} ` : ""}Thanks! Start an order with *browse* to attach a reference image.`
        );
      }
      // A caption is handled as text on its own turn; nothing more to do here.
      if (!message.image?.caption) return;
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
            // Carry the language choice over — a customer can pick a language
            // before any Client record exists, in which case SET_LOCALE had
            // nothing to write to.
            if (session.locale) existing.locale = session.locale;
            await existing.save();
          } else {
            await Client.create({
              name: `Client ${cleanPhone.slice(-4)}`,
              phone: cleanPhone,
              source: "order",
              lastOrderAt: new Date(),
              locale: session.locale || null,
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
