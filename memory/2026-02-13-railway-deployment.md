# Railway Deployment Preparation - Staff Course Platform

**Date:** 2026-02-13  
**Status:** ✅ COMPLETE - Ready for Railway deployment  
**Target:** https://staff.orthotal.com  

## What Was Done

### 1. Database Migration (SQLite → PostgreSQL)
- ✅ Replaced sqlite3 with pg package
- ✅ Rewrote server.js to use async/await with PostgreSQL
- ✅ Created PostgreSQL-compatible table schemas
- ✅ Database initializes automatically on first deploy
- ✅ Backup of original: `server-sqlite-backup.js`

### 2. Configuration & Dependencies
- ✅ Updated .env for production:
  - `NODE_ENV=production`
  - `DATABASE_URL` will be auto-injected by Railway PostgreSQL service
  - Discord redirect: `https://staff.orthotal.com/api/auth/discord/callback`
- ✅ package.json updated:
  - Removed: sqlite3
  - Added: pg, axios
- ✅ Code verified (syntax check passed)

### 3. Git Commits
- Commit 1: `b5f0515` - Main migration (server.js + package.json)
- Commit 2: `f7e1621` - Documentation (checklists + guides)

### 4. Documentation Created
- `RAILWAY_DEPLOYMENT.md` - Full step-by-step guide (7 phases, 35-45 min)
- `DEPLOYMENT_CHECKLIST.md` - Quick reference with troubleshooting
- `DISCORD_OAUTH_UPDATE.md` - Discord Portal configuration guide
- `database.js` - PostgreSQL module (optional reference)

## Files Modified/Created

```
staff-course-platform/
├── server.js                      [REWRITTEN for PostgreSQL]
├── package.json                   [Updated dependencies]
├── .env                           [Production config]
├── RAILWAY_DEPLOYMENT.md          [NEW - Full guide]
├── DEPLOYMENT_CHECKLIST.md        [NEW - Quick ref]
├── DISCORD_OAUTH_UPDATE.md        [NEW - OAuth guide]
├── database.js                    [NEW - DB module]
├── server-sqlite-backup.js        [BACKUP - Original]
└── server-sqlite-backup.log       [Reference]
```

## Next Steps (User Action Required)

### Step 1: Push to GitHub
```bash
git push origin main
```

### Step 2-8: Follow DEPLOYMENT_CHECKLIST.md
1. Create Railway project (from GitHub)
2. Add PostgreSQL service
3. Set environment variables
4. Deploy (~5 min)
5. Add custom domain
6. Update GoDaddy DNS (CNAME record)
7. Wait 5-15 min for DNS propagation
8. Test at https://staff.orthotal.com

### Important: Discord Portal Update
Before testing Discord login, update redirect URI in Discord Developer Portal:
- Old: `http://localhost:3000/api/auth/discord/callback`
- New: `https://staff.orthotal.com/api/auth/discord/callback`
(See DISCORD_OAUTH_UPDATE.md for details)

## Key Endpoints

```
POST   /api/login                      - Username/password auth
GET    /api/auth/discord               - Start Discord OAuth
GET    /api/auth/discord/callback      - Discord OAuth redirect
GET    /api/config                     - Check configuration
GET    /api/courses                    - List courses
GET    /api/user                       - User profile (auth required)
GET    /api/progress/:courseId         - Course progress (auth required)
POST   /api/progress                   - Mark video as watched (auth required)
GET    /api/completion/:courseId       - Check course completion (auth required)
POST   /api/completion                 - Mark course complete (auth required)
```

## Environment Variables

**Railway will provide:**
- `DATABASE_URL` (auto-injected by PostgreSQL service)

**User must set in Railway:**
- `NODE_ENV=production`
- `DISCORD_CLIENT_ID=1470884294720225394`
- `DISCORD_CLIENT_SECRET=***`
- `DISCORD_REDIRECT_URI=https://staff.orthotal.com/api/auth/discord/callback`
- `DISCORD_GUILD_ID=1402748481298370704`
- `REQUIRED_DISCORD_ROLE_ID=1402763897316048956`
- `ADMIN_DISCORD_ROLE_ID=1402763806995779737`
- `JWT_SECRET=training-platform-secret-key-2026`
- `PORT=3000`

## Estimated Timeline

- Push to GitHub: 2 min
- Railway setup: 5-7 min
- Deploy: 3-5 min
- DNS setup: 2 min
- DNS propagation: 5-15 min
- **Total: 25-35 minutes**

## Cost

- Railway: $5-7/month (with $5 free credit = ~$0/month)
- Domain: Already have (orthotal.com)
- SSL: Free (Let's Encrypt)
- Database: PostgreSQL included with Railway

## References

- GitHub repo: [Update with your username]
- Railway.app: https://railway.app
- Discord Developers: https://discord.com/developers/applications
- GoDaddy DNS: https://godaddy.com

## Rollback Plan (if needed)

If anything goes wrong:
1. Revert server.js to `server-sqlite-backup.js`
2. Switch PostgreSQL back to SQLite in code
3. Redeploy
4. Local SQLite data still in `data.db`

---

**Status:** Ready for user to proceed with Railway deployment ✅
