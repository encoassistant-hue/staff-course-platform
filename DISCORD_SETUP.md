# Discord OAuth Setup Guide

This guide will help you set up Discord login for the Training Platform.

## Prerequisites
- A Discord server (or create one at https://discord.com)
- Admin access to that server
- The training platform running locally or deployed

## Step 1: Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click the **"New Application"** button
3. Enter a name: `Training Platform`
4. Click **"Create"**

## Step 2: Get Your Credentials

1. Go to the **"OAuth2"** section in the left sidebar
2. Click **"General"** under OAuth2
3. Copy your **Client ID** (you'll need this)
4. Click **"Reset Secret"** and copy your **Client Secret** (keep this safe!)

## Step 3: Add Redirect URL

1. Still in OAuth2 → General
2. Under "Redirects", click **"Add Redirect"**
3. Enter: `http://localhost:3000/api/auth/discord/callback`
4. Click **"Save Changes"**

For production, replace `localhost:3000` with your actual domain:
```
https://your-domain.com/api/auth/discord/callback
```

## Step 4: (Optional) Set Up Role-Based Access

If you want to restrict access to users with a specific role:

### Get Your Guild ID
1. In Discord, enable **Developer Mode** (Settings → Advanced → Developer Mode)
2. Right-click your server name
3. Click **"Copy Server ID"**

### Get Your Role ID
1. Right-click the role in Server Settings → Roles
2. Click **"Copy Role ID"**

## Step 5: Create `.env` File

In the project root, create a `.env` file:

```
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_GUILD_ID=your_guild_id_here
REQUIRED_DISCORD_ROLE_ID=your_role_id_here
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
JWT_SECRET=your_jwt_secret_change_this
PORT=3000
```

### Explanation:
- **DISCORD_CLIENT_ID**: Your app's Client ID
- **DISCORD_CLIENT_SECRET**: Your app's Secret (keep private!)
- **DISCORD_GUILD_ID**: Server ID (optional, for role checking)
- **REQUIRED_DISCORD_ROLE_ID**: Role ID (optional, for access control)
- **DISCORD_REDIRECT_URI**: Where Discord sends users after login
- **JWT_SECRET**: Used for token signing (use a strong random string)
- **PORT**: Server port (default 3000)

## Step 6: Restart the Server

```bash
npm start
# or
node server.js
```

The Discord login button will now appear on the login page! 🎉

## Step 7: Test It Out

1. Go to `http://localhost:3000`
2. You should see the **"Continue with Discord"** button
3. Click it to log in with your Discord account
4. You'll be prompted to authorize the application
5. After authorization, you'll be logged in and can access courses!

## Troubleshooting

### Discord button not showing?
- Make sure all three main env variables are set (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
- Restart the server after adding `.env`
- Check server logs for errors

### "Invalid OAuth2 Redirect URI"?
- Make sure the redirect URL exactly matches what you entered in Discord Developer Portal
- Check for trailing slashes or typos

### "You don't have access"?
- You don't have the required role
- Ask a server admin to give you the role specified in `REQUIRED_DISCORD_ROLE_ID`

### Getting "Something went wrong" after Discord auth?
- Check browser console for errors
- Make sure the user has a username in Discord
- Verify the redirect URI matches exactly

## For Production

When deploying to production:

1. Update `DISCORD_REDIRECT_URI` to your production domain:
   ```
   DISCORD_REDIRECT_URI=https://your-platform.com/api/auth/discord/callback
   ```

2. Add the same URL to Discord Developer Portal

3. Use a strong, random `JWT_SECRET`

4. Set environment variables on your hosting platform (don't commit `.env` to git)

5. Enable HTTPS (Discord requires secure connections)

## Help

For more info:
- Discord Developer Docs: https://discord.com/developers/docs
- OAuth2 Scopes: https://discord.com/developers/docs/topics/oauth2#scopes
- Discord.py Docs: https://discordpy.readthedocs.io/
