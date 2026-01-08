#!/bin/bash

# SLOP Deployment Script
# Run this on a fresh Ubuntu 22.04 server

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   SLOP Deployment Script                                   ║"
echo "║   LinkedIn Content Automizer - Standalone Edition          ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}" 
   exit 1
fi

echo -e "${YELLOW}Updating system packages...${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}Installing Node.js 20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo -e "${YELLOW}Installing build tools...${NC}"
apt install -y build-essential python3 git nginx

echo -e "${YELLOW}Installing PM2...${NC}"
npm install -g pm2

echo -e "${YELLOW}Creating application user...${NC}"
if ! id "slop" &>/dev/null; then
    useradd -m -s /bin/bash slop
fi
mkdir -p /home/slop/app
mkdir -p /home/slop/backups

echo -e "${YELLOW}Setting up application directory...${NC}"
if [ -d "/root/slop-standalone" ]; then
    cp -r /root/slop-standalone/* /home/slop/app/
fi

chown -R slop:slop /home/slop

echo -e "${YELLOW}Installing application dependencies...${NC}"
cd /home/slop/app
su - slop -c "cd /home/slop/app && npm install --production"

# Generate session secret if .env doesn't exist
if [ ! -f "/home/slop/app/.env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    SESSION_SECRET=$(openssl rand -base64 32)
    cat > /home/slop/app/.env << EOF
PORT=3000
NODE_ENV=production
SESSION_SECRET=${SESSION_SECRET}
DATABASE_PATH=./data/slop.db
EOF
    chown slop:slop /home/slop/app/.env
    chmod 600 /home/slop/app/.env
fi

echo -e "${YELLOW}Initializing database...${NC}"
su - slop -c "cd /home/slop/app && npm run migrate"

echo -e "${YELLOW}Setting up PM2...${NC}"
su - slop -c "cd /home/slop/app && pm2 start src/server.js --name slop"
su - slop -c "pm2 save"
env PATH=$PATH:/usr/bin pm2 startup systemd -u slop --hp /home/slop

echo -e "${YELLOW}Configuring Nginx...${NC}"
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
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    client_max_body_size 50M;
}
EOF

ln -sf /etc/nginx/sites-available/slop /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo -e "${YELLOW}Configuring firewall...${NC}"
ufw allow 22
ufw allow 80
ufw allow 443
echo "y" | ufw enable

echo -e "${YELLOW}Setting up database backup cron...${NC}"
cat > /etc/cron.daily/slop-backup << 'EOF'
#!/bin/bash
cp /home/slop/app/data/slop.db /home/slop/backups/slop-$(date +%Y%m%d).db
# Keep only last 30 days
find /home/slop/backups -name "slop-*.db" -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/slop-backup

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║   SLOP deployment complete!                                ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║   Access your application at:                              ║${NC}"
echo -e "${GREEN}║   http://$(curl -s ifconfig.me)                            ${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║   Next steps:                                              ║${NC}"
echo -e "${GREEN}║   1. Visit the URL above                                   ║${NC}"
echo -e "${GREEN}║   2. Create your admin account                             ║${NC}"
echo -e "${GREEN}║   3. Go to Settings to configure API keys                  ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║   For SSL, run:                                            ║${NC}"
echo -e "${GREEN}║   certbot --nginx -d your-domain.com                       ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
