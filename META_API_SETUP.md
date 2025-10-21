# Meta WhatsApp Business API Setup Guide

## Step-by-Step Guide to Get All Required Credentials

### Prerequisites
- Meta Business account
- WhatsApp Business account
- Phone number for WhatsApp Business

---

## Step 1: Access Meta Business Manager

1. Go to [business.facebook.com](https://business.facebook.com)
2. Log in with your Facebook account
3. Select your business account (or create one)

---

## Step 2: Get WhatsApp Business API Access

### 2.1 Go to WhatsApp Manager
1. In the left sidebar, click **"WhatsApp"**
2. Click **"WhatsApp Manager"**
3. You should see your business account

### 2.2 Get Business Account ID
1. In WhatsApp Manager, look at the URL
2. The URL will be: `https://business.facebook.com/wa/manage/account/123456789`
3. **Your Business Account ID**: `123456789` (the number in the URL)

---

## Step 3: Get Phone Number ID

### 3.1 Add Phone Number
1. In WhatsApp Manager, go to **"Phone Numbers"**
2. Click **"Add Phone Number"**
3. Enter your business phone number
4. Verify it with SMS/call

### 3.2 Get Phone Number ID
1. Click on your verified phone number
2. Look at the URL: `https://business.facebook.com/wa/manage/account/123456789/phone-numbers/987654321`
3. **Your Phone Number ID**: `987654321` (the second number in the URL)

---

## Step 4: Get Access Token

### 4.1 Go to System Users
1. In Meta Business Manager, go to **"Business Settings"**
2. Click **"Users"** → **"System Users"**
3. Click **"Add"** to create a system user

### 4.2 Create System User
1. Enter name: `TrophyBot API User`
2. Select role: **"Admin"** or **"Developer"**
3. Click **"Create System User"**

### 4.3 Generate Access Token
1. Click on your system user
2. Click **"Generate New Token"**
3. Select your app (or create one)
4. Select permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Click **"Generate Token"**
6. **Copy the token immediately** (you won't see it again)

---

## Step 5: Create Webhook Verify Token

### 5.1 Generate Secure Token
You can generate this yourself using any method:

**Option A: Online Generator**
- Go to [random.org](https://www.random.org/passwords/)
- Generate a 32-character random string

**Option B: Command Line**
```bash
# On Windows PowerShell
[System.Web.Security.Membership]::GeneratePassword(32, 0)

# On Mac/Linux
openssl rand -hex 32
```

**Option C: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example**: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

---

## Step 6: Get Webhook Secret

### 6.1 Generate Another Secure Token
Use the same method as Step 5.1 to generate another 32-character string.

**Example**: `z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4`

---

## Step 7: Set Up Webhook

### 7.1 Go to Webhook Configuration
1. In WhatsApp Manager, go to **"Configuration"**
2. Click **"Webhook"**
3. Click **"Configure"**

### 7.2 Configure Webhook
1. **Callback URL**: `https://trophybot-webhook.onrender.com/webhook`
2. **Verify Token**: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` (your generated token)
3. Click **"Verify and Save"**

### 7.3 Subscribe to Events
1. Check **"messages"** checkbox
2. Click **"Save"**

---

## Step 8: Get MongoDB URI

### 8.1 Create MongoDB Atlas Account
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Sign up for free account
3. Create a new cluster

### 8.2 Create Database User
1. Go to **"Database Access"**
2. Click **"Add New Database User"**
3. Username: `trophybot`
4. Password: Generate secure password
5. Click **"Add User"**

### 8.3 Get Connection String
1. Go to **"Clusters"**
2. Click **"Connect"**
3. Select **"Connect your application"**
4. Copy the connection string
5. Replace `<password>` with your database user password

**Example**: `mongodb+srv://trophybot:yourpassword@cluster0.abc123.mongodb.net/trophybot?retryWrites=true&w=majority`

---

## Step 9: Complete Environment Variables

Now you have all the values! Here's your complete `.env` file:

```env
# Database
MONGO_URI=mongodb+srv://trophybot:yourpassword@cluster0.abc123.mongodb.net/trophybot?retryWrites=true&w=majority

# Bot Configuration
BOT_NUMBER=133097362333913
BOT_NAME=Skulpt

# Invoice Configuration
USE_LETTERHEAD=true
LETTERHEAD_PATH=./letterhead_template.png
COMPANY_NAME=THYNK UNLIMITED
COMPANY_TAGLINE=Creative Company

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
WEBHOOK_SECRET=z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4

# WhatsApp Business API
WHATSAPP_ACCESS_TOKEN=your_long_access_token_from_meta
WHATSAPP_PHONE_NUMBER_ID=987654321
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789

# Server
PORT=10000
NODE_ENV=production

# Admin
ADMIN_NUMBER=your_admin_phone_number
```

---

## Step 10: Test Your Setup

### 10.1 Test Webhook Verification
```bash
curl "https://trophybot-webhook.onrender.com/webhook?hub.mode=subscribe&hub.verify_token=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6&hub.challenge=test"
```

Should return: `test`

### 10.2 Test Health Check
```bash
curl https://trophybot-webhook.onrender.com/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "WhatsApp Business API Webhook"
}
```

---

## Troubleshooting

### Common Issues

#### 1. Access Token Expired
- Generate new token in System Users
- Update environment variable
- Redeploy to Render

#### 2. Webhook Verification Failed
- Check verify token matches exactly
- Ensure webhook URL is correct
- Check if service is running

#### 3. Phone Number Not Verified
- Complete phone verification process
- Check if number is active
- Verify in WhatsApp Manager

#### 4. Database Connection Failed
- Check MongoDB connection string
- Verify database user permissions
- Check IP whitelist in MongoDB Atlas

---

## Security Notes

1. **Never commit** `.env` files to GitHub
2. **Rotate tokens** regularly
3. **Use strong passwords** for database
4. **Keep credentials secure**
5. **Monitor access logs**

---

## Quick Reference

| Credential | Where to Find | Example |
|------------|---------------|---------|
| Business Account ID | WhatsApp Manager URL | `123456789` |
| Phone Number ID | Phone Numbers page URL | `987654321` |
| Access Token | System Users → Generate Token | `EAABwzLix...` |
| Verify Token | You generate | `a1b2c3d4...` |
| Webhook Secret | You generate | `z9y8x7w6...` |
| MongoDB URI | Atlas → Connect | `mongodb+srv://...` |

---

## Support

If you get stuck:
1. Check Meta Developer documentation
2. Verify all URLs and tokens
3. Test each component separately
4. Check Render logs for errors

Your TrophyBot will be live once all credentials are configured! 🏆
