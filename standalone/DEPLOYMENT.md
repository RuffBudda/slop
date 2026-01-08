# SLOP Deployment Guide

This guide covers deploying SLOP to a DigitalOcean Ubuntu droplet.

## Prerequisites

- A DigitalOcean account
- An Ubuntu 22.04 droplet (recommended: 1GB RAM, 1 vCPU minimum)
- A domain name (optional, for HTTPS)
- API keys for OpenAI, Stability AI, and DigitalOcean Spaces

## Quick Start

### 1. Create a Droplet

1. Log into DigitalOcean
2. Click **Create** → **Droplets**
3. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic, Regular Intel, $6/month (1GB/1vCPU)
   - **Region**: Choose closest to your users
   - **Authentication**: SSH Key (recommended) or Password
4. Click **Create Droplet**

### 2. Connect to Your Droplet

```bash
ssh root@your-droplet-ip
```

### 3. Run Automated Setup

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install build tools (for native modules)
apt install -y build-essential python3

# Create app user
useradd -m -s /bin/bash slop
mkdir -p /home/slop/app
chown slop:slop /home/slop/app

# Switch to app user
su - slop
cd /home/slop/app
```

### 4. Deploy Application

```bash
# Clone or upload your application
# Option A: Git clone (if in a repo)
git clone https://your-repo-url.git .

# Option B: Upload via SCP from your local machine
# (run from local machine)
scp -r ./standalone/* root@your-droplet-ip:/home/slop/app/

# Install dependencies
npm install --production

# Create environment file
cp env.example.txt .env
nano .env
```

### 5. Configure Environment

Edit `.env` with production settings:

```env
PORT=3000
NODE_ENV=production
SESSION_SECRET=generate-a-strong-random-string-at-least-32-chars

# Database
DATABASE_PATH=./data/slop.db

# API Keys (optional - can set in UI)
OPENAI_API_KEY=sk-...
STABILITY_API_KEY=sk-...
SPACES_NAME=your-space
SPACES_REGION=blr1
SPACES_KEY=...
SPACES_SECRET=...
```

Generate a secure session secret:
```bash
openssl rand -base64 32
```

### 6. Initialize Database

```bash
npm run migrate
```

### 7. Test the Application

```bash
npm start
```

Visit `http://your-droplet-ip:3000` to verify it works.

Press `Ctrl+C` to stop.

## Production Setup

### 8. Install PM2 (Process Manager)

```bash
# Switch back to root
exit

# Install PM2 globally
npm install -g pm2

# Switch to slop user
su - slop
cd /home/slop/app

# Start with PM2
pm2 start src/server.js --name slop

# Save process list
pm2 save

# Setup startup script (as root)
exit
pm2 startup systemd -u slop --hp /home/slop
```

### 9. Install and Configure Nginx

```bash
# Install Nginx
apt install -y nginx

# Create Nginx config
nano /etc/nginx/sites-available/slop
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # or use your IP

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
        
        # Increase timeouts for long-running AI requests
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    # Increase max body size for image uploads
    client_max_body_size 50M;
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/slop /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### 10. Configure Firewall

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

### 11. Setup SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

## Maintenance

### View Logs

```bash
# Application logs
su - slop
pm2 logs slop

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Restart Application

```bash
su - slop
pm2 restart slop
```

### Update Application

```bash
su - slop
cd /home/slop/app

# Pull updates (if using git)
git pull

# Or upload new files via SCP

# Install any new dependencies
npm install --production

# Restart
pm2 restart slop
```

### Backup Database

```bash
# Backup
cp /home/slop/app/data/slop.db /home/slop/backups/slop-$(date +%Y%m%d).db

# Automate with cron
crontab -e
# Add: 0 3 * * * cp /home/slop/app/data/slop.db /home/slop/backups/slop-$(date +%Y%m%d).db
```

## Security Checklist

- [ ] Use strong SESSION_SECRET
- [ ] Enable UFW firewall
- [ ] Setup SSL with Let's Encrypt
- [ ] Disable root SSH login
- [ ] Setup SSH key authentication
- [ ] Regular system updates (`apt update && apt upgrade`)
- [ ] Monitor logs for suspicious activity
- [ ] Backup database regularly
- [ ] Use fail2ban for SSH protection

### Additional Security Hardening

```bash
# Disable root login
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

## Monitoring

### Setup Simple Monitoring

```bash
# Install htop for resource monitoring
apt install -y htop

# PM2 monitoring
pm2 monit

# Check application status
pm2 status
```

### Health Check Endpoint

The application exposes `/api/health` for monitoring:

```bash
curl http://localhost:3000/api/health
# Returns: {"status":"ok","timestamp":"..."}
```

You can use this with uptime monitoring services like:
- UptimeRobot
- Pingdom
- DigitalOcean Monitoring

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs slop --lines 100

# Check if port is in use
lsof -i :3000

# Check permissions
ls -la /home/slop/app/
```

### Database Issues

```bash
# Check if database exists
ls -la /home/slop/app/data/

# Reset database (WARNING: deletes all data)
rm /home/slop/app/data/slop.db
su - slop
cd /home/slop/app
npm run migrate
```

### Nginx Issues

```bash
# Test configuration
nginx -t

# Check status
systemctl status nginx

# Reload after changes
systemctl reload nginx
```

### SSL Certificate Issues

```bash
# Renew certificate manually
certbot renew --dry-run

# Force renewal
certbot renew --force-renewal
```

## Scaling

For higher traffic:

1. **Vertical Scaling**: Upgrade droplet size
2. **Database**: Consider migrating to PostgreSQL or managed database
3. **Caching**: Add Redis for session storage
4. **CDN**: Use DigitalOcean Spaces CDN for images
5. **Load Balancing**: Add multiple droplets behind a load balancer

## Cost Estimation

| Service | Monthly Cost |
|---------|--------------|
| Basic Droplet (1GB) | $6 |
| DO Spaces (250GB) | $5 |
| Domain (optional) | ~$1 |
| **Total** | **~$12/month** |

Plus API costs:
- OpenAI: ~$0.01-0.03 per post
- Stability AI: ~$0.02-0.05 per image

## Support

For deployment issues:
1. Check the troubleshooting section above
2. Review DigitalOcean documentation
3. Check application logs with `pm2 logs`
