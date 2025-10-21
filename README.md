# 🏆 TrophyBot - WhatsApp Business API

A professional WhatsApp bot for trophy orders with group support, invoice generation, and delivery tracking.

## ✨ Features

- **Group Support**: Works in WhatsApp groups with @ mentions
- **Order Management**: Complete ordering flow from browse to payment
- **Invoice Generation**: Professional PDF invoices with letterhead support
- **Delivery Tracking**: Mock Porter delivery integration
- **Multi-User**: Individual sessions for each user
- **Production Ready**: WhatsApp Business API integration

## 🚀 Quick Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Click the "Deploy to Render" button above
2. Connect your GitHub account
3. Configure environment variables
4. Deploy!

## 📋 Prerequisites

- WhatsApp Business API access (Meta Business account)
- MongoDB database (MongoDB Atlas recommended)
- Render account (free tier available)

## 🛠️ Local Development

### Installation
```bash
npm install
```

### Development Mode
```bash
npm run dev
```

### Webhook Mode
```bash
npm run start:webhook
```

### Production Mode
```bash
npm run start:production
```

## 🔧 Environment Variables

```env
# Database
MONGO_URI=mongodb://localhost:27017/trophybot

# Bot Configuration
BOT_NUMBER=your_whatsapp_business_number
BOT_NAME=Skulpt

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=your_secure_webhook_verify_token
WEBHOOK_SECRET=your_webhook_secret

# WhatsApp Business API
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id

# Invoice Configuration
USE_LETTERHEAD=true
LETTERHEAD_PATH=./letterhead_template.png
COMPANY_NAME=THYNK UNLIMITED
COMPANY_TAGLINE=Creative Company
```

## 📱 Usage

### Group Chat
```
@skulpt browse
@skulpt 1
@skulpt "Custom text"
@skulpt checkout
@skulpt pay
```

### Direct Message
```
browse
1
"Custom text"
checkout
pay
```

## 🏗️ Architecture

- **webhook-server.js**: Main webhook server for Meta API
- **bot-handler.js**: Message processing logic
- **whatsapp-api-client.js**: WhatsApp Business API client
- **bot.js**: Development mode (QR code)

## 📚 Documentation

- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [Render Deployment](RENDER_DEPLOYMENT.md) - Deploy to Render platform
- [Invoice Setup](README_INVOICE.md) - Letterhead invoice configuration

## 🔒 Security

- Webhook signature verification
- Environment variable protection
- HTTPS required for production
- Input validation and sanitization

## 📊 Monitoring

- Health check endpoint: `/health`
- Webhook verification: `/webhook`
- Real-time logging
- Error tracking

## 🚀 Deployment Options

### Render (Recommended)
- Free tier available
- HTTPS included
- Easy GitHub integration
- Auto-deployment

### Other Platforms
- Heroku
- Railway
- DigitalOcean
- AWS EC2
- Google Cloud

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Check logs in Render dashboard
- Verify environment variables
- Test webhook endpoints
- Review Meta API documentation

## 🎯 Roadmap

- [ ] Porter API integration
- [ ] Payment gateway integration
- [ ] Multi-language support
- [ ] Analytics dashboard
- [ ] Admin panel

---

**Made with ❤️ by THYNK UNLIMITED**
