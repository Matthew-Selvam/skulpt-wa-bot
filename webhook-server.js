// webhook-server.js - WhatsApp Business API Webhook Server
import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import { botHandler } from "./bot-handler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "your_webhook_verify_token";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "your_webhook_secret";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhook verification endpoint (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Webhook verification request:", { mode, token, challenge });

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Webhook verification failed");
    res.status(403).send("Forbidden");
  }
});

// Webhook message endpoint (POST)
app.post("/webhook", (req, res) => {
  const body = req.body;

  console.log("📩 Webhook message received:", JSON.stringify(body, null, 2));
  console.log("📩 Headers:", JSON.stringify(req.headers, null, 2));

  // Verify webhook signature (temporarily disabled for testing)
  const signature = req.headers["x-hub-signature-256"];
  if (signature && !verifyWebhookSignature(body, signature)) {
    console.log("⚠️ Invalid webhook signature - but continuing for testing");
    // return res.status(403).send("Forbidden");
  }

  // Handle different types of webhook events
  if (body.object === "whatsapp_business_account") {
    body.entry?.forEach((entry) => {
      entry.changes?.forEach((change) => {
        if (change.field === "messages") {
          change.value?.messages?.forEach((message) => {
            console.log("📨 Processing message:", message);
            // Process the message through bot handler
            botHandler(message, entry.id);
          });
        }
      });
    });
  }

  res.status(200).send("OK");
});

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({ 
    message: "TrophyBot Webhook Server is running!",
    status: "healthy", 
    timestamp: new Date().toISOString(),
    service: "WhatsApp Business API Webhook",
    endpoints: {
      webhook: "/webhook",
      health: "/health"
    }
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    service: "WhatsApp Business API Webhook"
  });
});

// Verify webhook signature
function verifyWebhookSignature(body, signature) {
  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest("hex");
  
  const expectedSignatureWithPrefix = `sha256=${expectedSignature}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignatureWithPrefix)
  );
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
  console.log(`📡 Webhook URL: https://skulpt.onrender.com/webhook`);
  console.log(`🔑 Verify Token: ${WEBHOOK_VERIFY_TOKEN}`);
  console.log(`💚 Health Check: https://skulpt.onrender.com/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Server started at: ${new Date().toISOString()}`);
  console.log(`🔧 Listening on: 0.0.0.0:${PORT}`);
  console.log(`🌐 Process.env.PORT: ${process.env.PORT}`);
  console.log(`🔧 Using port: ${PORT}`);
});

export default app;
