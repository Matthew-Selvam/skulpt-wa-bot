# 🚀 Quick Start Guide

Get your WhatsApp Business API bot running in 5 minutes!

## 📋 Prerequisites

- Node.js v18+ installed
- MongoDB running locally or remote URI
- WhatsApp Business Account (via Meta)
- ngrok (for local testing) or deployed server

## ⚡ Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Minimum required configuration
WEBHOOK_VERIFY_TOKEN=my_secret_verify_token_123
WEBHOOK_SECRET=my_secret_webhook_key_456
WHATSAPP_ACCESS_TOKEN=your_access_token_from_meta
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
```

### 3. Start MongoDB

```bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas (cloud)
# Just update MONGO_URI in .env
```

### 4. Start the Server

```bash
npm run start:app
```

You should see:
```
✅ Connected to MongoDB
✅ Sample trophies added to database
🚀 Webhook server running on port 3000
📡 Webhook URL: http://localhost:3000/webhook
```

### 5. Expose with ngrok (for testing)

In a new terminal:

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 6. Configure WhatsApp Webhook

1. Go to [Meta Developer Console](https://developers.facebook.com/apps)
2. Select your app → WhatsApp → Configuration
3. Click "Edit" on Webhook
4. Enter:
   - **Callback URL**: `https://abc123.ngrok.io/webhook`
   - **Verify Token**: `my_secret_verify_token_123` (from your .env)
5. Click "Verify and Save"
6. Subscribe to `messages` field

### 7. Test Your Bot! 🎉

Send a WhatsApp message to your business number:

```
You: hi
Bot: 👋 Hello! Welcome to TrophyBot! 🏆
     I can help you:
     • Browse our trophy collection
     • Place custom orders
     • Track your deliveries
     
     Type *browse* to see our trophies or *help* for more options!

You: browse
Bot: 🏆 *Available Trophies:*
     
     1. 🏆 Golden Trophy - *₹1500*
     2. 🥇 Silver Medal - *₹800*
     3. 🏅 Bronze Medal - *₹500*
     ...
```

## 🛠️ Available Scripts

```bash
# Start the new Express app (WhatsApp Business API)
npm run start:app

# Start with auto-reload (development)
npm run dev:app

# Start the old whatsapp-web.js bot
npm start

# Start the basic webhook server
npm run start:webhook

# Production mode
npm run start:production
```

## 📁 Project Structure

```
skulpt/
├── app.js                    # 👈 Main Express application (START HERE)
├── config/
│   ├── config.js            # Configuration
│   └── database.js          # MongoDB setup
├── routes/
│   └── webhook.js           # Webhook routes
├── controllers/
│   └── webhookController.js # Request handlers
├── middlewares/
│   └── security.js          # Signature validation
├── services/
│   └── messageHandler.js    # Bot logic
├── utils/
│   ├── whatsappUtils.js     # WhatsApp API
│   ├── invoiceGenerator.js  # PDF generation
│   └── deliveryTracker.js   # Delivery updates
└── models/
    ├── Trophy.js            # Trophy model
    └── Order.js             # Order model
```

## 🔍 Debugging

### Check if server is running:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-21T...",
  "service": "WhatsApp Business API Webhook"
}
```

### Test webhook verification:
```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=my_secret_verify_token_123&hub.challenge=test123"
```

Expected response:
```
test123
```

### Check logs:

Server logs show:
- ✅ Successful operations
- ❌ Errors
- 🔍 Verification requests
- 📩 Incoming webhooks
- 📨 Message processing
- 📤 Outgoing messages

## 🐛 Common Issues

### Issue: "MongoDB connection error"
**Solution**: 
```bash
# Start MongoDB
mongod

# Or use MongoDB Atlas and update MONGO_URI in .env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/trophybot
```

### Issue: "Webhook verification failed"
**Solution**: Make sure `WEBHOOK_VERIFY_TOKEN` in `.env` matches the token in Meta Developer Console

### Issue: "Invalid signature"
**Solution**: Make sure `WEBHOOK_SECRET` is set correctly. For testing, signature validation is logged but won't block requests.

### Issue: "Cannot send message"
**Solution**: 
1. Check `WHATSAPP_ACCESS_TOKEN` is valid
2. Check `WHATSAPP_PHONE_NUMBER_ID` is correct
3. Verify your WhatsApp Business Account is active

### Issue: Port 3000 already in use
**Solution**: 
```bash
# Change PORT in .env
PORT=8080

# Or kill the process using port 3000
lsof -ti:3000 | xargs kill -9
```

## 🔐 Security Checklist

- ✅ Never commit `.env` file
- ✅ Use strong `WEBHOOK_SECRET` (min 32 characters)
- ✅ Use HTTPS in production (ngrok provides this)
- ✅ Keep `WHATSAPP_ACCESS_TOKEN` secret
- ✅ Enable signature validation in production

## 🚀 Deployment

### Deploy to Render.com

1. Push code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. New → Web Service
4. Connect repository
5. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:app`
6. Add environment variables (from .env)
7. Deploy!

### Deploy to Heroku

```bash
heroku create your-bot-name
heroku config:set WEBHOOK_VERIFY_TOKEN=your_token
heroku config:set WEBHOOK_SECRET=your_secret
heroku config:set WHATSAPP_ACCESS_TOKEN=your_token
heroku config:set WHATSAPP_PHONE_NUMBER_ID=your_phone_id
git push heroku main
```

## 📚 Next Steps

1. **Customize bot logic**: Edit `services/messageHandler.js`
2. **Add new products**: Insert into MongoDB or modify `config/database.js`
3. **Customize invoice**: Edit `utils/invoiceGenerator.js`
4. **Add payment gateway**: Integrate in `services/messageHandler.js`
5. **Add analytics**: Track events in message handler
6. **Scale up**: Use Redis for sessions, add load balancer

## 📖 Documentation

- [Implementation Guide](./IMPLEMENTATION_GUIDE.md) - Full documentation
- [Flask to Express Mapping](./FLASK_TO_EXPRESS_MAPPING.md) - Architecture comparison
- [WhatsApp API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)

## 💡 Tips

- Use `npm run dev:app` for development (with nodemon auto-reload)
- Check server logs frequently for debugging
- Test locally with ngrok before deploying
- Keep Meta Developer Console open to see webhook delivery logs
- Use WhatsApp Test Numbers for testing before going live

## 🆘 Need Help?

1. Check the logs in terminal
2. Review [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
3. Check WhatsApp API documentation
4. Open an issue on GitHub

---

**You're all set! Happy building! 🎉**
