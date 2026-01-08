/**
 * Reset Admin Password Script
 * Resets the admin user's password to a known value
 */

require('dotenv').config();
const db = require('../database/db');
const bcrypt = require('bcrypt');

async function resetAdminPassword() {
  try {
    const newPassword = process.argv[2] || 'admin123';
    
    console.log('Resetting admin password...');
    
    // Find admin user
    const user = db.prepare('SELECT id, username FROM users WHERE username = ? OR role = ?').get('admin', 'admin');
    
    if (!user) {
      console.error('Admin user not found!');
      process.exit(1);
    }
    
    console.log(`Found user: ${user.username} (ID: ${user.id})`);
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update password
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(passwordHash, user.id);
    
    console.log(`✓ Password reset successfully!`);
    console.log(`  Username: ${user.username}`);
    console.log(`  New password: ${newPassword}`);
    console.log(`  Hash: ${passwordHash.substring(0, 20)}...`);
    
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

resetAdminPassword();
