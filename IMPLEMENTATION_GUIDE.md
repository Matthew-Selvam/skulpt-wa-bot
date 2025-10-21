# WhatsApp Business API Bot - Express.js Implementation

This is an Express.js implementation of a WhatsApp Business API webhook bot, following the Flask workflow architecture. The bot handles trophy ordering with full e-commerce functionality.

## 🏗️ Architecture

```
WhatsApp Cloud API → Express App → Security Validation → Message Processing → Response
```

### Project Structure

```
skulpt/
├── app.js                          # Main Express application
├── config/
│   ├── config.js                   # Configuration settings
│   └── database.js                 # MongoDB setup
├── models/
│   ├── Trophy.js                   # Trophy model
│   └── Order.js                    # Order model
├── routes/
│   └── webhook.js                  # Webhook routes (GET & POST)
├── controllers/
│   └── webhookController.js        # Webhook controller (verify & handleMessage)
├── middlewares/
│   └── security.js                 # Signature validation middleware
├── services/
│   └── messageHandler.js           # Bot message processing logic
├── utils/
│   ├── whatsappUtils.js           # WhatsApp API utilities
│   ├── invoiceGenerator.js        # PDF invoice generation
│   └── deliveryTracker.js         # Mock delivery tracking
└── invoices/                       # Generated invoices directory
```

## 📋 Features

- ✅ **Webhook Verification** - GET /webhook endpoint for WhatsApp verification
- ✅ **Message Handling** - POST /webhook endpoint with signature validation
- ✅ **Security** - HMAC-SHA256 signature validation
- ✅ **Session Management** - User session tracking for multi-step conversations
- ✅ **Product Catalog** - Browse trophies from MongoDB
- ✅ **Shopping Cart** - Add items to cart
- ✅ **Customization** - Add custom text to products
- ✅ **Order Management** - Create and track orders
- ✅ **Invoice Generation** - PDF invoices with optional letterhead
- ✅ **Delivery Tracking** - Mock delivery updates via Porter
- ✅ **Admin Notifications** - Notify admin on new orders

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- WhatsApp Business Account
- Meta Developer Account

### Installation

1. **Clone the repository**
```bash
cd skulpt
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file:

```env
# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token_here
WEBHOOK_SECRET=your_webhook_secret_here

# WhatsApp API Configuration
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_API_VERSION=v18.0

# Bot Configuration
BOT_NUMBER=918838975981
BOT_NAME=Skulpt
ADMIN_NUMBER=919876543210

# Invoice Configuration
USE_LETTERHEAD=true
LETTERHEAD_PATH=./letterhead_template.png
COMPANY_NAME=THYNK UNLIMITED
COMPANY_TAGLINE=Creative Company

# Database
MONGO_URI=mongodb://127.0.0.1:27017/trophybot

# Server
PORT=3000
NODE_ENV=development
```

4. **Start the server**

```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 API Endpoints

### GET /webhook - Webhook Verification

**Purpose:** WhatsApp verification during initial setup

**Query Parameters:**
- `hub.mode` - Should be "subscribe"
- `hub.verify_token` - Your verification token
- `hub.challenge` - Random string to echo back

**Example:**
```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=your_token&hub.challenge=test123"
# Returns: test123
```

### POST /webhook - Message Handling

**Purpose:** Receives incoming messages and events from WhatsApp

**Security:** Protected by signature validation middleware

**Headers Required:**
- `Content-Type: application/json`
- `X-Hub-Signature-256: sha256=<computed_signature>`

**Handles:**
- Incoming text messages
- Status updates (sent, delivered, read)
- Media messages (extensible)

### GET / - Root Endpoint

Returns server information and available endpoints.

### GET /health - Health Check

Returns server health status.

## 🔒 Security Features

### 1. HMAC Signature Validation

All POST requests to `/webhook` are validated using HMAC-SHA256:

```javascript
// middlewares/security.js
export function signatureRequired(req, res, next) {
  const signature = req.headers["x-hub-signature-256"];
  
  if (!validateSignature(req.body, signature)) {
    return res.status(403).json({ 
      status: "error", 
      message: "Invalid signature" 
    });
  }
  
  next();
}
```

### 2. Token Verification

Webhook setup requires matching verification token.

### 3. Constant-Time Comparison

Uses `crypto.timingSafeEqual()` to prevent timing attacks.

## 💬 Bot Conversation Flow

### Step 1: Welcome
User: `hi`
Bot: Welcome message with instructions

### Step 2: Browse
User: `browse`
Bot: Shows available trophies with prices

