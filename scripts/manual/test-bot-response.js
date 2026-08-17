// test-bot-response.js - Test if bot responds to messages
import 'dotenv/config';
import fetch from 'node-fetch';

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const BOT_NUMBER = process.env.BOT_NUMBER;

if (!PHONE_NUMBER_ID || !ACCESS_TOKEN || !BOT_NUMBER) {
  console.error("❌ Set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, and BOT_NUMBER in your .env first.");
  process.exit(1);
}

async function testBotResponse() {
  console.log("🤖 Testing bot response...");
  
  try {
    // Send a message that should trigger bot response
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
          body: "hi"
        }
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log("✅ Message sent successfully:", result);
      console.log("📱 Check your bot's WhatsApp for the 'hi' message");
      console.log("🤖 The bot should respond with welcome message");
      console.log("⏰ Wait 10-15 seconds for the response");
    } else {
      console.log("❌ Failed to send message:", result);
    }
  } catch (error) {
    console.error("❌ Error sending message:", error);
  }
}

testBotResponse();
