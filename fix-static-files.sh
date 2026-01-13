#!/bin/bash

# Quick fix script for static file serving issues
# Run this on your server: bash fix-static-files.sh

set -e

echo "🔍 Diagnosing static file serving issues..."

# Detect application path
if [ -d "/home/slop/app" ]; then
    APP_PATH="/home/slop/app"
elif [ -d "/opt/slop" ]; then
    APP_PATH="/opt/slop"
else
    echo "❌ Could not find application directory!"
    echo "   Checked: /home/slop/app and /opt/slop"
    exit 1
fi

echo "✓ Found application at: $APP_PATH"

# Check if CSS file exists
CSS_FILE="$APP_PATH/public/css/styles.css"
if [ ! -f "$CSS_FILE" ]; then
    echo "❌ CSS file not found at: $CSS_FILE"
    echo "   Checking git status..."
    cd "$APP_PATH"
    git status
    echo ""
    echo "   Try running: git checkout HEAD -- public/"
    exit 1
fi

echo "✓ CSS file exists: $CSS_FILE"

# Check file permissions
if [ ! -r "$CSS_FILE" ]; then
    echo "⚠️  CSS file is not readable. Fixing permissions..."
    chmod 644 "$CSS_FILE"
    chmod -R 755 "$APP_PATH/public"
    echo "✓ Fixed permissions"
else
    echo "✓ CSS file is readable"
fi

# Check Nginx configuration
NGINX_CONFIG="/etc/nginx/sites-available/slop"
if [ -f "$NGINX_CONFIG" ]; then
    echo "✓ Nginx config found: $NGINX_CONFIG"
    
    # Check if static files are configured
    if grep -q "location ~\* \\.(css|js" "$NGINX_CONFIG"; then
        echo "✓ Nginx is configured to serve static files"
        
        # Check if path matches
        NGINX_ROOT=$(grep "root" "$NGINX_CONFIG" | grep -v "#" | head -1 | awk '{print $2}' | tr -d ';')
        if [ -n "$NGINX_ROOT" ]; then
            echo "   Nginx root path: $NGINX_ROOT"
            if [ "$NGINX_ROOT" != "$APP_PATH/public" ]; then
                echo "⚠️  Nginx root path doesn't match application path!"
                echo "   Update Nginx config to use: root $APP_PATH/public;"
            fi
        fi
    else
        echo "⚠️  Nginx is not configured to serve static files directly"
        echo "   Consider updating Nginx config to serve static files for better performance"
    fi
else
    echo "⚠️  Nginx config not found at: $NGINX_CONFIG"
fi

# Test Node.js server
echo ""
echo "🧪 Testing Node.js static file serving..."
if curl -s http://localhost:3000/css/styles.css | head -1 | grep -q "SLOP\|/\*"; then
    echo "✓ Node.js is serving CSS correctly"
else
    echo "❌ Node.js is NOT serving CSS correctly"
    echo "   Check PM2 logs: pm2 logs slop"
fi

# Test Nginx (if configured for static files)
if grep -q "location ~\* \\.(css|js" "$NGINX_CONFIG" 2>/dev/null; then
    echo ""
    echo "🧪 Testing Nginx static file serving..."
    if curl -s http://localhost/css/styles.css | head -1 | grep -q "SLOP\|/\*"; then
        echo "✓ Nginx is serving CSS correctly"
    else
        echo "❌ Nginx is NOT serving CSS correctly"
        echo "   Check Nginx error log: tail -f /var/log/nginx/error.log"
    fi
fi

echo ""
echo "📋 Summary:"
echo "   Application path: $APP_PATH"
echo "   CSS file: $CSS_FILE"
echo "   File exists: $([ -f "$CSS_FILE" ] && echo 'Yes' || echo 'No')"
echo "   File readable: $([ -r "$CSS_FILE" ] && echo 'Yes' || echo 'No')"
echo ""
echo "💡 Next steps:"
echo "   1. If files are missing: cd $APP_PATH && git checkout HEAD -- public/"
echo "   2. If permissions wrong: chmod -R 755 $APP_PATH/public"
echo "   3. Restart services: pm2 restart slop && systemctl restart nginx"
echo "   4. Clear browser cache and hard refresh (Ctrl+Shift+R)"