### Step 3: Selection
User: `1` (selects trophy #1)
Bot: Adds to cart, asks for customization

### Step 4: Customization
User: `Best Employee 2024`
Bot: Saves customization, asks to checkout

### Step 5: Checkout
User: `checkout`
Bot: Shows order summary

### Step 6: Payment
User: `pay`
Bot: Confirms order, generates invoice, starts delivery tracking

## 📱 Bot Commands

| Command | Description |
|---------|-------------|
| `hi`, `hello` | Greeting and welcome message |
| `browse` | View available trophies |
| `help` | Show command menu |
| `status` | Check order status |
| `reset` | Reset session and start over |

## 🔄 Message Processing Flow

```
1. WhatsApp User sends message
        ↓
2. WhatsApp Cloud API → POST /webhook (with signature)
        ↓
3. @signatureRequired validates HMAC-SHA256 signature
        ↓
4. handleMessage() receives request
        ↓
5. Check if status update? → Skip processing
        ↓
6. isValidWhatsAppMessage()? → Validate structure
        ↓
7. processWhatsAppMessage() extracts:
   - wa_id (sender's WhatsApp ID)
   - name (sender's name)
   - message_body (message text)
        ↓
8. generateResponse() → Bot logic (services/messageHandler.js)
        ↓
9. sendMessage() → Send via WhatsApp Cloud API
        ↓
10. Return {"status": "ok"} to WhatsApp
        ↓
11-13. WhatsApp sends status updates (sent, delivered, read)
       Each returns {"status": "ok"} without processing
```

## 🧪 Testing

### Local Testing with ngrok

1. **Start ngrok**
```bash
ngrok http 3000
```

2. **Configure webhook in Meta Developer Console**
```
Callback URL: https://<your-ngrok-id>.ngrok.io/webhook
Verify Token: your_webhook_verify_token
```

### Manual Testing

**Test Verification:**
```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=your_token&hub.challenge=test123"
```

**Test Message Processing:**
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=<computed_signature>" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "contacts": [{"wa_id": "1234567890", "profile": {"name": "Test User"}}],
          "messages": [{"from": "1234567890", "text": {"body": "hello"}}]
        }
      }]
    }]
  }'
```

## 🛠️ Customization

### 1. Modify Bot Logic

Edit `services/messageHandler.js` to customize conversation flow:

```javascript
export async function generateResponse(messageBody, waId, name, message) {
  // Add your custom logic here
  // Examples:
  // - Integrate with AI/ML models
  // - Connect to CRM systems
  // - Add payment gateway integration
  // - Implement advanced product search
}
```

### 2. Add Rich Media Support

Extend `utils/whatsappUtils.js` to support:
- Images
- Videos
- Documents
- Location messages
- Interactive buttons
- List messages

### 3. Database Integration

Models are in `models/` directory. Add new models as needed:

```javascript
// models/Customer.js
import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema({
  waId: { type: String, required: true, unique: true },
  name: String,
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }]
});

export const Customer = mongoose.model("Customer", CustomerSchema);
```

## 📦 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WEBHOOK_VERIFY_TOKEN` | ✅ | Token for webhook verification |
| `WEBHOOK_SECRET` | ✅ | Secret for HMAC signature validation |
| `WHATSAPP_ACCESS_TOKEN` | ✅ | WhatsApp API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ | Your WhatsApp Business phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ❌ | Business account ID (optional) |
| `WHATSAPP_API_VERSION` | ❌ | API version (default: v18.0) |
| `BOT_NUMBER` | ❌ | Bot's WhatsApp number |
| `BOT_NAME` | ❌ | Bot name for mentions |
| `ADMIN_NUMBER` | ❌ | Admin WhatsApp number for notifications |
| `MONGO_URI` | ❌ | MongoDB connection string |
| `PORT` | ❌ | Server port (default: 3000) |

## 🐛 Debugging

Enable detailed logging by checking console output:

```bash
# Start with verbose logging
DEBUG=* npm start
```

**Log Categories:**
- 🔍 Verification requests
- 📩 Incoming webhooks
- 📨 Message processing
- 📤 Outgoing messages
- ❌ Errors
- ✅ Successes

## 🚀 Deployment

### Deploy to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure environment variables
4. Deploy!

### Deploy to Heroku

```bash
heroku create your-bot-name
heroku config:set WEBHOOK_VERIFY_TOKEN=your_token
heroku config:set WEBHOOK_SECRET=your_secret
# ... set other env variables
git push heroku main
```

## 📚 References

- [WhatsApp Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Webhook Security](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
- [Message Types](https://developers.facebook.com/docs/whatsapp/cloud-api/messages)
- [Express.js Documentation](https://expressjs.com/)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License

## 👥 Support

For issues and questions, please open an issue on GitHub.
