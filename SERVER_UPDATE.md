# Server Update Instructions

Quick guide for updating the SLOP instance on the server after pulling changes from the repository.

## Prerequisites

- SSH access to the server
- Application running at `/opt/slop` (or your configured path)
- PM2 managing the application process

## Update Process

### 1. Connect to Server

```bash
ssh root@your-server-ip
# Or if using a non-root user:
ssh user@your-server-ip
sudo su
```

### 2. Navigate to Application Directory

```bash
cd /opt/slop
# Or your configured path
```

### 3. Pull Latest Changes

```bash
# Fetch and pull latest changes from repository
git pull origin master

# If you get merge conflicts, you may need to:
# git stash
# git pull origin master
# git stash pop
```

### 4. Install/Update Dependencies

```bash
# Install any new dependencies
npm install --omit=dev

# If package-lock.json changed significantly:
# rm -rf node_modules package-lock.json
# npm install --omit=dev
```

### 5. Run Database Migrations (if needed)

```bash
# Run any new database migrations
npm run migrate
```

### 6. Restart Application

```bash
# Restart the application with PM2
pm2 restart slop

# Or if you need to reload (zero-downtime):
# pm2 reload slop
```

### 7. Verify Application is Running

```bash
# Check PM2 status
pm2 status

# Check application logs
pm2 logs slop --lines 20

# Test health endpoint
curl http://localhost:3000/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

### 8. Check for Errors

```bash
# Monitor logs for errors
pm2 logs slop --err

# Check Nginx logs if using reverse proxy
tail -f /var/log/nginx/error.log
```

## Quick Update Script

You can create a simple update script for faster updates:

```bash
cat > /opt/slop/update.sh << 'EOF'
#!/bin/bash
set -e

cd /opt/slop
echo "Pulling latest changes..."
git pull origin master

echo "Installing dependencies..."
npm install --omit=dev

echo "Running migrations..."
npm run migrate || true

echo "Restarting application..."
pm2 restart slop

echo "Waiting for application to start..."
sleep 3

echo "Checking status..."
pm2 status slop

echo "Update complete!"
EOF

chmod +x /opt/slop/update.sh
```

Then you can simply run:

```bash
/opt/slop/update.sh
```

## Rollback Instructions

If something goes wrong and you need to rollback:

```bash
cd /opt/slop

# View commit history
git log --oneline -10

# Rollback to previous commit (replace COMMIT_HASH with actual hash)
git reset --hard COMMIT_HASH

# Or rollback to previous version
git reset --hard HEAD~1

# Reinstall dependencies
npm install --omit=dev

# Restart application
pm2 restart slop
```

## Pre-Update Checklist

Before updating, consider:

- [ ] **Backup database** (if important data exists):
  ```bash
  cp /opt/slop/data/slop.db /opt/slop-backups/slop-$(date +%Y%m%d-%H%M%S).db
  ```

- [ ] **Check current version/commit**:
  ```bash
  cd /opt/slop
  git log -1 --oneline
  ```

- [ ] **Review changelog** (if available):
  ```bash
  cat CHANGELOG.md
  ```

- [ ] **Check for breaking changes** in the update

- [ ] **Verify server has enough disk space**:
  ```bash
  df -h
  ```

## Post-Update Verification

After updating, verify:

- [ ] Application is running: `pm2 status slop`
- [ ] Health endpoint responds: `curl http://localhost:3000/api/health`
- [ ] Web interface loads correctly
- [ ] No errors in logs: `pm2 logs slop --err --lines 50`
- [ ] Database migrations completed successfully
- [ ] All features work as expected

## Troubleshooting

### Application Won't Start After Update

```bash
# Check logs for errors
pm2 logs slop --lines 100

# Check if dependencies installed correctly
ls -la node_modules/

# Verify Node.js version
node --version

# Try reinstalling dependencies
rm -rf node_modules package-lock.json
npm install --omit=dev
pm2 restart slop
```

### Database Migration Errors

```bash
# Check migration status
npm run migrate

# If migration fails, check database integrity
cd /opt/slop
sqlite3 data/slop.db "PRAGMA integrity_check;"

# Backup before manual fixes
cp data/slop.db data/slop.db.backup
```

### Static Files Not Loading

```bash
# Verify public directory exists
ls -la /opt/slop/public/

# Check file permissions
chmod -R 755 /opt/slop/public

# Restart application
pm2 restart slop
```

## Automated Updates (Optional)

For automated updates via cron (not recommended for production without testing):

```bash
# Add to crontab (runs daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * cd /opt/slop && /opt/slop/update.sh >> /var/log/slop-update.log 2>&1
```

**Warning:** Automated updates can break production. Always test updates in a staging environment first.

## Notes

- Always backup before major updates
- Test updates in a staging environment when possible
- Monitor logs after updates
- Keep PM2 process list saved: `pm2 save`
- Document any manual changes needed for your specific setup

---

**Last Updated:** Check git commit date for latest changes
