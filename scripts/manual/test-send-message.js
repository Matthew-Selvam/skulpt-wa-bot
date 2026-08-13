// test-send-message.js - Test sending a message directly to the bot
import fetch from 'node-fetch';
import { productionConfig } from './production-config.js';

const BOT_NUMBER = "918838975981";
const TEST_MESSAGE = "Hi from test script";

async function testSendMessage() {
  console.log("🧪 Testing direct message send to bot...");
  
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${productionConfig.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${productionConfig.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: BOT_NUMBER,
        type: "text",
        text: {
          body: TEST_MESSAGE
        }
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log("✅ Message sent successfully:", result);
    } else {
      console.log("❌ Failed to send message:", result);
    }
  } catch (error) {
    console.error("❌ Error sending message:", error);
  }
}

testSendMessage();
