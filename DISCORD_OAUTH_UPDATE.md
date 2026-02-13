# Discord OAuth Configuration Update

## What Changed

Your Discord OAuth redirect URI has been updated for production:

**Old (Local):**
```
http://localhost:3000/api/auth/discord/callback
```

**New (Production):**
```
https://staff.orthotal.com/api/auth/discord/callback
```

---

## Update Discord Developer Portal

### Step 1: Go to Discord Developer Portal

1. Open **[discord.com/developers/applications](https://discord.com/developers/applications)**
2. Click your application (you created one during setup)
3. Look for the name starting with "Staff Course" or similar

### Step 2: Update OAuth2 Redirect URI

1. In left sidebar, click **OAuth2** → **General**
2. Scroll to **Redirects**
3. Find the old redirect URI: `http://localhost:3000/api/auth/discord/callback`
4. Click the **trash icon** to delete it
5. Click **Add Another** (or paste in existing field)
6. Enter new URI:
   ```
   https://staff.orthotal.com/api/auth/discord/callback
   ```
7. Click **Save**

### Step 3: Keep These Secret

Leave these **unchanged** (already in your Railway variables):
- **Client ID:** 1470884294720225394
- **Client Secret:** pBulvksBAv2tE0NSGbNccaUg0YfaJhh8

---

## After Updating

1. Save changes in Discord Portal
2. Your Railway app already has the updated redirect URI in `.env`
3. On next deploy, Discord login will work at `https://staff.orthotal.com` ✅

---

## Testing

Once deployed to Railway:

1. Visit **https://staff.orthotal.com**
2. Click **Login with Discord**
3. You should be redirected to Discord permission screen
4. After authorization, redirects back to **https://staff.orthotal.com**
5. You're logged in! ✅

---

## Troubleshooting

### "Invalid redirect URI" error in Discord?

**Solution:**
1. Double-check you copied `https://staff.orthotal.com/api/auth/discord/callback` exactly
2. Verify HTTPS (not HTTP)
3. Verify no trailing slash or extra spaces
4. Save in Discord Portal
5. Wait a few seconds, refresh, try again

### Discord login button not working after deployment?

**Check:**
1. ✅ Is your domain (`staff.orthotal.com`) live? (test in browser)
2. ✅ Is the Discord redirect URI updated in Portal?
3. ✅ Is `DISCORD_REDIRECT_URI` variable set in Railway?
4. ✅ Did you redeploy after updating variables?

---

## Reference

**Your App Credentials (Discord Portal):**
- Application Name: Staff Course Platform
- Client ID: 1470884294720225394
- Scopes: `identify`, `email`, `guilds.members.read`
- Permissions: Read guild members

**Your Server:**
- Production URL: https://staff.orthotal.com
- Auth callback: https://staff.orthotal.com/api/auth/discord/callback

---

**Done!** Discord OAuth is now production-ready. 🎉
