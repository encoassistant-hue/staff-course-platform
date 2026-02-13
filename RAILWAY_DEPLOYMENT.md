# Railway.app Deployment Guide for staff.orthotal.com

## Overview

This guide will walk you through deploying the staff-course-platform to Railway.app with PostgreSQL, including SQLite → PostgreSQL migration.

**Total time: 35-45 minutes**

---

## Phase 1: Pre-Deployment Prep (Local)

### 1.1 Install Dependencies for PostgreSQL

```bash
cd staff-course-platform
npm install pg axios  # Add PostgreSQL client and axios
npm uninstall sqlite3  # Remove SQLite
npm install
```

### 1.2 Update Discord OAuth Redirect URI

In your `.env`, change:
```
DISCORD_REDIRECT_URI=https://staff.orthotal.com/api/auth/discord/callback
```

### 1.3 Environment Setup

Railway will provide a `DATABASE_URL` environment variable (PostgreSQL connection string). Your local `.env` should now have:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/staff_platform
DISCORD_CLIENT_ID=1470884294720225394
DISCORD_CLIENT_SECRET=pBulvksBAv2tE0NSGbNccaUg0YfaJhh8
DISCORD_REDIRECT_URI=https://staff.orthotal.com/api/auth/discord/callback
DISCORD_GUILD_ID=1402748481298370704
REQUIRED_DISCORD_ROLE_ID=1402763897316048956
ADMIN_DISCORD_ROLE_ID=1402763806995779737
JWT_SECRET=training-platform-secret-key-2026
```

### 1.4 Commit Changes to Git

```bash
git add -A
git commit -m "feat: migrate SQLite to PostgreSQL for Railway deployment"
git push origin main
```

---

## Phase 2: Set Up Railway (10 minutes)

### 2.1 Create Railway Account

1. Go to **[railway.app](https://railway.app)**
2. Click **Sign up**
3. Choose **Sign up with GitHub** (recommended for auto-deploys)
4. Authorize Railway to access your GitHub account

### 2.2 Create New Project

1. In Railway dashboard, click **New Project**
2. Select **Deploy from GitHub**
3. Find and select your repository (e.g., `your-username/staff-course-platform`)
4. Click **Deploy**

Railway will start building your app. ⏳

### 2.3 Add PostgreSQL Database

1. In your Railway project, click **Create New** → **Add Service**
2. Select **PostgreSQL**
3. Railway creates a PostgreSQL instance and injects `DATABASE_URL` into your environment automatically ✅

### 2.4 Set Environment Variables

1. Click on your **App Service** (the Node.js one)
2. Go to **Variables** tab
3. Add these variables:

```
NODE_ENV=production
DISCORD_CLIENT_ID=1470884294720225394
DISCORD_CLIENT_SECRET=pBulvksBAv2tE0NSGbNccaUg0YfaJhh8
DISCORD_REDIRECT_URI=https://staff.orthotal.com/api/auth/discord/callback
DISCORD_GUILD_ID=1402748481298370704
REQUIRED_DISCORD_ROLE_ID=1402763897316048956
ADMIN_DISCORD_ROLE_ID=1402763806995779737
JWT_SECRET=training-platform-secret-key-2026
PORT=3000
```

**Note:** `DATABASE_URL` is automatically set by the PostgreSQL service. ✅

### 2.5 Deploy Settings

1. Click on your **App Service**
2. Go to **Settings** tab
3. Set **Start Command** (if not auto-detected):
   ```
   node server.js
   ```
4. Enable **Auto-deploy** (if you want: every GitHub push = instant live update)

---

## Phase 3: Database Migration (SQLite → PostgreSQL)

### 3.1 Export Data from SQLite (Optional - if you have existing data)

If you have existing user data in SQLite that you want to preserve:

```bash
# Install SQLite3 CLI if needed
# macOS: brew install sqlite

# Export as CSV
sqlite3 data.db ".mode csv" ".headers on" "SELECT * FROM users" > users.csv

# Export progress data
sqlite3 data.db ".mode csv" ".headers on" "SELECT * FROM progress" > progress.csv
```

### 3.2 Import Data to PostgreSQL (Optional)

Once Railway PostgreSQL is running, you can import via Railway's Postgres connection:

```bash
# Get PostgreSQL credentials from Railway dashboard

