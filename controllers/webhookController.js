// controllers/webhookController.js - Webhook controller (Flask views.py equivalent)
import { config } from "../config/config.js";
import { 
  isValidWhatsAppMessage, 
  processWhatsAppMessage 
} from "../utils/whatsappUtils.js";

/**
 * Webhook verification endpoint (GET /webhook)
 * Equivalent to Flask's verify() function in views.py
 * 
 * WhatsApp sends a GET request with:
 * - hub.mode = "subscribe"
 * - hub.verify_token = your configured token
 * - hub.challenge = random string to echo back
 */
export function verify(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Webhook verification request:", { mode, token, challenge });

  // Validate parameters
  if (!mode || !token || !challenge) {
    console.log("❌ Missing verification parameters");
    return res.status(400).json({
      status: "error",
      message: "Missing parameters",
    });
  }

  // Validate token
  if (mode === "subscribe" && token === config.VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    return res.status(200).send(challenge);
  } else {
    console.log("❌ Webhook verification failed - token mismatch");
    return res.status(403).json({
      status: "error",
      message: "Verification failed",
    });
  }
}

/**
 * Message handling endpoint (POST /webhook)
 * Equivalent to Flask's handle_message() function in views.py
 * Protected by @signatureRequired decorator (like Flask's @signature_required)
 * 
 * Handles incoming WhatsApp messages and status updates
 */
export async function handleMessage(req, res) {
  try {
    const body = req.body;

    console.log("📩 Webhook received:", JSON.stringify(body, null, 2));

    // Check if this is a status update (sent, delivered, read)
    // Status updates don't need processing - just acknowledge
    const isStatusUpdate = body?.entry?.[0]?.changes?.[0]?.value?.statuses;
    
    if (isStatusUpdate) {
      console.log("📊 Received a WhatsApp status update");
      return res.status(200).json({ status: "ok" });
    }

    // Validate WhatsApp message structure
    if (!isValidWhatsAppMessage(body)) {
      console.log("❌ Not a valid WhatsApp API event");
      return res.status(404).json({
        status: "error",
        message: "Not a WhatsApp API event",
      });
    }

    // Process the message
    await processWhatsAppMessage(body);

    // Always return 200 OK to WhatsApp
    return res.status(200).json({ status: "ok" });

  } catch (error) {
    console.error("❌ Error handling message:", error);
    
    // Return appropriate error status
    if (error.name === "SyntaxError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid JSON provided",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}
