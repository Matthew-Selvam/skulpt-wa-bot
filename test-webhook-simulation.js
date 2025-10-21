// test-webhook-simulation.js - Simulate incoming message webhook
import fetch from 'node-fetch';

const WEBHOOK_URL = "https://skulpt.onrender.com/webhook";

async function simulateIncomingMessage() {
  console.log("🧪 Simulating incoming message webhook...");
  
  const webhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "840026788354094",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15556427430",
                phone_number_id: "776787372195136"
              },
              messages: [
                {
                  from: "15556427430",
                  id: "test_message_simulation",
                  timestamp: Math.floor(Date.now() / 1000),
                  text: {
                    body: "hi"
                  },
                  type: "text"
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    if (response.ok) {
      console.log("✅ Webhook simulation sent successfully");
      console.log("📱 Check your bot's WhatsApp for the response");
      console.log("🤖 Bot should respond with welcome message");
    } else {
      console.log("❌ Webhook simulation failed:", response.status);
    }
  } catch (error) {
    console.error("❌ Error sending webhook simulation:", error);
  }
}

simulateIncomingMessage();
