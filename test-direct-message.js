// test-direct-message.js - Test sending a message directly to the bot
import fetch from 'node-fetch';

const PHONE_NUMBER_ID = "776787372195136";
const ACCESS_TOKEN = "REDACTED_WHATSAPP_ACCESS_TOKEN";
const BOT_NUMBER = "918838975981";

async function sendTestMessage() {
  console.log("🧪 Sending test message directly to bot...");
  
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: BOT_NUMBER,
        type: "text",
        text: {
          body: "Hi from direct test - please respond!"
        }
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log("✅ Message sent successfully:", result);
      console.log("📱 Check your bot's WhatsApp for the message");
      console.log("📱 The bot should respond to this message");
    } else {
      console.log("❌ Failed to send message:", result);
    }
  } catch (error) {
    console.error("❌ Error sending message:", error);
  }
}

sendTestMessage();
