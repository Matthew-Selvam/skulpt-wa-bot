# WhatsApp Business API Deployment Guide

## Overview
This guide will help you deploy your TrophyBot to production using WhatsApp Business API instead of the QR code method.

## Prerequisites
- WhatsApp Business API access (Meta Business account)
- Server with public IP/domain
- MongoDB database
- SSL certificate (HTTPS required)

## Step 1: Meta Business API Setup

### 1.1 Get WhatsApp Business API Access
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use existing
3. Add WhatsApp Business API product
4. Complete verification process

### 1.2 Get Required Credentials
You'll need these from Meta Business Manager:
- **Access Token**: For API authentication
- **Phone Number ID**: Your business phone number ID
- **Business Account ID**: Your WhatsApp Business account ID
- **Webhook Verify Token**: Custom token for webhook verification
- **Webhook Secret**: For signature verification

## Step 2: Server Setup

### 2.1 Install Dependencies
```bash
npm install
```

### 2.2 Environment Variables
Create a `.env` file with:
```env
# Database
MONGO_URI=mongodb://your-mongodb-connection-string

# Bot Configuration
BOT_NUMBER=your_whatsapp_business_number
BOT_NAME=Skulpt

# Invoice Configuration
USE_LETTERHEAD=true
LETTERHEAD_PATH=./letterhead_template.png
COMPANY_NAME=THYNK UNLIMITED
COMPANY_TAGLINE=Creative Company

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=your_secure_webhook_verify_token
WEBHOOK_SECRET=your_webhook_secret

# WhatsApp Business API
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id

# Server
PORT=3000
NODE_ENV=production

# Admin
ADMIN_NUMBER=your_admin_phone_number
```

## Step 3: Webhook Configuration

### 3.1 Deploy Webhook Server
```bash
npm run start:production
```

### 3.2 Configure Webhook URL in Meta
1. Go to WhatsApp Manager
2. Navigate to Configuration → Webhook
3. Set webhook URL: `https://your-domain.com/webhook`
4. Set verify token: (same as WEBHOOK_VERIFY_TOKEN in .env)
5. Subscribe to `messages` events

### 3.3 Test Webhook
```bash
curl -X GET "https://your-domain.com/webhook?hub.mode=subscribe&hub.verify_token=your_verify_token&hub.challenge=test_challenge"
```

## Step 4: Database Setup

### 4.1 MongoDB Configuration
- Use MongoDB Atlas (cloud) or self-hosted
- Ensure database is accessible from your server
- Create indexes for better performance

### 4.2 Sample Data
The bot will automatically create sample trophies on first run.

## Step 5: File Structure
```
project/
├── webhook-server.js          # Main webhook server
├── bot-handler.js             # Message processing logic
├── whatsapp-api-client.js     # WhatsApp API client
├── production-config.js       # Production configuration
├── letterhead_template.png    # Invoice letterhead
├── invoice_*.pdf             # Generated invoices
└── .env                      # Environment variables
```

## Step 6: Deployment Options

### 6.1 Cloud Platforms
- **Heroku**: Easy deployment with add-ons
- **Railway**: Simple Node.js deployment
- **DigitalOcean**: VPS with Docker
- **AWS EC2**: Full control and scalability
- **Google Cloud**: Managed services

### 6.2 Docker Deployment
Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:production"]
```

### 6.3 PM2 Process Manager
```bash
npm install -g pm2
pm2 start webhook-server.js --name "trophybot"
pm2 startup
pm2 save
```

## Step 7: Testing

### 7.1 Health Check
```bash
curl https://your-domain.com/health
```

### 7.2 Send Test Message
Use Meta's API testing tools or Postman to send test messages.

### 7.3 Monitor Logs
```bash
pm2 logs trophybot
# or
docker logs your-container-name
```

## Step 8: Production Checklist

- [ ] SSL certificate installed
- [ ] Environment variables configured
- [ ] Webhook URL verified
- [ ] Database connected
- [ ] Sample data loaded
- [ ] Health check responding
- [ ] Error monitoring setup
- [ ] Backup strategy in place
- [ ] Log rotation configured
- [ ] Performance monitoring

## Step 9: Monitoring & Maintenance

### 9.1 Logs
- Monitor webhook logs for errors
- Track message processing times
- Monitor database performance

### 9.2 Alerts
- Set up alerts for webhook failures
- Monitor server resources
- Track API rate limits

### 9.3 Updates
- Regular security updates
- WhatsApp API version updates
- Bot feature enhancements

## Troubleshooting

### Common Issues
1. **Webhook verification fails**: Check verify token
2. **Messages not received**: Verify webhook URL and events
3. **API errors**: Check access token and permissions
4. **Database errors**: Verify connection string
5. **File upload issues**: Check file permissions

### Debug Commands
```bash
# Check webhook status
curl -X GET "https://your-domain.com/webhook?hub.mode=subscribe&hub.verify_token=your_token&hub.challenge=test"

# Test health endpoint
curl https://your-domain.com/health

# Check logs
pm2 logs trophybot --lines 100
```

## Security Considerations

1. **Environment Variables**: Never commit .env files
2. **Webhook Security**: Use HTTPS and verify signatures
3. **API Tokens**: Rotate tokens regularly
4. **Database**: Use connection encryption
5. **Server**: Keep OS and dependencies updated

## Support

For issues with:
- **WhatsApp API**: Check Meta Developer documentation
- **Bot Logic**: Review bot-handler.js
- **Deployment**: Check server logs and configuration
- **Database**: Verify MongoDB connection and queries

## Next Steps

1. **Porter API Integration**: Add real delivery tracking
2. **Payment Gateway**: Integrate payment processing
3. **Analytics**: Add user behavior tracking
4. **Scaling**: Implement load balancing for high traffic
5. **Multi-language**: Add support for multiple languages

Your TrophyBot is now ready for production deployment! 🏆
