# ✅ Deployment Checklist - staff.orthotal.com

## What's Been Done ✨

✅ **Database Migration**
- Replaced SQLite with PostgreSQL
- Updated `server.js` to use `pg` library with async/await
- Created PostgreSQL-compatible table schemas
- Database initializes automatically on first deploy

✅ **Configuration Updated**
- `.env` updated with production settings
- Discord redirect URI: `https://staff.orthotal.com/api/auth/discord/callback`
- `package.json` updated (removed sqlite3, added pg + axios)
- `NODE_ENV=production` ready

✅ **Code Changes**
- `server.js` completely rewritten for PostgreSQL
- All routes converted to async/await
- Authentication middleware updated
- Discord OAuth flow verified
- Backup: `server-sqlite-backup.js` (if needed)

✅ **Git Commit**
- All changes committed: `git commit b5f0515`
- Ready to push to GitHub

✅ **Documentation**
- `RAILWAY_DEPLOYMENT.md` - Complete deployment guide
- This checklist file

---

## Next Steps: Railway Deployment (10 minutes)

### Step 1: Push to GitHub

```bash
cd /Users/tomsam_work/.openclaw/workspace/staff-course-platform
git push origin main
```

Verify at: https://github.com/YOUR_USERNAME/staff-course-platform

### Step 2: Create Railway Project

1. Go to **[railway.app](https://railway.app)**
2. Click **New Project** → **Deploy from GitHub**
3. Select your repository
4. Click **Deploy**

Railway auto-detects it's a Node.js app. ✅

### Step 3: Add PostgreSQL Database

1. In your Railway project, click **Create New** → **Add Service**
2. Select **PostgreSQL**
3. Railway automatically injects `DATABASE_URL` into your app ✅

### Step 4: Set Environment Variables

Click your **App Service** → **Variables** tab → Add these:

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

**Note:** `DATABASE_URL` is automatic (don't set it manually)

### Step 5: Deploy & Wait

1. In **Railway Settings**, confirm **Start Command** is: `node server.js`
2. Railway deploys automatically
3. Watch the **Deployment** tab → green checkmark = success

You'll see logs:
```
✅ Database tables created successfully
✅ Default users created
✅ Server running on port 3000
```

### Step 6: Add Custom Domain

1. Click your **App Service** → **Settings**
2. Under **Domains**, add: `staff.orthotal.com`
3. Copy the DNS records Railway provides

### Step 7: Update GoDaddy DNS

1. Login to **[godaddy.com](https://godaddy.com)**
2. **My Products** → **Domains** → **orthotal.com**
3. Click **DNS**
4. Add/update the **CNAME record** with Railway's info
5. Save and wait 5-15 minutes for propagation

**Example DNS record:**
```
Name:  staff
Type:  CNAME
Value: [Railway's domain from Step 6]
TTL:   3600
```

### Step 8: Test Everything

Visit: **https://staff.orthotal.com** (wait if not working - DNS propagation)

**Test these:**
- ✅ Page loads with HTTPS (green lock)
- ✅ Discord login button works
- ✅ Username/password login works (staff1/staff123)
- ✅ Course videos load
- ✅ Progress tracking works
- ✅ Certificate download works

---

## 🚀 You're Live!

**What you have:**
- ✅ Automatic deployments (push to GitHub = live instantly)
- ✅ PostgreSQL database with daily auto-backups
- ✅ Free HTTPS certificate (Let's Encrypt)
- ✅ Discord OAuth login
- ✅ Cost: ~$5-7/month (with $5 free credit)

**Logs & Monitoring:**
- Railway dashboard shows real-time logs
- Check for errors immediately
- Auto-restarts on crash

---

## Troubleshooting

### "502 Bad Gateway" error?
- Wait 5 minutes (DNS propagation)
- Check Railway app status (green = running)
- Check logs in Railway dashboard

### Discord login redirects to wrong URL?
- Verify `DISCORD_REDIRECT_URI` in Railway variables
- In Discord Developer Portal, update redirect URI
- Save & redeploy

### Database errors?
- Check Railway logs for error messages
- PostgreSQL tables auto-create on first run
- If stuck, delete app and redeploy

### Need to rollback?
- Git revert to `server-sqlite-backup.js`
- Redeploy
- Old SQLite data available in `data.db` (local backup)

---

## Files Reference

| File | Purpose |
|------|---------|
| `server.js` | **Main app** - PostgreSQL version |
| `package.json` | Dependencies (pg, express, etc.) |
| `.env` | Production env variables |
| `database.js` | Database module (optional) |
| `RAILWAY_DEPLOYMENT.md` | Full deployment guide |
| `server-sqlite-backup.js` | Original SQLite version (backup) |

---

## Time Estimate

- Push to GitHub: **2 min**
- Create Railway project: **5 min**
- Add PostgreSQL: **2 min**
- Set variables: **3 min**
- Deploy: **3-5 min**
- Add domain: **2 min**
- Update DNS: **2 min**
- DNS propagation: **5-15 min**

**Total: ~25-35 minutes** 🎯

---

## Questions?

- Railway support: [railway.app/support](https://railway.app/support)
- Server code: `server.js` (async/await, PostgreSQL)
- Deploy guide: `RAILWAY_DEPLOYMENT.md`

**Ready to deploy!** 🚀
