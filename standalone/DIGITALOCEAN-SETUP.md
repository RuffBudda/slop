# DigitalOcean Deployment Guide for SLOP

This guide will walk you through deploying SLOP (LinkedIn Content Automizer) on a DigitalOcean Ubuntu droplet.

## Prerequisites

- DigitalOcean account
- Domain name (optional, but recommended for SSL)
- Basic familiarity with command line

## Step 1: Create a Droplet

1. Log in to [DigitalOcean](https://cloud.digitalocean.com/)
2. Click **Create** → **Droplets**
3. Choose settings:
   - **Image**: Ubuntu 24.04 LTS x64
   - **Plan**: Basic → Regular (minimum $6/month, 1GB RAM)
   - **Datacenter**: Choose closest to your users
   - **Authentication**: SSH keys (recommended) or Password
   - **Hostname**: `slop-server`
4. Click **Create Droplet**

## Step 2: Initial Server Setup

SSH into your droplet:

```bash
ssh root@YOUR_DROPLET_IP
```

### Update System

```bash
apt update && apt upgrade -y
```

### Create a Non-Root User

```bash
adduser slop
usermod -aG sudo slop
```

### Setup Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Switch to Non-Root User

```bash
su - slop
```

## Step 3: Install Node.js

```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

## Step 4: Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

## Step 5: Clone and Setup Application

```bash
# Create app directory
sudo mkdir -p /var/www/slop
sudo chown -R slop:slop /var/www/slop

# Clone your repository (or upload files)
cd /var/www/slop

# Option A: Clone from Git
git clone https://github.com/YOUR_USERNAME/slop.git .

# Option B: Upload files via SCP (from your local machine)
# scp -r ./standalone/* slop@YOUR_DROPLET_IP:/var/www/slop/
```

### Install Dependencies

```bash
cd /var/www/slop
npm install --production
```

### Create Environment File

```bash
nano .env
```

Add the following configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Security - CHANGE THESE!
SESSION_SECRET=generate-a-long-random-string-here-min-32-chars

# Database
DATABASE_PATH=./data/slop.db

# Optional: API Keys (can be set via UI later)
# OPENAI_API_KEY=sk-...
# STABILITY_API_KEY=sk-...
# SPACES_NAME=your-space-name
# SPACES_REGION=blr1
# SPACES_KEY=your-access-key
# SPACES_SECRET=your-secret-key
```

Generate a secure session secret:

```bash
openssl rand -base64 32
```

### Create Data Directory

```bash
mkdir -p data
chmod 755 data
```

## Step 6: Setup PM2

Create an ecosystem file:

```bash
nano ecosystem.config.js
```

Add:

```javascript
module.exports = {
  apps: [{
    name: 'slop',
    script: 'src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

Start the application:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Copy and run the command PM2 outputs to enable auto-start on boot.

## Step 7: Install and Configure Nginx

```bash
sudo apt install nginx -y
```

### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/slop
```

Add (replace `your-domain.com` or use the IP address):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    # Or for IP-only: server_name YOUR_DROPLET_IP;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
}
```

### Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/slop /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## Step 8: Setup SSL with Let's Encrypt (If Using Domain)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts. Certbot will automatically configure SSL and set up auto-renewal.

## Step 9: Access Your Application

1. Open your browser and go to:
   - With domain: `https://your-domain.com`
   - Without domain: `http://YOUR_DROPLET_IP`

2. You'll see the **Setup** page to create your admin account

3. After setup, log in and configure your API keys in **Settings**

## Step 10: DigitalOcean Spaces Setup (For Image Storage)

### Create a Space

1. Go to DigitalOcean Control Panel → **Spaces**
2. Click **Create a Space**
3. Choose region (e.g., `blr1` for Bangalore)
4. Choose a unique name
5. Enable **CDN** for faster delivery
6. Click **Create a Space**

### Generate API Keys

1. Go to **API** → **Spaces Keys**
2. Click **Generate New Key**
3. Save both the Access Key and Secret Key

### Configure in SLOP

In the SLOP Settings panel:
- **Space Name**: Your space name
- **Region**: e.g., `blr1`
- **Access Key**: Your generated key
- **Secret Key**: Your secret

Click **Test** to verify the connection.

## Maintenance Commands

### View Application Logs

```bash
pm2 logs slop
```

### Restart Application

```bash
pm2 restart slop
```

### Stop Application

```bash
pm2 stop slop
```

### Update Application

```bash
cd /var/www/slop
git pull origin main  # or upload new files
npm install --production
pm2 restart slop
```

### Backup Database

```bash
# Create a backup
cp /var/www/slop/data/slop.db /var/www/slop/data/slop.db.backup.$(date +%Y%m%d)

# Or automate with cron
crontab -e
# Add: 0 2 * * * cp /var/www/slop/data/slop.db /var/www/slop/data/slop.db.backup.$(date +\%Y\%m\%d)
```

## Troubleshooting

### Application Not Starting

```bash
# Check PM2 status
pm2 status

# View error logs
pm2 logs slop --err

# Check if port 3000 is in use
sudo lsof -i :3000
```

### Nginx Issues

```bash
# Test configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### Database Issues

```bash
# Check database file permissions
ls -la /var/www/slop/data/

# Ensure correct ownership
sudo chown -R slop:slop /var/www/slop/data
```

### SSL Certificate Renewal

Certbot sets up auto-renewal automatically. To test:

```bash
sudo certbot renew --dry-run
```

## Security Best Practices

1. **Keep system updated**: `sudo apt update && sudo apt upgrade -y`
2. **Use SSH keys** instead of passwords
3. **Enable fail2ban**: `sudo apt install fail2ban`
4. **Regularly backup** your database
5. **Use strong passwords** for the SLOP admin account
6. **Keep API keys secure** - they're encrypted in the database

## Quick Deploy Script

Save this as `deploy.sh` for easy updates:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying SLOP..."

cd /var/www/slop

# Pull latest changes (if using git)
# git pull origin main

# Install dependencies
npm install --production

# Restart application
pm2 restart slop

echo "✅ Deployment complete!"
pm2 status
```

Make it executable:

```bash
chmod +x deploy.sh
```

Run with:

```bash
./deploy.sh
```

---

## Need Help?

- Check the [README.md](./README.md) for general documentation
- View application logs: `pm2 logs slop`
- View Nginx logs: `sudo tail -f /var/log/nginx/error.log`
