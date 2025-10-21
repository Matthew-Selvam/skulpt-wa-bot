// generate-credentials.js - Generate secure credentials for Meta API
import crypto from "crypto";

console.log("🔐 Generating secure credentials for Meta WhatsApp Business API...\n");

// Generate webhook verify token
const webhookVerifyToken = crypto.randomBytes(32).toString('hex');
console.log("📡 Webhook Verify Token:");
console.log(`WEBHOOK_VERIFY_TOKEN=${webhookVerifyToken}\n`);

// Generate webhook secret
const webhookSecret = crypto.randomBytes(32).toString('hex');
console.log("🔒 Webhook Secret:");
console.log(`WEBHOOK_SECRET=${webhookSecret}\n`);

// Generate MongoDB password
const mongoPassword = crypto.randomBytes(16).toString('base64').replace(/[+/=]/g, '');
console.log("🗄️ MongoDB Password:");
console.log(`MONGO_PASSWORD=${mongoPassword}\n`);

console.log("📋 Complete Environment Variables Template:");
console.log("=" .repeat(50));
console.log(`
# Database
MONGO_URI=mongodb+srv://trophybot:${mongoPassword}@cluster0.abc123.mongodb.net/trophybot?retryWrites=true&w=majority

# Bot Configuration
BOT_NUMBER=133097362333913
BOT_NAME=Skulpt

# Invoice Configuration
USE_LETTERHEAD=true
LETTERHEAD_PATH=./letterhead_template.png
COMPANY_NAME=THYNK UNLIMITED
COMPANY_TAGLINE=Creative Company

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=${webhookVerifyToken}
WEBHOOK_SECRET=${webhookSecret}

# WhatsApp Business API (Get from Meta Business Manager)
WHATSAPP_ACCESS_TOKEN=your_access_token_from_meta
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_from_meta
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_from_meta

# Server
PORT=10000
NODE_ENV=production

# Admin
ADMIN_NUMBER=your_admin_phone_number
`);
console.log("=" .repeat(50));

console.log("\n🎯 Next Steps:");
console.log("1. Copy the generated tokens above");
console.log("2. Follow META_API_SETUP.md to get Meta credentials");
console.log("3. Update the template with your Meta credentials");
console.log("4. Add to Render environment variables");
console.log("5. Deploy and test!");

console.log("\n⚠️  Security Notes:");
console.log("- Keep these credentials secure");
console.log("- Never commit them to GitHub");
console.log("- Store them safely in Render environment variables");
console.log("- Rotate tokens regularly");
