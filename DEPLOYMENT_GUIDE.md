# 🚀 Permanent Webhook Deployment Guide

## Deploy to Railway (5-Minute Setup)

Railway will give you a permanent URL like: `https://your-app.railway.app`

### Step 1: Create Railway Account

1. Go to: https://railway.app
2. Click "Start a New Project"
3. Sign up with GitHub (recommended) or email
4. Verify your email

### Step 2: Push Code to GitHub

```bash
# Create a new GitHub repository at https://github.com/new
# Name it: mental-health-chatbot
# Then run these commands:

git remote add origin https://github.com/YOUR_USERNAME/mental-health-chatbot.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Railway

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your `mental-health-chatbot` repository
4. Click "Deploy Now"

### Step 4: Add Database Services

In Railway dashboard:

1. Click "+ New" → "Database" → "Add PostgreSQL"
2. Click "+ New" → "Database" → "Add Redis"
3. Railway will automatically connect them!

### Step 5: Add Environment Variables

In Railway, go to your app → Variables tab, add:

```
PORT=3000
NODE_ENV=production

TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+18668551301

ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE

WEBHOOK_SECRET=generate_random_secret_here
ENCRYPTION_KEY=generate_32_byte_hex_key_here

LOG_LEVEL=info
RATE_LIMIT_HOUR=20
RATE_LIMIT_DAY=100
```

**Note**: Railway automatically provides DATABASE_URL and REDIS_URL!

### Step 6: Get Your Permanent URL

1. In Railway dashboard, click on your app
2. Go to "Settings" tab
3. Under "Domains", click "Generate Domain"
4. Copy your permanent URL (e.g., `https://mental-health-chatbot.railway.app`)

### Step 7: Configure Twilio

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/active
2. Click your phone number
3. Set webhook URL: `https://YOUR-APP.railway.app/webhook/sms`
4. Method: POST
5. Save!

---

## Alternative: Deploy to Render

### Quick Render Deployment

1. Go to: https://render.com
2. Sign up / Sign in
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name**: mental-health-chatbot
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
6. Add environment variables (same as above)
7. Add PostgreSQL and Redis from "Dashboard" → "New +" → "PostgreSQL/Redis"
8. Deploy!

Your URL will be: `https://mental-health-chatbot.onrender.com`

---

## Verification Checklist

After deployment:

- [ ] Visit `https://your-app.railway.app/health` (should return "healthy")
- [ ] Check Railway logs for "Server running on port 3000"
- [ ] Configure Twilio webhook with your permanent URL
- [ ] Send test SMS to Twilio number
- [ ] Receive response from chatbot
- [ ] Check Railway logs for "Incoming SMS received"

---

## Monitoring Your Production App

### Railway Dashboard

- **Logs**: See real-time application logs
- **Metrics**: CPU, Memory, Network usage
- **Deployments**: See deployment history

### Twilio Logs

- Go to: https://console.twilio.com/us1/monitor/logs/sms
- See all SMS sent/received
- Check for webhook errors

---

## Important Notes

✅ **Free Tier Limits**:
- Railway: $5 free credit per month
- Render: 750 hours/month free

⚠️ **Security**:
- Never commit `.env` file
- Rotate API keys regularly
- Use environment variables for all secrets

🔄 **Auto-Deployment**:
- Push to main branch → Auto-deploys
- No need to manually redeploy

---

## Troubleshooting

### Problem: Deployment Failed

**Solution**: Check Railway logs for errors

```bash
# Common issues:
- Missing environment variables
- Database connection error
- Port already in use
```

### Problem: Webhook Not Receiving Messages

**Solutions**:
1. Verify Twilio webhook URL is correct
2. Check Railway logs for incoming requests
3. Test webhook: `curl https://your-app.railway.app/health`

### Problem: Database Connection Error

**Solutions**:
1. Ensure PostgreSQL service is running in Railway
2. Check DATABASE_URL environment variable
3. Restart the application

---

## Your Permanent URLs

After deployment, you'll have:

- **App URL**: `https://your-app.railway.app`
- **Health Check**: `https://your-app.railway.app/health`
- **Webhook**: `https://your-app.railway.app/webhook/sms`
- **Status**: `https://your-app.railway.app/api/status`

---

## Next Steps

1. **Monitor**: Check Railway dashboard regularly
2. **Test**: Send various SMS messages to test functionality
3. **Scale**: Upgrade plan if needed for more users
4. **Professional Review**: Have mental health professionals review before public launch

---

**Your chatbot is now production-ready with a permanent webhook URL!** 🎉

No more changing URLs - Twilio webhook stays the same forever!

