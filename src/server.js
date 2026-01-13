/**
 * SLOP Standalone Server
 * Main entry point for the Express application
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const db = require('./database/db');
const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const settingsRoutes = require('./routes/settings');
const workflowRoutes = require('./routes/workflow');
const usersRoutes = require('./routes/users');
const googleDriveRoutes = require('./routes/googleDrive');
const { initScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn-uicons.flaticon.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn-uicons.flaticon.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://cdweya.blr1.cdn.digitaloceanspaces.com"]
    }
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => {
    // Skip rate limiting for auth routes (they have their own limiter)
    return req.path.startsWith('/api/auth');
  }
});
app.use('/api/', limiter);

// Auth-specific rate limiter (more lenient for login)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per window
  message: { error: 'Too many login attempts, please try again later.' },
  skipSuccessfulRequests: true // Don't count successful logins
});
app.use('/api/auth/login', authLimiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'slop-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Static files - serve before other routes
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath, {
  maxAge: '1d', // Cache static files for 1 day
  etag: true,
  lastModified: true
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/google-drive', googleDriveRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint to verify static file path
app.get('/api/test-static', (req, res) => {
  const fs = require('fs');
  const cssPath = path.join(__dirname, '../public/css/styles.css');
  const exists = fs.existsSync(cssPath);
  res.json({ 
    exists, 
    path: cssPath,
    publicPath: publicPath,
    fileSize: exists ? fs.statSync(cssPath).size : 0
  });
});

// Serve index.html for all other routes (SPA support)
// Note: This should only catch routes that weren't handled by static files or API routes
app.get('*', (req, res, next) => {
  // Skip static file paths - these should be handled by express.static above
  // If we reach here for a static file, it means it wasn't found
  const staticPaths = ['/css/', '/js/', '/images/', '/fonts/'];
  const staticFileExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map'];
  
  const isStaticPath = staticPaths.some(p => req.path.startsWith(p));
  const isStaticFile = staticFileExtensions.some(ext => req.path.toLowerCase().endsWith(ext));
  
  if (isStaticPath || isStaticFile) {
    // Static file not found - return 404
    return res.status(404).send('File not found');
  }
  
  // Check if user is authenticated for protected routes
  if (!req.session.userId && !req.path.startsWith('/login') && !req.path.startsWith('/register') && !req.path.startsWith('/setup')) {
    // If no users exist, redirect to setup
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
      return res.redirect('/setup');
    }
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// Initialize database and start server
async function start() {
  try {
    // Ensure database is initialized
    console.log('✓ Database initialized');
    
    // Initialize scheduler for background jobs
    initScheduler();
    console.log('✓ Scheduler initialized');
    
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ███████╗██╗      ██████╗ ██████╗                        ║
║   ██╔════╝██║     ██╔═══██╗██╔══██╗                       ║
║   ███████╗██║     ██║   ██║██████╔╝                       ║
║   ╚════██║██║     ██║   ██║██╔═══╝                        ║
║   ███████║███████╗╚██████╔╝██║                            ║
║   ╚══════╝╚══════╝ ╚═════╝ ╚═╝                            ║
║                                                            ║
║   LinkedIn Content Automizer - Standalone Edition          ║
║                                                            ║
╠════════════════════════════════════════════════════════════╣
║   Server running on http://localhost:${PORT}                   ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
