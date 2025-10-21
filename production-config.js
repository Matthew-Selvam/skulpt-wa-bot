// production-config.js - Production Configuration for WhatsApp Business API

export const productionConfig = {
  // Database
  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/trophybot",
  
  // Bot Configuration
  BOT_NUMBER: process.env.BOT_NUMBER || "918838975981",
  BOT_NAME: process.env.BOT_NAME || "Skulpt",
  
  // Invoice Configuration
  USE_LETTERHEAD: process.env.USE_LETTERHEAD === "true" || true,
  LETTERHEAD_PATH: process.env.LETTERHEAD_PATH || "./letterhead_template.png",
  COMPANY_NAME: process.env.COMPANY_NAME || "THYNK UNLIMITED",
  COMPANY_TAGLINE: process.env.COMPANY_TAGLINE || "Creative Company",
  
  // Webhook Configuration
  WEBHOOK_VERIFY_TOKEN: process.env.WEBHOOK_VERIFY_TOKEN || "your_secure_webhook_verify_token_here",
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || "your_webhook_secret_here",
  
  // WhatsApp Business API Configuration
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || "your_whatsapp_access_token_here",
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || "your_phone_number_id_here",
  WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "your_business_account_id_here",
  
  // Server Configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "production",
  
  // Admin Configuration
  ADMIN_NUMBER: process.env.ADMIN_NUMBER || "your_admin_phone_number",
  
  // Porter API Configuration (for future integration)
  PORTER_API_KEY: process.env.PORTER_API_KEY || "your_porter_api_key_here",
  PORTER_API_URL: process.env.PORTER_API_URL || "https://api.porter.in",
  
  // Payment Gateway Configuration (for future integration)
  PAYMENT_GATEWAY_API_KEY: process.env.PAYMENT_GATEWAY_API_KEY || "your_payment_gateway_api_key_here",
  PAYMENT_GATEWAY_URL: process.env.PAYMENT_GATEWAY_URL || "https://api.payment-gateway.com"
};

export default productionConfig;
