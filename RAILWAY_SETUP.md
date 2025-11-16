# Railway Setup Guide

This guide will walk you through setting up your Mental Health Chatbot on Railway with PostgreSQL and Redis.

## Step 1: Add PostgreSQL Database

1. Go to your Railway project: https://railway.app
2. Click **"New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically create a `DATABASE_URL` environment variable

## Step 2: Add Redis Database

1. Click **"New"** → **"Database"** → **"Add Redis"**
2. Railway will automatically create a `REDIS_URL` environment variable

## Step 3: Configure Environment Variables

Go to your service → **"Variables"** tab and add these:

```env
NODE_ENV=production
PORT=3000

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Claude API
ANTHROPIC_API_KEY=sk-ant-api03-your_anthropic_api_key_here

# Security (generate new keys for production!)
WEBHOOK_SECRET=your_webhook_secret_here
ENCRYPTION_KEY=generate_32_byte_hex_key_here

# Rate Limiting
RATE_LIMIT_HOUR=10
RATE_LIMIT_DAY=50

# Logging
LOG_LEVEL=info
```

**⚠️ IMPORTANT: Generate new security keys before production!**
```bash
# Generate WEBHOOK_SECRET
openssl rand -hex 32

# Generate ENCRYPTION_KEY
openssl rand -hex 32
```

## Step 4: Initialize the Database

Once your PostgreSQL database is added and the service is deployed, you need to initialize the database schema.

### Method 1: Using Railway Dashboard (Easiest)

1. Go to your PostgreSQL database in Railway
2. Click on **"Data"** tab or **"Connect"**
3. Click **"PostgreSQL"** to open the database CLI
4. Copy and paste the contents of `init.sql` into the CLI
5. Press Enter to execute

### Method 2: Using the Init Script

1. In Railway, go to your service **Settings**
2. Under **"Deploy"**, find **"Custom Start Command"**
3. Temporarily change it to: `npm run init-db`
4. Wait for deployment to complete (this will initialize the database)
5. Change the start command back to: `node src/server.js`
6. Redeploy

### Method 3: Using Railway CLI (Local)

If you want to install Railway CLI locally:

```bash
# Install Railway CLI (requires sudo)
curl -fsSL https://railway.app/install.sh | sh

# Login to Railway
railway login

# Link to your project
railway link

# Run database initialization
railway run npm run init-db
```

## Step 5: Verify Database Tables

Check that these tables were created:
- `users`
- `conversations`
- `crisis_events`
- `check_ins`

You can verify in Railway's PostgreSQL dashboard under the **"Data"** tab.

## Step 6: Get Your Railway URL

1. Go to your service in Railway
2. Click on **"Settings"**
3. Under **"Domains"**, you'll see your Railway domain (e.g., `your-app.railway.app`)
4. Or click **"Generate Domain"** if you don't have one yet

## Step 7: Update Twilio Webhook

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click on your phone number
4. Scroll to **"Messaging Configuration"**
5. Under **"A MESSAGE COMES IN"**, set:
   - **Webhook URL**: `https://your-app.railway.app/webhook/sms`
   - **HTTP Method**: `POST`
6. Click **"Save"**

## Step 8: Test Your Chatbot

Send a text message to your Twilio number.

Try these test messages:
- `HELP` - See available commands
- `RESOURCES` - Get crisis resources
- `BREATHE` - Guided breathing exercise
- `How are you?` - Start a conversation

## Monitoring

### View Logs
In Railway:
1. Go to your service
2. Click **"Deployments"**
3. Click on the latest deployment
4. View real-time logs

### Check Health
Visit: `https://your-app.railway.app/health`

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-11-16T05:36:19.000Z",
  "uptime": 123.45,
  "memory": {...},
  "services": {
    "database": "connected",
    "redis": "connected",
    "twilio": "configured",
    "anthropic": "configured"
  }
}
```

## Troubleshooting

### Error: "Configuration validation failed"
- Make sure all environment variables are set in Railway
- Check that DATABASE_URL and REDIS_URL are automatically set by Railway

### Error: "Database connection failed"
- Verify PostgreSQL database is running in Railway
- Check DATABASE_URL format: `postgresql://user:pass@host:port/dbname`

### Error: "Tables do not exist"
- Run the database initialization script (see Step 4)
- Verify tables were created in PostgreSQL dashboard

### Error: "Twilio webhook not working"
- Verify webhook URL is correct: `https://your-domain.railway.app/webhook/sms`
- Check that Railway service is deployed and running
- Test the health endpoint first

### Error: "API key invalid"
- Verify ANTHROPIC_API_KEY is correct and has credits
- Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are correct

## Security Checklist

Before going live:
- [ ] Rotate all API credentials (Twilio, Anthropic)
- [ ] Generate new WEBHOOK_SECRET and ENCRYPTION_KEY
- [ ] Set NODE_ENV=production
- [ ] Enable proper logging and monitoring
- [ ] Review and adjust rate limits
- [ ] Test crisis detection thoroughly
- [ ] Establish professional oversight protocol
- [ ] Review legal compliance (HIPAA, COPPA, etc.)

## Support

For issues:
- Check Railway deployment logs
- Review [README.md](README.md) for architecture details
- Test locally first with `npm run dev`
- Verify all environment variables are set

---

**Remember:** This is a mental health support tool. Always prioritize user safety and professional oversight.
