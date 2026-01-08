/**
 * Database Seed Script
 * Creates initial data for testing
 */

require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('Seeding database...');

  try {
    // Create admin user if not exists
    const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    
    if (!adminExists) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      db.prepare(`
        INSERT INTO users (username, email, password_hash, display_name, role)
        VALUES (?, ?, ?, ?, ?)
      `).run('admin', 'admin@example.com', passwordHash, 'Administrator', 'admin');
      console.log('✓ Admin user created (username: admin, password: admin123)');
    } else {
      console.log('• Admin user already exists');
    }

    // Create sample posts for testing
    const postCount = db.prepare('SELECT COUNT(*) as count FROM posts').get();
    
    if (postCount.count === 0) {
      const samplePosts = [
        {
          post_id: `POST-${uuidv4().substring(0, 8)}`,
          instruction: 'Create a thought leadership post about AI in business',
          type: 'Thought Leadership',
          template: 'Hook → Story → Insight → CTA',
          purpose: 'Establish expertise',
          sample: 'AI is transforming how we work...',
          keywords: 'AI, business, transformation, leadership'
        },
        {
          post_id: `POST-${uuidv4().substring(0, 8)}`,
          instruction: 'Share a personal career lesson',
          type: 'Personal Story',
          template: 'Challenge → Solution → Lesson',
          purpose: 'Build connection',
          sample: 'Five years ago I made a mistake...',
          keywords: 'career, lessons, growth, personal'
        },
        {
          post_id: `POST-${uuidv4().substring(0, 8)}`,
          instruction: 'Announce a product feature update',
          type: 'Product Update',
          template: 'Problem → Solution → Benefits',
          purpose: 'Drive engagement',
          sample: 'We just shipped something big...',
          keywords: 'product, feature, update, launch'
        }
      ];

      const insertPost = db.prepare(`
        INSERT INTO posts (post_id, instruction, type, template, purpose, sample, keywords)
        VALUES (@post_id, @instruction, @type, @template, @purpose, @sample, @keywords)
      `);

      samplePosts.forEach(post => {
        insertPost.run(post);
      });

      console.log(`✓ Created ${samplePosts.length} sample posts`);
    } else {
      console.log(`• ${postCount.count} posts already exist`);
    }

    console.log('\nSeeding completed!');
    console.log('\n📋 Quick Start:');
    console.log('   1. Copy env.example.txt to .env');
    console.log('   2. Update .env with your API keys');
    console.log('   3. Run: npm start');
    console.log('   4. Open: http://localhost:3000');
    console.log('   5. Login with: admin / admin123');

  } catch (error) {
    console.error('Seeding failed:', error);
  }

  process.exit(0);
}

seed();
