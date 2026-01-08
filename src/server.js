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
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
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
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

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
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

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

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
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
