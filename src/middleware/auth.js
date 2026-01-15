/**
 * Authentication Middleware
 * Protects routes requiring authentication
 */

const db = require('../database/db');

/**
 * Require authentication for API routes
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    res.clearCookie('slop.sid', { path: '/' });
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Attach user to request
  const user = db.prepare('SELECT id, username, email, display_name, role FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return req.session.destroy(() => {
      res.clearCookie('slop.sid', { path: '/' });
      return res.status(401).json({ error: 'User not found' });
    });
  }
  
  req.user = user;
  req.session.touch();
  next();
}

/**
 * Require admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Check if any users exist (for setup flow)
 */
function checkSetupRequired(req, res, next) {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  req.setupRequired = userCount.count === 0;
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  checkSetupRequired
};
