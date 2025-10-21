# Deploy TrophyBot to Render

## Overview
This guide will help you deploy your TrophyBot to Render, a free hosting platform that's perfect for WhatsApp Business API webhooks.

## Why Render?
- ✅ **Free Tier Available**: Perfect for getting started
- ✅ **HTTPS Included**: Required for WhatsApp webhooks
- ✅ **Easy Deployment**: Connect GitHub and auto-deploy
- ✅ **Environment Variables**: Secure configuration
- ✅ **Health Checks**: Built-in monitoring
- ✅ **Custom Domains**: Professional URLs

## Step 1: Prepare Your Repository

### 1.1 Create GitHub Repository
1. Go to [GitHub](https://github.com) and create a new repository
2. Name it `trophybot` or similar
3. Make it public (required for free Render)

### 1.2 Push Your Code
```bash
git init
git add .
git commit -m "Initial commit: TrophyBot for WhatsApp Business API"
git branch -M main
git remote add origin https://github.com/yourusername/trophybot.git
git push -u origin main
```

## Step 2: Render Setup

### 2.1 Create Render Account
1. Go to [Render](https://render.com)
2. Sign up with GitHub
3. Connect your GitHub account

### 2.2 Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Select your `trophybot` repository
4. Choose "Deploy from GitHub"

### 2.3 Configure Service
- **Name**: `trophybot-webhook`
- **Environment**: `Node`
- **Region**: `Oregon (US West)` (closest to most users)
- **Branch**: `main`
- **Root Directory**: Leave empty
- **Build Command**: `npm install`
- **Start Command**: `npm run start:production`

## Step 3: Environment Variables

### 3.1 Add Environment Variables in Render
Go to your service → Environment tab and add:

```env
# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/trophybot

# Bot Configuration
BOT_NUMBER=133097362333913
BOT_NAME=Skulpt

# Invoice Configuration
USE_LETTERHEAD=true
LETTERHEAD_PATH=./letterhead_template.png
COMPANY_NAME=THYNK UNLIMITED
COMPANY_TAGLINE=Creative Company

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=your_secure_random_token_here
WEBHOOK_SECRET=your_webhook_secret_here

# WhatsApp Business API (Get from Meta)
WHATSAPP_ACCESS_TOKEN=your_access_token_from_meta
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_from_meta
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_from_meta

# Server
PORT=10000
NODE_ENV=production

# Admin
ADMIN_NUMBER=your_admin_phone_number
```

### 3.2 Generate Secure Tokens
```bash
# Generate webhook verify token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate webhook secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 4: Database Setup

### 4.1 MongoDB Atlas (Recommended)
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create free cluster
3. Create database user
4. Get connection string
5. Add to Render environment variables

### 4.2 Connection String Format
```
mongodb+srv://username:password@cluster.mongodb.net/trophybot?retryWrites=true&w=majority
```

## Step 5: Deploy

### 5.1 Deploy to Render
1. Click "Create Web Service"
2. Render will automatically build and deploy
3. Wait for deployment to complete (2-3 minutes)

### 5.2 Get Your Webhook URL
After deployment, you'll get a URL like:
```
https://trophybot-webhook.onrender.com
```

Your webhook URL will be:
```
https://trophybot-webhook.onrender.com/webhook
```

## Step 6: Configure Meta WhatsApp Business API

### 6.1 Set Webhook URL
1. Go to [Meta Business Manager](https://business.facebook.com)
2. Navigate to WhatsApp Manager
3. Go to Configuration → Webhook
4. Set webhook URL: `https://trophybot-webhook.onrender.com/webhook`
5. Set verify token: (same as WEBHOOK_VERIFY_TOKEN)
6. Subscribe to `messages` events

### 6.2 Test Webhook
1. Click "Verify and Save"
2. Meta will test your webhook
3. You should see "Webhook verified successfully"

## Step 7: Test Your Bot

### 7.1 Health Check
Visit: `https://trophybot-webhook.onrender.com/health`

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "WhatsApp Business API Webhook"
}
```

### 7.2 Test with WhatsApp
1. Send a message to your business number
2. Bot should respond automatically
3. Check Render logs for debugging

## Step 8: Monitoring

### 8.1 View Logs
1. Go to your Render service
2. Click "Logs" tab
3. Monitor real-time logs

### 8.2 Health Monitoring
- Render provides built-in health checks
- Service will restart if it crashes
- Monitor uptime in dashboard

## Step 9: Custom Domain (Optional)

### 9.1 Add Custom Domain
1. Go to service settings
2. Add custom domain
3. Update webhook URL in Meta
4. Update DNS records

### 9.2 Example Custom Domain
```
https://trophybot.yourcompany.com/webhook
```

## Troubleshooting

### Common Issues

#### 1. Build Fails
- Check `package.json` dependencies
- Ensure all files are committed
- Check build logs in Render

#### 2. Webhook Verification Fails
- Verify WEBHOOK_VERIFY_TOKEN matches Meta
- Check webhook URL is correct
- Ensure service is running

#### 3. Database Connection Issues
- Verify MONGO_URI is correct
- Check MongoDB Atlas IP whitelist
- Ensure database user has proper permissions

#### 4. WhatsApp API Errors
- Verify access token is valid
- Check phone number ID
- Ensure business account is verified

### Debug Commands
```bash
# Check service status
curl https://trophybot-webhook.onrender.com/health

# Test webhook verification
curl "https://trophybot-webhook.onrender.com/webhook?hub.mode=subscribe&hub.verify_token=your_token&hub.challenge=test"
```

## Render Free Tier Limits

- **750 hours/month**: Enough for 24/7 operation
- **512MB RAM**: Sufficient for bot operations
- **Sleep after 15 minutes**: Wakes up on first request
- **Custom domains**: Supported
- **HTTPS**: Included

## Scaling Up

### When to Upgrade
- High message volume
- Need faster response times
- Want dedicated resources

### Upgrade Options
- **Starter Plan**: $7/month
- **Standard Plan**: $25/month
- **Pro Plan**: $85/month

## Security Best Practices

1. **Environment Variables**: Never commit secrets
2. **Webhook Security**: Use HTTPS and verify signatures
3. **Database**: Use connection string encryption
4. **API Tokens**: Rotate regularly
5. **Monitoring**: Set up alerts for failures

## Support

### Render Support
- Documentation: [render.com/docs](https://render.com/docs)
- Community: [community.render.com](https://community.render.com)
- Status: [status.render.com](https://status.render.com)

### Bot Issues
- Check logs in Render dashboard
- Verify environment variables
- Test webhook endpoints

## Next Steps

1. **Deploy to Render**: Follow this guide
2. **Configure Meta API**: Set webhook URL
3. **Test Bot**: Send test messages
4. **Monitor**: Watch logs and performance
5. **Scale**: Upgrade if needed

Your TrophyBot will be live on Render! 🚀

## Quick Deploy Button

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

Click the button above to deploy directly to Render!