# Connect and import:
psql postgresql://user:password@host:5432/database_name < backup.sql
```

**For most cases**, you'll just let the app create fresh tables on first deploy (no manual data import needed).

---

## Phase 4: DNS Setup (5 minutes)

### 4.1 Get Your Railway Domain

1. In Railway dashboard, go to your **App Service** → **Settings** → **Domains**
2. Railway gives you a free domain like: `staff-orthotal-com-production.up.railway.app`

### 4.2 Add Custom Domain

1. In Railway **Domains** section, click **Add Domain**
2. Enter: `staff.orthotal.com`
3. Railway provides **DNS records** to add

### 4.3 Update GoDaddy DNS

1. Log into **[GoDaddy](https://godaddy.com)**
2. Go to **My Products** → **Domains** → **staff.orthotal.com**
3. Click **DNS** or **Manage**
4. Add the DNS record Railway provided (usually a **CNAME** record)

Example:
```
Name:    staff
Type:    CNAME
Value:   staff-orthotal-com-production.up.railway.app
TTL:     3600
```

Save and wait 5-15 minutes for DNS propagation. ⏳

### 4.4 Enable HTTPS

Once DNS is set up:

1. Go back to Railway **Domains**
2. Your domain should show **SSL certificate pending**
3. After a few minutes: **SSL Status: Valid** ✅

You now have **automatic HTTPS** (Let's Encrypt).

---

## Phase 5: Test Your Deployment

### 5.1 Visit Your Site

1. Open browser: **https://staff.orthotal.com**
2. You should see the training platform
3. Try Discord login → should redirect to Discord, then back to **staff.orthotal.com/api/auth/discord/callback**

### 5.2 Test Functionality

- ✅ Discord OAuth login works
- ✅ Username/password login works (staff1 / staff123 or staff2 / staff456)
- ✅ Course videos load
- ✅ Progress tracking works
- ✅ Certificate generation works

### 5.3 Check Logs

In Railway dashboard, click **App Service** → **Logs** to view real-time logs:

```
Connected to PostgreSQL database
Database tables initialized
Server running on port 3000
```

---

## Phase 6: Ongoing Management

### Monitor Your App

**Railway Dashboard:**
- CPU/Memory usage
- Deployment history
- Error logs
- Environment variables

**Cost:**
- Railway includes `$5/month` free tier
- PostgreSQL + Node.js + SSL = **~$5-7/month** (includes free credit)

### Auto-Deploys

Every time you push to GitHub → Railway redeploys automatically. No manual steps needed!

### Database Backups

Railway PostgreSQL includes automatic daily backups. Access in:
1. PostgreSQL Service → **Backups** tab
2. Download or restore as needed

---

## Troubleshooting

### Issue: "Application failed to boot"

**Solution:** Check logs in Railway dashboard. Common causes:
- Missing environment variables
- Database connection string wrong
- Port not set to 3000

### Issue: "502 Bad Gateway" when visiting domain

**Solution:**
1. Wait 5 minutes for DNS propagation
2. Check Railway app is running (green status)
3. Verify domain DNS records in GoDaddy

### Issue: Discord login redirects to wrong URL

**Solution:**
1. In Railway Variables, verify `DISCORD_REDIRECT_URI=https://staff.orthotal.com/api/auth/discord/callback`
2. In Discord Developer Portal, update redirect URI to match
3. Redeploy in Railway

### Issue: Database errors / table not found

**Solution:**
1. App initialization creates tables automatically on first run
2. Check logs for errors: `Railway Logs`
3. If stuck, delete app, recreate, redeploy

---

## Quick Checklist

- [ ] GitHub repo is public or Railway has access
- [ ] `server.js` uses PostgreSQL (pg module)
- [ ] `.env` has all Discord/JWT variables
- [ ] `package.json` has `pg` as dependency
- [ ] Committed and pushed to GitHub
- [ ] Railway project created
- [ ] PostgreSQL service added
- [ ] Environment variables set in Railway
- [ ] Custom domain added to Railway
- [ ] DNS records updated in GoDaddy
- [ ] Domain points correctly
- [ ] App deployed (green status)
- [ ] HTTPS working (green lock in browser)
- [ ] Discord login works
- [ ] Tested on https://staff.orthotal.com

---

## That's it! 🚀

Your app is now live on **https://staff.orthotal.com** with:
- ✅ Automatic deployments from GitHub
- ✅ PostgreSQL database (auto-backed up daily)
- ✅ Free HTTPS (Let's Encrypt)
- ✅ Cost: ~$5/month (with $5 free credit monthly)

Questions? Railway support: [railway.app/support](https://railway.app/support)
