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

## 📣 Client Management & Recurring Outreach

Track past clients, log their events, and automatically message them before each event asking whether they need trophies or products.

### Quick start

1. Add `ADMIN_NUMBER` and `ADMIN_PASSWORD` to your environment
2. Restart the server — the scheduler starts automatically
3. Run `sync clients` (WhatsApp) or click **Sync orders** (dashboard) to import past customers
4. Add clients + their events (WhatsApp command or `/admin` dashboard)
5. Reminders go out automatically `REMINDER_DAYS_BEFORE` days before each event
6. Client replies (`yes` / `no` / anything) are captured, logged, and forwarded to the admin — a `yes` also starts the ordering flow

### Admin WhatsApp commands (from `ADMIN_NUMBER`)

| Command | What it does |
|---|---|
| `add client <phone> <name>` | Add a client (updates name if they exist) |
| `clients` / `client <phone>` | List clients / show details |
| `remove client <phone>` | Delete a client |
| `add event <phone> <YYYY-MM-DD> <name>` | Schedule an event for a client |
| `events <phone>` | List a client's events |
| `remove event <phone> <name>` | Delete an event |
| `pause <phone>` / `resume <phone>` | Stop / resume reminders for a client |
| `outreach on` / `off` / `run` / `status` | Control the scheduler |
| `sync clients` | Import clients from past orders |

### Web dashboard

Open `/admin` on your server for the full management UI (clients, events, reminders, lead replies, outreach toggle).

### New environment variables

```env
# Admin
ADMIN_NUMBER=91XXXXXXXXXX        # receives lead alerts + can use admin commands
ADMIN_PASSWORD=your_admin_password  # protects the /admin dashboard (default: changeme)

# Outreach scheduler
OUTREACH_ENABLED=true            # set to false to disable the scheduler at boot
REMINDER_DAYS_BEFORE=7           # first reminder N days before the event
MAX_REMINDERS=2                  # max reminders per event
REMINDER_COOLDOWN_DAYS=2         # min days between reminders
REPLY_WINDOW_DAYS=30             # how long a client reply is treated as an outreach reply
OUTREACH_CHECK_INTERVAL_MS=3600000  # how often the scheduler checks (ms)
OUTREACH_TEMPLATE_NAME=          # optional approved Meta template for outreach

# Webhook security (recommended in production)
ENFORCE_WEBHOOK_SIGNATURE=true   # reject webhook requests with an invalid HMAC signature
```

> **Production note:** WhatsApp only allows free-form messages inside the 24-hour customer-service window. To reach clients who haven't messaged recently, create an approved **template message** on Meta (e.g. with `{{1}}` = name, `{{2}}` = event, `{{3}}` = date) and set its name via `OUTREACH_TEMPLATE_NAME`. The bot falls back to free-form text when no template is set (fine for dev/testing).

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
