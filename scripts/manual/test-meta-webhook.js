// test-meta-webhook.js - Monitor for incoming message webhooks from Meta
import fetch from 'node-fetch';

const WEBHOOK_URL = "https://skulpt.onrender.com/webhook";

console.log("🔍 Monitoring for incoming message webhooks...");
console.log("📱 Go to Meta Business Manager → WhatsApp → Configuration → Webhook");
console.log("🧪 Click 'Test' button next to 'messages' field");
console.log("⏳ Waiting for webhook notifications...");

// Monitor webhook for 5 minutes
let messageCount = 0;
const startTime = Date.now();
const timeout = 5 * 60 * 1000; // 5 minutes

const checkWebhook = async () => {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Meta-Webhook-Test'
      }
    });
    
    if (response.ok) {
      console.log(`✅ Webhook is accessible (${new Date().toISOString()})`);
    } else {
      console.log(`❌ Webhook error: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Webhook check failed: ${error.message}`);
  }
};

// Check webhook every 30 seconds
const interval = setInterval(checkWebhook, 30000);

// Stop after timeout
setTimeout(() => {
  clearInterval(interval);
  console.log("⏰ Monitoring stopped after 5 minutes");
  console.log(`📊 Total webhook checks: ${Math.floor((Date.now() - startTime) / 30000)}`);
}, timeout);

console.log("🚀 Monitoring started...");