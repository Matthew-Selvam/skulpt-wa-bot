// test-meta-message-receipt.js - Test if Meta is receiving messages
import 'dotenv/config';
import fetch from 'node-fetch';

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
  console.error("❌ Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in your .env first.");
  process.exit(1);
}

async function testMessageReceipt() {
  console.log("🔍 Testing if Meta is receiving messages...");
  
  try {
    // Get phone number info
    const response = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log("✅ Phone number info retrieved successfully:");
      console.log("Display phone number:", result.display_phone_number);
      console.log("Phone number ID:", result.id);
      console.log("Status:", result.status);
      console.log("Quality rating:", result.quality_rating);
      console.log("Platform type:", result.platform_type);
      console.log("Messaging product:", result.messaging_product);
      
      if (result.quality_rating) {
        console.log("⚠️ Quality rating details:");
        console.log("- Code:", result.quality_rating.code);
        console.log("- Name:", result.quality_rating.name);
      }
      
    } else {
      console.log("❌ Failed to get phone number info:");
      console.log(JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.log("❌ Error:", error.message);
  }
}

testMessageReceipt();
