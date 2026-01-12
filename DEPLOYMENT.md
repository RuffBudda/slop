# SLOP Deployment Guide

Complete guide for deploying SLOP (LinkedIn Content Automizer) on Ubuntu 22.04 LTS.

## Prerequisites

- Ubuntu 22.04 LTS server (DigitalOcean Droplet, AWS EC2, or similar)
- Root or sudo access
- Domain name (optional, but recommended for SSL)
- Git installed on server

## Quick Start

### 1. Connect to Server

```bash
ssh root@your-server-ip
# Or if using a non-root user:
ssh user@your-server-ip
sudo su
```

### 2. Update System

```bash
apt update && apt upgrade -y
```

### 3. Install Required Software

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install build tools (required for native Node.js modules)
apt install -y build-essential python3 git

# Install Nginx
apt install -y nginx

# Install PM2 (process manager)
npm install -g pm2
```

### 4. Create Application Directory

```bash
# Create application directory
mkdir -p /opt/slop
mkdir -p /opt/slop-backups

# Set permissions
chmod 755 /opt/slop
```

### 5. Deploy Application

```bash
# Navigate to application directory
cd /opt/slop

# Clone repository
git clone https://github.com/RuffBudda/slop.git .

# Verify files are present
ls -la
# Should show: package.json, src/, public/, etc.

# Verify public directory exists (critical for CSS/JS)
ls -la public/
ls -la public/css/styles.css
ls -la public/js/app.js

# If public directory is missing, restore from git:
# git checkout HEAD -- public/
```

### 6. Install Dependencies

```bash
cd /opt/slop
npm install --omit=dev
```

### 7. Create Environment File

```bash
# Generate secure session secret
SESSION_SECRET=$(openssl rand -base64 32)

# Create .env file
cat > /opt/slop/.env << EOF
PORT=3000
NODE_ENV=production
SESSION_SECRET=${SESSION_SECRET}
DATABASE_PATH=./data/slop.db
EOF

# Secure the .env file
chmod 600 /opt/slop/.env
```

### 8. Initialize Database

```bash
cd /opt/slop
npm run migrate
```

### 9. Start Application with PM2

```bash
cd /opt/slop

# Start the application
pm2 start src/server.js --name slop

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Copy and run the command that PM2 outputs
# It will look like: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

### 10. Configure Nginx

#### Option A: Using IP Address

```bash
cat > /etc/nginx/sites-available/slop << 'EOF'
server {
    listen 80;
    server_name _;

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
        
        # Timeouts for long-running AI requests
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    # Max upload size for images
    client_max_body_size 50M;
}
EOF
```

#### Option B: Using Domain Name

```bash
# Replace 'your-domain.com' with your actual domain
DOMAIN="your-domain.com"

cat > /etc/nginx/sites-available/slop << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts for long-running AI requests
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    # Max upload size for images
    client_max_body_size 50M;
}
EOF
```

**Enable the site:**

```bash
# Create symbolic link
ln -sf /etc/nginx/sites-available/slop /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

### 11. Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
echo "y" | ufw enable
```

### 12. Setup SSL with Let's Encrypt (Domain Only)

**⚠️ Only proceed if you have a domain name configured and DNS is pointing to your server.**

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Replace with your domain
DOMAIN="your-domain.com"

# Get SSL certificate
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}

# Follow the prompts:
# - Enter your email address
# - Agree to terms of service
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)

# Test auto-renewal
certbot renew --dry-run
```

**Verify DNS before SSL setup:**

```bash
# Check if DNS is pointing to your server
nslookup your-domain.com
# Should return your server's IP address

# Or use dig
dig your-domain.com +short
```

### 13. Setup Database Backups (Optional)

```bash
# Create daily backup script
cat > /etc/cron.daily/slop-backup << 'EOF'
#!/bin/bash
cp /opt/slop/data/slop.db /opt/slop-backups/slop-$(date +%Y%m%d).db
# Keep only last 30 days
find /opt/slop-backups -name "slop-*.db" -mtime +30 -delete
EOF

chmod +x /etc/cron.daily/slop-backup
```

## Verification

### Check Application Status

```bash
# PM2 status
pm2 status

# Application logs
pm2 logs slop --lines 20

