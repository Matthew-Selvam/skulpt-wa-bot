// test-webhook.js - Test webhook server locally
import fetch from "node-fetch";

const WEBHOOK_URL = "http://localhost:3000/webhook";
const VERIFY_TOKEN = "your_webhook_verify_token_here";

async function testWebhookVerification() {
  console.log("🧪 Testing webhook verification...");
  
  try {
    const response = await fetch(`${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test_challenge`);
    const result = await response.text();
    
    if (response.ok && result === "test_challenge") {
      console.log("✅ Webhook verification successful!");
    } else {
      console.log("❌ Webhook verification failed:", result);
    }
  } catch (error) {
    console.error("❌ Error testing webhook:", error.message);
  }
}

async function testHealthCheck() {
  console.log("🏥 Testing health check...");
  
  try {
    const response = await fetch("http://localhost:3000/health");
    const result = await response.json();
    
    if (response.ok) {
      console.log("✅ Health check successful:", result);
    } else {
      console.log("❌ Health check failed:", result);
    }
  } catch (error) {
    console.error("❌ Error testing health check:", error.message);
  }
}

async function testWebhookMessage() {
  console.log("📩 Testing webhook message...");
  
  const testMessage = {
    object: "whatsapp_business_account",
    entry: [{
      id: "test_business_account_id",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "1234567890",
            phone_number_id: "test_phone_number_id"
          },
          messages: [{
            from: "1234567890",
            id: "test_message_id",
            timestamp: Date.now().toString(),
            text: {
              body: "hi @skulpt browse"
            },
            type: "text"
          }]
        },
        field: "messages"
      }]
    }]
  };
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(testMessage)
    });
    
    const result = await response.text();
    
    if (response.ok && result === "OK") {
      console.log("✅ Webhook message test successful!");
    } else {
      console.log("❌ Webhook message test failed:", result);
    }
  } catch (error) {
    console.error("❌ Error testing webhook message:", error.message);
  }
}

async function runTests() {
  console.log("🚀 Starting webhook tests...\n");
  
  await testHealthCheck();
  console.log("");
  
  await testWebhookVerification();
  console.log("");
  
  await testWebhookMessage();
  console.log("");
  
  console.log("✨ Tests completed!");
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { testWebhookVerification, testHealthCheck, testWebhookMessage };
