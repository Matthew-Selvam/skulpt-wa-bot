// debug-config.js - Debug configuration values
import { productionConfig } from './production-config.js';

console.log("🔍 Debugging Configuration:");
console.log("BOT_NUMBER:", productionConfig.BOT_NUMBER);
console.log("WHATSAPP_ACCESS_TOKEN:", productionConfig.WHATSAPP_ACCESS_TOKEN ? "SET" : "NOT SET");
console.log("WHATSAPP_PHONE_NUMBER_ID:", productionConfig.WHATSAPP_PHONE_NUMBER_ID);
console.log("WHATSAPP_BUSINESS_ACCOUNT_ID:", productionConfig.WHATSAPP_BUSINESS_ACCOUNT_ID);
console.log("WEBHOOK_VERIFY_TOKEN:", productionConfig.WEBHOOK_VERIFY_TOKEN ? "SET" : "NOT SET");
console.log("WEBHOOK_SECRET:", productionConfig.WEBHOOK_SECRET ? "SET" : "NOT SET");

// Check if token looks valid
const token = productionConfig.WHATSAPP_ACCESS_TOKEN;
if (token && token !== "your_whatsapp_access_token_here") {
  console.log("✅ Token appears to be set");
  console.log("Token length:", token.length);
  console.log("Token starts with:", token.substring(0, 10) + "...");
} else {
  console.log("❌ Token is not set or using default value");
}