# Health check
curl http://localhost:3000/api/health

# Test static files (CSS should load)
curl http://localhost:3000/css/styles.css | head -5
```

### Access Your Application

- **IP Address:** `http://your-server-ip`
- **Domain (HTTP):** `http://your-domain.com`
- **Domain (HTTPS):** `https://your-domain.com` (after SSL setup)

1. Visit the URL in your browser
2. Create your admin account on the setup page
3. Log in and configure API keys in Settings

## Maintenance

### View Logs

```bash
# Application logs
pm2 logs slop

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log
```

### Restart Application

```bash
pm2 restart slop
```

### Update Application

```bash
cd /opt/slop

# Pull latest changes
git pull origin master

# Install new dependencies (if any)
npm install --omit=dev

# Restart application
pm2 restart slop
```

### Backup Database Manually

```bash
cp /opt/slop/data/slop.db /opt/slop-backups/slop-$(date +%Y%m%d-%H%M%S).db
```

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs slop --lines 100

# Check if port is in use
lsof -i :3000

# Check PM2 status
pm2 status

# Verify file permissions
ls -la /opt/slop/
```

### Static Files Not Loading (No CSS/JS)

**Symptoms:** Page loads but has no styling, looks plain.

```bash
# 1. Verify public directory exists
ls -la /opt/slop/public/
ls -la /opt/slop/public/css/styles.css
ls -la /opt/slop/public/js/app.js

# 2. If files are missing, restore from git
cd /opt/slop
git checkout HEAD -- public/

# 3. Check file permissions
chmod -R 755 /opt/slop/public

# 4. Test static file access
curl http://localhost:3000/css/styles.css | head -10
# Should return CSS content, not 404

# 5. Check PM2 working directory
pm2 info slop | grep "cwd"
# Should show: /opt/slop

# 6. Check application logs for 404 errors
pm2 logs slop --lines 50 | grep -i "404\|css\|static"

# 7. Restart application
pm2 restart slop
```

### Database Issues

```bash
# Check if database exists
ls -la /opt/slop/data/

# Verify database is accessible
cd /opt/slop
npm run migrate

# Reset database (WARNING: deletes all data)
rm /opt/slop/data/slop.db
npm run migrate
```

### Nginx Issues

```bash
# Test configuration
nginx -t

# Check Nginx status
systemctl status nginx

# View error logs
tail -f /var/log/nginx/error.log

# Reload configuration
systemctl reload nginx
```

### SSL Certificate Issues

```bash
# Test certificate renewal
certbot renew --dry-run

# Force renewal
certbot renew --force-renewal

# Check certificate expiration
certbot certificates
```

## Security Best Practices

- [ ] Use strong `SESSION_SECRET` (auto-generated in step 7)
- [ ] Enable UFW firewall (step 11)
- [ ] Setup SSL with Let's Encrypt (step 12)
- [ ] Keep system updated: `apt update && apt upgrade -y`
- [ ] Use SSH keys instead of passwords
- [ ] Disable root login (optional but recommended)
- [ ] Regular database backups (step 13)
- [ ] Monitor application logs regularly

### Additional Hardening (Optional)

```bash
# Disable root SSH login
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
systemctl restart sshd

# Install fail2ban
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Automatic security updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

## Quick Reference

### Essential Commands

```bash
# View logs
pm2 logs slop

# Restart application
pm2 restart slop

# Stop application
pm2 stop slop

# Check status
pm2 status

# Update and restart
cd /opt/slop && git pull && npm install --omit=dev && pm2 restart slop
```

### File Locations

- **Application:** `/opt/slop`
- **Database:** `/opt/slop/data/slop.db`
- **Backups:** `/opt/slop-backups/`
- **Environment:** `/opt/slop/.env`
- **Nginx Config:** `/etc/nginx/sites-available/slop`
- **PM2 Config:** `~/.pm2/`

## Support

For issues:
1. Check the troubleshooting section above
2. Review application logs: `pm2 logs slop`
3. Check Nginx logs: `tail -f /var/log/nginx/error.log`
4. Verify all steps were completed correctly

---

**Note:** This guide assumes you're running commands as root. For production environments, consider using a dedicated non-root user for enhanced security.
