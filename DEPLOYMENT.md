# Deployment Guide for staff.orthotal.com

Complete step-by-step instructions to deploy the Staff Training Course to your subdomain.

## Prerequisites

- VPS/Server with Docker installed
- SSH access to your server
- Domain name (orthotal.com) with access to DNS settings
- Basic familiarity with terminal

## Step 1: Server Setup

### 1.1 SSH into your server
```bash
ssh root@your-server-ip
```

### 1.2 Install Docker & Docker Compose
```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 1.3 Create project directory
```bash
mkdir -p /opt/staff-training
cd /opt/staff-training
```

## Step 2: Upload Project Files

Option A: Git (recommended)
```bash
cd /opt/staff-training
git clone <your-repo-url> .
```

Option B: SCP/Upload manually
```bash
# From your local machine
scp -r staff-course-platform/* root@your-server-ip:/opt/staff-training/
```

## Step 3: Start the Application

```bash
cd /opt/staff-training
docker-compose up -d
```

Check status:
```bash
docker-compose ps
```

You should see the app container running on port 3000.

## Step 4: Set Up DNS

1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Add an A record:
   - **Name:** staff
   - **Type:** A
   - **Value:** your-server-ip
   - **TTL:** 3600

Wait a few minutes for DNS to propagate.

## Step 5: Set Up nginx Reverse Proxy

### 5.1 Install nginx
```bash
apt install -y nginx
```

### 5.2 Create nginx config
```bash
sudo nano /etc/nginx/sites-available/staff.orthotal.com
```

Paste this config:
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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5.3 Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/staff.orthotal.com /etc/nginx/sites-enabled/
sudo nginx -t  # Test config
sudo systemctl reload nginx
```

Now visit `http://staff.orthotal.com` — should work!

## Step 6: Set Up HTTPS (Recommended)

### 6.1 Install Certbot
```bash
apt install -y certbot python3-certbot-nginx
```

### 6.2 Get certificate
```bash
sudo certbot certonly --nginx -d staff.orthotal.com
```

Follow the prompts. Let's Encrypt will verify domain ownership.

### 6.3 Update nginx config
```bash
sudo nano /etc/nginx/sites-available/staff.orthotal.com
```

Replace with:
```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name staff.orthotal.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name staff.orthotal.com;

    ssl_certificate /etc/letsencrypt/live/staff.orthotal.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staff.orthotal.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6.4 Reload nginx
```bash
sudo systemctl reload nginx
```

Now visit `https://staff.orthotal.com` — should have a green lock!

### 6.5 Auto-renew certificates
```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## Step 7: Verify Everything Works

1. Visit `https://staff.orthotal.com`
2. Login with demo credentials: `staff1 / staff123`
3. Watch a video (should see progress bar)
4. Complete all videos
5. Download certificate

## Step 8: Customize for Your Team

### Add more staff members

Edit the app on your server:
```bash
nano /opt/staff-training/server.js
```

Find this section (~line 50):
```javascript
// Insert default staff accounts
const hashedPassword1 = bcrypt.hashSync('staff123', 10);
const hashedPassword2 = bcrypt.hashSync('staff456', 10);

db.run(`INSERT OR IGNORE INTO users (username, password, name) VALUES (?, ?, ?)`,
  ['staff1', hashedPassword1, 'Staff Member 1']);
db.run(`INSERT OR IGNORE INTO users (username, password, name) VALUES (?, ?, ?)`,
  ['staff2', hashedPassword2, 'Staff Member 2']);
```

Add more entries:
```javascript
db.run(`INSERT OR IGNORE INTO users (username, password, name) VALUES (?, ?, ?)`,
  ['john_doe', bcrypt.hashSync('password123', 10), 'John Doe']);
db.run(`INSERT OR IGNORE INTO users (username, password, name) VALUES (?, ?, ?)`,
  ['jane_smith', bcrypt.hashSync('password456', 10), 'Jane Smith']);
```

Save, then restart:
```bash
cd /opt/staff-training
docker-compose restart
```

## Management Commands

### View logs
```bash
docker-compose logs -f
```

### Stop app
```bash
docker-compose down
```

### Restart app
```bash
docker-compose restart
```

### Backup database
```bash
cp /opt/staff-training/data/data.db /opt/staff-training/backups/data-$(date +%Y%m%d).db
```

### View database directly
```bash
cd /opt/staff-training
docker exec -it staff-training-app-1 sqlite3 /app/data.db
```

Then you can run SQL:
```sql
SELECT * FROM users;
SELECT * FROM progress;
SELECT * FROM completions;
```

## Troubleshooting

### "Connection refused" at subdomain?
```bash
# Check nginx is running
sudo systemctl status nginx

# Check Docker app is running
docker-compose ps

# Check logs
docker-compose logs
```

### "502 Bad Gateway"?
```bash
# App might be starting, wait a minute
# Check logs:
docker-compose logs app
```

### Reset everything (careful!)
```bash
# Stop and remove everything
docker-compose down -v

# Delete database
rm -rf data/

# Start fresh
docker-compose up -d
```

## Performance & Monitoring

Monitor resource usage:
```bash
docker stats staff-training-app-1
```

Set up log rotation to prevent disk issues:
```bash
# Create a new file
sudo nano /etc/logrotate.d/docker

# Add this content:
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  missingok
  delaycompress
  copytruncate
}
```

## Next Steps

- Share credentials with your team
- Create a welcome email with the link
- Monitor first logins to ensure everything works
- Plan for adding more videos/sections as needed

## Support

For issues:
1. Check docker logs: `docker-compose logs`
2. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify DNS: `nslookup staff.orthotal.com`
4. Test connectivity: `curl https://staff.orthotal.com`
