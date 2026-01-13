/**
 * Database Configuration
 * SQLite3 database using better-sqlite3 for synchronous operations
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'slop.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- Settings table (encrypted API keys storage)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  encrypted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, key)
);

-- Posts table (replaces Google Sheets)
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT UNIQUE NOT NULL,
  instruction TEXT,
  type TEXT,
  template TEXT,
  purpose TEXT,
  sample TEXT,
  keywords TEXT,
  status TEXT DEFAULT NULL CHECK(status IN (NULL, 'Queue', 'generated', 'Approved', 'Rejected', 'Posted')),
  variant_1 TEXT,
  variant_2 TEXT,
  variant_3 TEXT,
  choice INTEGER CHECK(choice IN (NULL, 1, 2, 3)),
  image_prompt_1 TEXT,
  image_prompt_2 TEXT,
  image_prompt_3 TEXT,
  image_url_1 TEXT,
  image_url_2 TEXT,
  image_url_3 TEXT,
  img_choice TEXT,
  additional_img TEXT,
  final_content TEXT,
  final_img TEXT,
  post_schedule DATETIME,
  posted_at DATETIME,
  linkedin_post_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Session tracking for workflow
CREATE TABLE IF NOT EXISTS workflow_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  total_posts INTEGER DEFAULT 0,
  processed_posts INTEGER DEFAULT 0,
  error_message TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_post_schedule ON posts(post_schedule);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_settings_user_key ON settings(user_id, key);
`;

// Run schema creation
db.exec(schema);

// Migrations: Add new columns to existing tables
try {
  const columns = db.prepare("PRAGMA table_info(posts)").all();
  const columnNames = columns.map(col => col.name);
  
  // Check if linkedin_post_url column exists, if not add it
  if (!columnNames.includes('linkedin_post_url')) {
    db.exec('ALTER TABLE posts ADD COLUMN linkedin_post_url TEXT');
    console.log('✓ Added linkedin_post_url column to posts table');
  }
  
  // Check if identification column exists, if not add it
  if (!columnNames.includes('identification')) {
    db.exec('ALTER TABLE posts ADD COLUMN identification TEXT');
    console.log('✓ Added identification column to posts table');
  }
} catch (error) {
  console.error('Migration error:', error);
}

console.log('✓ Database schema initialized');

module.exports = db;
