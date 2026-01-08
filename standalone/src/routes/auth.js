/**
 * Authentication Routes
 * Handles user registration, login, logout
 */

const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database/db');
const { requireAuth, checkSetupRequired } = require('../middleware/auth');

const router = express.Router();

/**
 * Check authentication status
 * GET /api/auth/status
 */
router.get('/status', checkSetupRequired, (req, res) => {
  if (req.session.userId) {
    const user = db.prepare('SELECT id, username, email, display_name, role FROM users WHERE id = ?').get(req.session.userId);
    if (user) {
      return res.json({
        authenticated: true,
        user,
        setupRequired: false
      });
    }
  }
  
  res.json({
    authenticated: false,
    user: null,
    setupRequired: req.setupRequired
  });
});

/**
 * Initial setup - Create first admin user
 * POST /api/auth/setup
 */
router.post('/setup', checkSetupRequired, async (req, res) => {
  try {
    // Only allow setup if no users exist
    if (!req.setupRequired) {
      return res.status(400).json({ error: 'Setup already completed' });
    }

    const { username, email, password, displayName } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, 'admin')
    `).run(username, email, passwordHash, displayName || username);

    // Auto-login the new user
    req.session.userId = result.lastInsertRowid;

    const user = db.prepare('SELECT id, username, email, display_name, role FROM users WHERE id = ?').get(result.lastInsertRowid);

    res.json({
      success: true,
      message: 'Setup completed successfully',
      user
    });

  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Setup failed' });
  }
});

/**
 * User registration
 * POST /api/auth/register
 */
router.post('/register', requireAuth, async (req, res) => {
  try {
    // Only admins can create new users
    const currentUser = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create new users' });
    }

    const { username, email, password, displayName, role } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userRole = role === 'admin' ? 'admin' : 'user';
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, email, passwordHash, displayName || username, userRole);

    const user = db.prepare('SELECT id, username, email, display_name, role FROM users WHERE id = ?').get(result.lastInsertRowid);

    res.json({
      success: true,
      message: 'User created successfully',
      user
    });

  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * User login
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  console.log('LOGIN ROUTE HIT - Starting login attempt');
  try {
    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = 'd:\\SLOP\\.cursor\\debug.log';
      const logDir = path.dirname(logPath);
      console.log('Log path:', logPath, 'Dir exists:', fs.existsSync(logDir));
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
        console.log('Created log directory');
      }
      const logEntry = JSON.stringify({location:'auth.js:login-entry',message:'Login endpoint called',data:{bodyType:typeof req.body,bodyKeys:Object.keys(req.body||{}),rawBody:JSON.stringify(req.body).substring(0,200),hasContentType:!!req.headers['content-type']},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})+'\n';
      fs.appendFileSync(logPath, logEntry);
      console.log('Successfully wrote log entry');
    } catch (logErr) {
      console.error('Logging error:', logErr.message, logErr.stack);
    }
    // #endregion
    
    const { username, password } = req.body;

    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = 'd:\\SLOP\\.cursor\\debug.log';
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry2 = JSON.stringify({location:'auth.js:login-parsed',message:'Request body parsed',data:{hasUsername:!!username,hasPassword:!!password,usernameValue:username,usernameLength:username?.length||0,passwordLength:password?.length||0,usernameType:typeof username,passwordType:typeof password},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})+'\n';
      fs.appendFileSync(logPath, logEntry2);
    } catch (logErr) {}
    // #endregion

    if (!username || !password) {
      // #region agent log
      try {
        const fs = require('fs');
        const path = require('path');
        const logPath = 'd:\\SLOP\\.cursor\\debug.log';
        const logDir = path.dirname(logPath);
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logEntry3 = JSON.stringify({location:'auth.js:login-validation-failed',message:'Missing username or password',data:{hasUsername:!!username,hasPassword:!!password},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})+'\n';
        fs.appendFileSync(logPath, logEntry3);
      } catch (logErr) {}
      // #endregion
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = 'd:\\SLOP\\.cursor\\debug.log';
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
      const logEntry4 = JSON.stringify({location:'auth.js:user-count',message:'Total users in DB',data:{userCount:userCount.count},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n';
      fs.appendFileSync(logPath, logEntry4);
    } catch (logErr) {}
    // #endregion

    // Find user by username or email
    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = 'd:\\SLOP\\.cursor\\debug.log';
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry5 = JSON.stringify({location:'auth.js:before-user-lookup',message:'About to query user',data:{searchUsername:username,searchEmail:username},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n';
      fs.appendFileSync(logPath, logEntry5);
    } catch (logErr) {}
    // #endregion
    
    const user = db.prepare(`
      SELECT * FROM users WHERE username = ? OR email = ?
    `).get(username, username);

    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = 'd:\\SLOP\\.cursor\\debug.log';
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry6 = JSON.stringify({location:'auth.js:user-lookup',message:'User lookup result',data:{userFound:!!user,userId:user?.id,userUsername:user?.username,userEmail:user?.email,userColumns:user?Object.keys(user):[],hasPasswordHash:user?.password_hash?true:false,passwordHashLength:user?.password_hash?.length||0,passwordHashType:typeof user?.password_hash,passwordHashFirstChars:user?.password_hash?.substring(0,20)||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C,F'})+'\n';
      fs.appendFileSync(logPath, logEntry6);
    } catch (logErr) {}
    // #endregion

    if (!user) {
      // #region agent log
      try {
        const fs = require('fs');
        const path = require('path');
        const logPath = 'd:\\SLOP\\.cursor\\debug.log';
        const logDir = path.dirname(logPath);
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logEntry7 = JSON.stringify({location:'auth.js:user-not-found',message:'User not found - returning invalid credentials',data:{searchedFor:username},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})+'\n';
        fs.appendFileSync(logPath, logEntry7);
      } catch (logErr) {}
      // #endregion
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    if (!user.password_hash) {
      console.error('User found but password_hash is missing!', { userId: user.id, username: user.username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = 'd:\\SLOP\\.cursor\\debug.log';
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry8 = JSON.stringify({location:'auth.js:before-password-compare',message:'About to compare password',data:{passwordLength:password.length,passwordHashLength:user.password_hash?.length||0,passwordHashExists:!!user.password_hash,hashFirstChars:user.password_hash?.substring(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n';
      fs.appendFileSync(logPath, logEntry8);
    } catch (logErr) {}
    // #endregion
    
    const validPassword = await bcrypt.compare(password, user.password_hash);

    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = 'd:\\SLOP\\.cursor\\debug.log';
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry9 = JSON.stringify({location:'auth.js:password-compare',message:'Password comparison result',data:{validPassword,passwordProvided:password?.length||0,hashStartsWith:user.password_hash?.substring(0,7),hashLength:user.password_hash?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n';
      fs.appendFileSync(logPath, logEntry9);
    } catch (logErr) {}
    // #endregion

    if (!validPassword) {
      // #region agent log
      try {
        const fs = require('fs');
        const path = require('path');
        const logPath = 'd:\\SLOP\\.cursor\\debug.log';
        const logDir = path.dirname(logPath);
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logEntry10 = JSON.stringify({location:'auth.js:password-invalid',message:'Password invalid - returning invalid credentials',data:{passwordLength:password.length,hashLength:user.password_hash?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n';
        fs.appendFileSync(logPath, logEntry10);
      } catch (logErr) {}
      // #endregion
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Set session
    req.session.userId = user.id;

    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = 'd:\\SLOP\\.cursor\\debug.log';
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logEntry11 = JSON.stringify({location:'auth.js:login-success',message:'Login successful',data:{userId:user.id,username:user.username,hasSession:!!req.session.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'ALL'})+'\n';
      fs.appendFileSync(logPath, logEntry11);
    } catch (logErr) {}
    // #endregion

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * User logout
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

/**
 * Change password
 * POST /api/auth/change-password
 */
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Get current user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newPasswordHash, user.id);

    res.json({ success: true, message: 'Password changed successfully' });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

/**
 * Get all users (admin only)
 * GET /api/auth/users
 */
router.get('/users', requireAuth, (req, res) => {
  try {
    const currentUser = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = db.prepare(`
      SELECT id, username, email, display_name, role, created_at, last_login
      FROM users
      ORDER BY created_at DESC
    `).all();

    res.json({ users });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

/**
 * Delete user (admin only)
 * DELETE /api/auth/users/:id
 */
router.delete('/users/:id', requireAuth, (req, res) => {
  try {
    const currentUser = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const userId = parseInt(req.params.id);
    
    // Prevent self-deletion
    if (userId === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Prevent deleting the last admin
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
    const targetUser = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    
    if (targetUser?.role === 'admin' && adminCount.count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin user' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ success: true, message: 'User deleted successfully' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
