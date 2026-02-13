# Staff Training Course Platform

A lightweight, self-hosted training platform for staff with video courses and certificate generation.

## Features

✅ **Login System** — Username/password authentication  
✅ **Sequential Videos** — No skipping, watch to completion to unlock next video  
✅ **Progress Tracking** — Database tracks which videos each user has watched  
✅ **Certificate Generation** — Downloadable certificate image on course completion  
✅ **No Dependencies** — Just Node.js + SQLite, no complex tooling  
✅ **Lightweight** — ~50KB total, minimal resource usage  

## Quick Start (Local Development)

### 1. Install dependencies
```bash
npm install
```

### 2. Start the server
```bash
npm start
```

Server runs on `http://localhost:3000`

### 3. Login with demo credentials
- **Username:** staff1 / **Password:** staff123
- **Username:** staff2 / **Password:** staff456

## Production Deployment (Docker)

### Prerequisites
- Docker & Docker Compose installed
- A subdomain pointing to your server (e.g., staff.orthotal.com)

### 1. Deploy with Docker Compose
```bash
docker-compose up -d
```

This will:
- Build the Docker image
- Start the server on port 3000
- Store data in `./data/data.db` (persists across restarts)

### 2. Set up reverse proxy (nginx)

Add to your nginx config:

```nginx
server {
    listen 80;
    server_name staff.orthotal.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then reload nginx:
```bash
sudo systemctl reload nginx
```

### 3. (Optional) Set up HTTPS with Let's Encrypt
```bash
sudo certbot certonly --nginx -d staff.orthotal.com
```

Add to nginx config:
```nginx
server {
    listen 443 ssl http2;
    server_name staff.orthotal.com;
    ssl_certificate /etc/letsencrypt/live/staff.orthotal.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staff.orthotal.com/privkey.pem;
    
    # ... rest of config above
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name staff.orthotal.com;
    return 301 https://$server_name$request_uri;
}
```

## Adding Users

Edit `server.js` to add more staff members. Look for the section that says:

```javascript
// Insert default staff accounts
const hashedPassword1 = bcrypt.hashSync('staff123', 10);
const hashedPassword2 = bcrypt.hashSync('staff456', 10);

db.run(`INSERT OR IGNORE INTO users (username, password, name) VALUES (?, ?, ?)`,
  ['staff1', hashedPassword1, 'Staff Member 1']);
db.run(`INSERT OR IGNORE INTO users (username, password, name) VALUES (?, ?, ?)`,
  ['staff2', hashedPassword2, 'Staff Member 2']);
```

Add more entries like:
```javascript
db.run(`INSERT OR IGNORE INTO users (username, password, name) VALUES (?, ?, ?)`,
  ['staff3', bcrypt.hashSync('password123', 10), 'Staff Member 3']);
```

Then restart: `docker-compose restart`

## Customizing Videos

Edit `server.js` and update the `courseContent` object:

```javascript
const courseContent = {
  sections: [
    {
      id: 1,
      title: 'Section Name',
      videos: [
        {
          id: 1,
          title: 'Video Title',
          url: 'https://stream.mux.com/...'  // HLS stream URL
        }
      ]
    }
  ]
};
```

## Customizing Certificates

The certificate is generated dynamically in `public/app.js` in the `downloadCertificate()` function.

To change the emoji: find `ctx.fillText('🎓', ...)` and replace `🎓` with your emoji.

To customize styling, edit the canvas drawing code in `downloadCertificate()`.

## File Structure

```
staff-course-platform/
├── server.js              # Express backend, auth, video tracking
├── public/
│   ├── index.html         # Single-page frontend
│   └── app.js             # Frontend logic, video player, cert generation
├── data.db                # SQLite database (auto-created)
├── Dockerfile             # Docker image definition
├── docker-compose.yml     # Docker Compose configuration
└── package.json           # Node dependencies
```

## Database Schema

### users
- `id` — User ID
- `username` — Login username
- `password` — Hashed password (bcrypt)
- `name` — Display name
- `created_at` — Account creation date

### progress
- `user_id` — User ID
- `section_id` — Section ID
- `video_id` — Video ID
- `completed` — Boolean (1 = watched)
- `watched_at` — Timestamp of completion

### completions
- `user_id` — User ID
- `completed_at` — Full course completion date

## Troubleshooting

**"Connection refused" when accessing subdomain?**
- Check nginx is running: `sudo systemctl status nginx`
- Check app is running: `docker-compose ps`
- Verify firewall allows port 80/443

**Users locked out of a video?**
- Edit `server.js` to lower the `>= 95` threshold in the `player.on('timeupdate')` event

**Videos not loading?**
- Verify video URLs are still valid (Mux tokens expire)
- Check browser console for CORS errors

**Want to reset user progress?**
- Delete `./data/data.db` and restart (erases everything)
- Or run: `rm data.db && docker-compose restart`

## Security Notes

⚠️ **Change JWT_SECRET in production!**

In `docker-compose.yml`, set a strong secret:
```yaml
environment:
  - JWT_SECRET=your-long-random-string-here
```

Or use environment variable:
```bash
export JWT_SECRET="your-secret" && docker-compose up -d
```

## API Reference

### POST /api/login
Login with username & password. Returns JWT token.

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"staff1","password":"staff123"}'
```

### GET /api/course
Get course structure (sections & videos).

```bash
curl http://localhost:3000/api/course \
  -H "Authorization: Bearer <token>"
```

### GET /api/progress
Get user's watched videos.

```bash
curl http://localhost:3000/api/progress \
  -H "Authorization: Bearer <token>"
```

### POST /api/video-watched
Mark a video as watched.

```bash
curl -X POST http://localhost:3000/api/video-watched \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"section_id":1,"video_id":1}'
```

### GET /api/completion-status
Check if user completed entire course.

```bash
curl http://localhost:3000/api/completion-status \
  -H "Authorization: Bearer <token>"
```

## License

MIT
