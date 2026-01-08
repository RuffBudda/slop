/**
 * Database Migration Script
 * Run this to set up or update the database schema
 */

require('dotenv').config();
const db = require('./db');

console.log('Running migrations...');

// Add any new migrations here
const migrations = [
  // Migration 1: Initial schema (already in db.js)
  // Future migrations can be added here
];

migrations.forEach((migration, index) => {
  try {
    db.exec(migration);
    console.log(`✓ Migration ${index + 1} completed`);
  } catch (error) {
    console.error(`✗ Migration ${index + 1} failed:`, error.message);
  }
});

console.log('Migrations completed!');
process.exit(0);
