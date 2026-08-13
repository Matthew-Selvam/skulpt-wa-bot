// services/messageHandler.js - Adapter for the app.js / routes/webhook.js path.
//
// Transport only. The conversation state machine lives in conversationFlow.js
// and is shared with bot-handler.js and bot.js.
//
// Note this path still uses an in-memory session Map. The deployed path
// (webhook-server.js + bot-handler.js) uses the persistent store in
// sessionStore.js; this entry point isn't what render.yaml runs.
import { Trophy } from "../models/Trophy.js";
import { Order } from "../models/Order.js";
import { config } from "../config/config.js";
import {
  sendTextMessage,
  sendDocument,
  processTextForWhatsApp,
} from "../utils/whatsappUtils.js";
import { generateInvoice } from "../utils/invoiceGenerator.js";
import { mockDeliveryUpdates } from "../utils/deliveryTracker.js";
import { runConversation, ACTIONS } from "./conversationFlow.js";

// Session storage (in production, use Redis or database)
const sessions = new Map();

/**
 * Get or create session for user
 */
function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      step: "welcome",
      cart: [],
      customization: "",
      isGroup: false,
      groupId: null,
      userId: userId,
    });
  }
  return sessions.get(userId);
}

/** Execute flow actions over the Cloud API helpers in whatsappUtils. */
async function executeActions(actions, waId) {
  for (const action of actions) {
    switch (action.type) {
      case ACTIONS.TEXT:
        // Same formatting pass processWhatsAppMessage used to apply
        await sendTextMessage(waId, processTextForWhatsApp(action.body));
        break;

      case ACTIONS.DOCUMENT:
        try {
          await sendDocument(waId, action.path, action.filename, action.caption);
          console.log("✅ Invoice PDF sent successfully");
        } catch (docError) {
          console.error("⚠️ Failed to send invoice document:", docError.message);
          await sendTextMessage(
            waId,
            `${action.caption}\n\n⚠️ Unable to attach PDF. Please contact support.`
          );
        }
        break;

      case ACTIONS.NOTIFY_ADMIN: {
        if (!config.ADMIN_NUMBER) break;
        // Ensure admin number has country code prefix
        const adminNumber = config.ADMIN_NUMBER.startsWith("+")
          ? config.ADMIN_NUMBER.substring(1)
          : config.ADMIN_NUMBER.startsWith("91")
            ? config.ADMIN_NUMBER
            : "91" + config.ADMIN_NUMBER;
        try {
          await sendTextMessage(adminNumber, action.body);
        } catch (adminError) {
          // Don't fail the entire order if admin notification fails
          console.error("⚠️ Failed to notify admin:", adminError.message);
        }
        break;
      }

      case ACTIONS.DELIVERY_TRACKING:
        mockDeliveryUpdates(waId, sendTextMessage, action.prefix || "");
        break;

      default:
        console.warn("⚠️ Unknown action type:", action.type);
    }
  }
}

/**
 * Generate response based on message content.
 *
 * Sends everything itself and returns null, so the caller
 * (utils/whatsappUtils.js::processWhatsAppMessage) has nothing left to send.
 */
export async function generateResponse(messageBody, waId, name, message, isGroup = false) {
  try {
    const session = getSession(waId);

    // Update session if this is a group message
    if (isGroup && !session.isGroup) {
      session.isGroup = true;
      session.groupId = message.from; // Store the group ID
    }

    const actions = await runConversation({
      text: messageBody.trim().toLowerCase(),
      rawText: messageBody,
      session,
      isGroup,
      mention: name,
      deps: {
        Trophy,
        Order,
        generateInvoice,
        useLetterhead: config.USE_LETTERHEAD,
        letterheadPath: config.LETTERHEAD_PATH,
        adminNumber: config.ADMIN_NUMBER,
      },
    });

    await executeActions(actions, waId);
    return null;
  } catch (error) {
    console.error("❌ Error generating response:", error);
    return "⚠️ Sorry, something went wrong. Please try again.";
  }
}
