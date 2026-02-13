# Quick Start Guide

**Want to run it right now?**

## Local Development (2 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open browser
# http://localhost:3000

# 4. Login
# Username: staff1
# Password: staff123
```

Done! You should see the course dashboard.

## Production Deploy (10 minutes)

### On your server:

```bash
# 1. SSH in
ssh root@your-server-ip

# 2. Clone/upload project to /opt/staff-training/
mkdir -p /opt/staff-training
cd /opt/staff-training
# (upload files here)

# 3. Start with Docker Compose
docker-compose up -d

# 4. Set up DNS
# Add A record for "staff" → your-server-ip

# 5. Set up nginx
# Follow DEPLOYMENT.md step 5

# 6. (Optional) Set up HTTPS
# Follow DEPLOYMENT.md step 6
```

Now visit: `https://staff.orthotal.com`

## Key Files

| File | Purpose |
|------|---------|
| `server.js` | Backend, auth, video tracking |
| `public/app.js` | Frontend logic & video player |
| `public/index.html` | UI/styling |
| `docker-compose.yml` | Deployment config |
| `data.db` | SQLite database (auto-created) |

## How It Works

1. **Login** → User enters username/password
2. **Course View** → Videos displayed in order
3. **Watch Video** → Player locks until 95% watched
4. **Next Video Unlocks** → User can proceed only after watching
5. **All Videos Done** → Certificate appears
6. **Download** → User downloads cert as PNG image

## Customize

### Add Staff Members
Edit `server.js`, add to the users section, restart Docker.

### Change Videos
Edit `server.js`, update the `courseContent` object.

### Customize Certificate
Edit `public/app.js`, `downloadCertificate()` function. Change emoji, colors, text.

### Change Styling
Edit `public/index.html`, modify the `<style>` section.

## Video URLs

All video URLs must be **HLS streams** (`.m3u8` format).

Supports:
- ✅ Mux streams
- ✅ AWS CloudFront HLS
- ✅ Any HLS-compatible service

## That's It!

See `README.md` for full documentation.  
See `DEPLOYMENT.md` for detailed server setup.

Questions? Check the troubleshooting sections.
