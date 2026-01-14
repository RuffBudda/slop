/**
 * Authentication Routes
 * Handles user registration, login, logout
 */

const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database/db');
const { requireAuth, requireAdmin, checkSetupRequired } = require('../middleware/auth');

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
router.post('/register', requireAuth, requireAdmin, async (req, res) => {
  try {

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
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username or email
    const user = db.prepare(`
      SELECT * FROM users WHERE username = ? OR email = ?
    `).get(username, username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    if (!user.password_hash) {
      console.error('User found but password_hash is missing!', { userId: user.id, username: user.username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Regenerate session to prevent session fixation attacks and ensure fresh session
    return new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          // Fallback: just set session without regeneration
          req.session.userId = user.id;
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error('Session save error:', saveErr);
              return reject(saveErr);
            }
            return sendResponse();
          });
          return;
        }
        
        // Set session after regeneration
        req.session.userId = user.id;
        
        // Save session explicitly
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            return reject(saveErr);
          }
          return sendResponse();
        });
      });
      
      function sendResponse() {
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
        resolve();
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
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  try {
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
router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    // Validate ID is an integer
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
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
