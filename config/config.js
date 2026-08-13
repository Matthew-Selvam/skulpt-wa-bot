// config/config.js - Configuration settings
import dotenv from "dotenv";

dotenv.config();

export const config = {
  // Webhook configuration
  VERIFY_TOKEN: process.env.WEBHOOK_VERIFY_TOKEN || "your_webhook_verify_token",
  APP_SECRET: process.env.WEBHOOK_SECRET || "your_webhook_secret",
  
  // WhatsApp API configuration
  ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  VERSION: process.env.WHATSAPP_API_VERSION || "v18.0",
  
  // Bot configuration
  BOT_NUMBER: process.env.BOT_NUMBER || "918838975981",
  BOT_NAME: process.env.BOT_NAME || "Skulpt",
  ADMIN_NUMBER: process.env.ADMIN_NUMBER,
  
  // Invoice configuration
  // `x === "true" || true` is always true — the env var was being ignored.
  // Still defaults to true, but USE_LETTERHEAD=false now actually disables it.
  USE_LETTERHEAD: process.env.USE_LETTERHEAD
    ? process.env.USE_LETTERHEAD === "true"
    : true,
  LETTERHEAD_PATH: process.env.LETTERHEAD_PATH || "./letterhead_template.png",
  COMPANY_NAME: process.env.COMPANY_NAME || "THYNK UNLIMITED",
  COMPANY_TAGLINE: process.env.COMPANY_TAGLINE || "Creative Company",
  
  // Database
  MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/trophybot",
  
  // Server
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
};
