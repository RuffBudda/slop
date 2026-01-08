/**
 * User Management Routes
 * Handles user CRUD operations (admin only)
 */

const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * List all users (admin only)
 * GET /api/users
 */
router.get('/', requireAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, email, display_name, role, created_at, last_login
      FROM users
      ORDER BY created_at DESC
    `).all();

    res.json({ users });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * Get user by ID (admin only)
 * GET /api/users/:id
 */
router.get('/:id', requireAdmin, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, email, display_name, role, created_at, last_login
      FROM users WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * Create new user (admin only)
 * POST /api/users
 */
router.post('/', requireAdmin, async (req, res) => {
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

    // Check for existing user
    const existing = db.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).get(username, email);

    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, email, passwordHash, displayName || null, role || 'user');

    const newUser = db.prepare(`
      SELECT id, username, email, display_name, role, created_at
      FROM users WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ user: newUser });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * Update user (admin only)
 * PUT /api/users/:id
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { username, email, password, displayName, role } = req.body;

    // Check user exists
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (username) {
      // Check username uniqueness
      const usernameCheck = db.prepare(
        'SELECT id FROM users WHERE username = ? AND id != ?'
      ).get(username, userId);
      if (usernameCheck) {
        return res.status(400).json({ error: 'Username already in use' });
      }
      updates.push('username = ?');
      params.push(username);
    }

    if (email) {
      // Check email uniqueness
      const emailCheck = db.prepare(
        'SELECT id FROM users WHERE email = ? AND id != ?'
      ).get(email, userId);
      if (emailCheck) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updates.push('email = ?');
      params.push(email);
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      params.push(passwordHash);
    }

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      params.push(displayName || null);
    }

    if (role) {
      updates.push('role = ?');
      params.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updatedUser = db.prepare(`
      SELECT id, username, email, display_name, role, created_at, updated_at
      FROM users WHERE id = ?
    `).get(userId);

    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * Delete user (admin only)
 * DELETE /api/users/:id
 */
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check user exists
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if this is the last admin
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    if (user.role === 'admin') {
      const adminCount = db.prepare(
        'SELECT COUNT(*) as count FROM users WHERE role = ?'
      ).get('admin');
      if (adminCount.count <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin user' });
      }
    }

    // Delete user's settings
    db.prepare('DELETE FROM settings WHERE user_id = ?').run(userId);

    // Delete user
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
