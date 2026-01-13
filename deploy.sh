#!/bin/bash

# SLOP Deployment Script
# This script automates the deployment of SLOP on a new server
# Usage: ./deploy.sh <domain>

set -e  # Exit on error

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Usage: ./deploy.sh <domain>"
    echo "Example: ./deploy.sh slop.example.com"
    exit 1
fi

echo "=========================================="
echo "SLOP Deployment Script"
echo "Domain: $DOMAIN"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Update system
echo ""
echo "Step 1: Updating system packages..."
apt-get update
apt-get upgrade -y

# Install required packages
echo ""
echo "Step 2: Installing required packages..."
apt-get install -y curl git nginx certbot python3-certbot-nginx nodejs npm sqlite3

# Install PM2 globally
echo ""
echo "Step 3: Installing PM2..."
npm install -g pm2

# Create application directory
echo ""
echo "Step 4: Setting up application directory..."
APP_DIR="/opt/slop"
if [ -d "$APP_DIR" ]; then
    echo "Directory $APP_DIR already exists. Backing up..."
    mv "$APP_DIR" "${APP_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
fi
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Clone repository (assuming it's already cloned or will be cloned)
echo ""
echo "Step 5: Cloning repository..."
if [ ! -d ".git" ]; then
    echo "Please clone the repository to $APP_DIR first"
    echo "Example: git clone https://github.com/RuffBudda/slop.git $APP_DIR"
    read -p "Press Enter after cloning the repository..."
fi

# Install dependencies
echo ""
echo "Step 6: Installing Node.js dependencies..."
npm install

# Create .env file if it doesn't exist
echo ""
echo "Step 7: Setting up environment variables..."
if [ ! -f ".env" ]; then
    cp env.example.txt .env
    # Generate random session secret
    SESSION_SECRET=$(openssl rand -hex 32)
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
    # Update port if needed
    sed -i "s/PORT=.*/PORT=3000/" .env
    echo "Created .env file with generated SESSION_SECRET"
    echo "Please edit .env and add your API keys"
else
    echo ".env file already exists, skipping..."
fi

# Initialize database
echo ""
echo "Step 8: Initializing database..."
npm run migrate

# Configure Nginx
echo ""
echo "Step 9: Configuring Nginx..."
NGINX_CONFIG="/etc/nginx/sites-available/slop"
cat > "$NGINX_CONFIG" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Start application with PM2
echo ""
echo "Step 10: Starting application with PM2..."
cd "$APP_DIR"
pm2 start src/server.js --name slop
pm2 save
pm2 startup

# Reload Nginx
echo ""
echo "Step 11: Reloading Nginx..."
systemctl reload nginx

# Setup SSL with Let's Encrypt
echo ""
echo "Step 12: Setting up SSL certificate..."
read -p "Do you want to set up SSL with Let's Encrypt? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN --redirect
    echo "SSL certificate installed successfully!"
else
    echo "Skipping SSL setup. You can run 'certbot --nginx -d $DOMAIN' later."
fi

# Final instructions
echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Application is running at: http://$DOMAIN"
if certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    echo "SSL is configured: https://$DOMAIN"
fi
echo ""
echo "Next steps:"
echo "1. Edit $APP_DIR/.env and add your API keys"
echo "2. Restart the application: pm2 restart slop"
echo "3. Access the application and create your admin account"
echo ""
echo "Useful commands:"
echo "  - View logs: pm2 logs slop"
echo "  - Restart: pm2 restart slop"
echo "  - Stop: pm2 stop slop"
echo "  - Status: pm2 status"
echo ""
