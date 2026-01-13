/**
 * Posts Routes
 * CRUD operations for LinkedIn posts (replaces Google Sheets)
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const googleDriveService = require('../services/googleDriveService');

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Get posts by status
 * GET /api/posts?status=generated&page=1&limit=20
 */
router.get('/', (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = 'SELECT * FROM posts';
    let countQuery = 'SELECT COUNT(*) as total FROM posts';
    const params = [];

    if (status) {
      if (status === 'null') {
        query += ' WHERE status IS NULL';
        countQuery += ' WHERE status IS NULL';
      } else {
        query += ' WHERE status = ?';
        countQuery += ' WHERE status = ?';
        params.push(status);
      }
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const total = db.prepare(countQuery).get(...params)?.total || 0;
    const posts = db.prepare(query).all(...params, parseInt(limit), offset);

    res.json({
      posts: posts.map(p => ({
        ...p,
        id: p.post_id,
        rowIndex: p.id,
        // Map image_url_* to image_* for frontend compatibility
        image_1: p.image_url_1,
        image_2: p.image_url_2,
        image_3: p.image_url_3
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

/**
 * Get content for review (status = 'generated')
 * GET /api/posts/content
 */
router.get('/content', async (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT * FROM posts 
      WHERE status = 'generated'
      ORDER BY created_at DESC
    `).all();

    // Check if Google Drive is connected
    const isDriveConnected = googleDriveService.isConnected(req.user.id);
    
    // Fetch Google Drive images if connected
    let driveImages = [];
    if (isDriveConnected) {
      try {
        // Get saved folder ID from settings
        const { getSettingValue } = require('./settings');
        const savedFolderId = getSettingValue(req.user.id, 'google_drive_folder_id');
        
        // Use saved folder ID if available, otherwise use root (null)
        const folderId = savedFolderId || null;
        const driveFiles = await googleDriveService.listFiles(req.user.id, folderId, '');
        // Get 3 random images from Drive
        const imageFiles = driveFiles.filter(f => f.mimeType && f.mimeType.startsWith('image/'));
        const shuffled = imageFiles.sort(() => 0.5 - Math.random());
        driveImages = shuffled.slice(0, 3).map(f => {
          // Prefer webContentLink (direct download), fallback to webViewLink, then thumbnailLink
          return f.webContentLink || f.webViewLink || f.thumbnailLink || '';
        }).filter(Boolean);
      } catch (driveError) {
        console.error('Failed to fetch Google Drive images:', driveError);
        // Continue without Drive images
      }
    }

    res.json({
      posts: posts.map(p => {
        const mapped = {
          ...p,
          id: p.post_id,
          rowIndex: p.id,
          // Map image_url_* to image_* for frontend compatibility
          image_1: p.image_url_1,
          image_2: p.image_url_2,
          image_3: p.image_url_3,
          // Add Google Drive images if available
          drive_image_1: driveImages[0] || null,
          drive_image_2: driveImages[1] || null,
          drive_image_3: driveImages[2] || null
        };
        return mapped;
      })
    });

  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({ error: 'Failed to get content' });
  }
});

/**
 * Get approved posts for calendar
 * GET /api/posts/calendar?start=ISO&end=ISO
 */
router.get('/calendar', (req, res) => {
  try {
    const { start, end } = req.query;

    let query = `
      SELECT * FROM posts 
      WHERE status = 'Approved'
    `;
    const params = [];

    if (start && end) {
      query += ' AND post_schedule BETWEEN ? AND ?';
      params.push(start, end);
    }

    query += ' ORDER BY post_schedule ASC';

    const posts = db.prepare(query).all(...params);

    res.json({
      rows: posts.map(p => ({
        ...p,
        id: p.post_id,
        row_index: p.id
      }))
    });

  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({ error: 'Failed to get calendar data' });
  }
});

/**
 * Get posts by status
 * GET /api/posts/by-status/:status
 */
router.get('/by-status/:status', (req, res) => {
  try {
    const { status } = req.params;

    const posts = db.prepare(`
      SELECT * FROM posts 
      WHERE status = ?
      ORDER BY created_at DESC
    `).all(status);

    res.json({
      rows: posts.map(p => ({
        ...p,
        id: p.post_id,
        rowIndex: p.id
      }))
    });

  } catch (error) {
    console.error('Get posts by status error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

/**
 * Get single post
 * GET /api/posts/:id
 */
router.get('/:id', (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ? OR post_id = ?')
      .get(req.params.id, req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({
      ...post,
      id: post.post_id,
      rowIndex: post.id
    });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to get post' });
  }
});

/**
 * Create new post
 * POST /api/posts
 */
router.post('/', (req, res) => {
  try {
    const { instruction, type, template, purpose, sample, keywords } = req.body;

    const postId = `POST-${uuidv4().substring(0, 8).toUpperCase()}`;

    const result = db.prepare(`
      INSERT INTO posts (post_id, instruction, type, template, purpose, sample, keywords)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(postId, instruction, type, template, purpose, sample, keywords);

    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);

    res.json({
      success: true,
      post: {
        ...post,
        id: post.post_id,
        rowIndex: post.id
      }
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

/**
 * Bulk create posts
 * POST /api/posts/bulk
 */
router.post('/bulk', (req, res) => {
  try {
    const { posts } = req.body;

    if (!Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({ error: 'Posts array is required' });
    }

    const insertPost = db.prepare(`
      INSERT INTO posts (post_id, instruction, type, template, purpose, sample, keywords)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((postsToInsert) => {
      const results = [];
      for (const post of postsToInsert) {
        const postId = `POST-${uuidv4().substring(0, 8).toUpperCase()}`;
        const result = insertPost.run(
          postId,
          post.instruction,
          post.type,
          post.template,
          post.purpose,
          post.sample,
          post.keywords
        );
        results.push({ id: result.lastInsertRowid, post_id: postId });
      }
      return results;
    });

    const results = insertMany(posts);

    res.json({
      success: true,
      message: `Created ${results.length} posts`,
      posts: results
    });

  } catch (error) {
    console.error('Bulk create error:', error);
    res.status(500).json({ error: 'Failed to create posts' });
  }
});

/**
 * Update post
 * PUT /api/posts/:id
 */
router.put('/:id', (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const allowedFields = [
      'instruction', 'type', 'template', 'purpose', 'sample', 'keywords',
      'status', 'variant_1', 'variant_2', 'variant_3', 'choice',
      'image_prompt_1', 'image_prompt_2', 'image_prompt_3',
      'image_url_1', 'image_url_2', 'image_url_3',
      'img_choice', 'additional_img', 'final_content', 'final_img',
      'post_schedule'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedPost = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);

    res.json({
      success: true,
      post: {
        ...updatedPost,
        id: updatedPost.post_id,
        rowIndex: updatedPost.id
      }
    });

  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

/**
 * Update variant text
 * PUT /api/posts/:id/variant/:variantNum
 */
router.put('/:id/variant/:variantNum', (req, res) => {
  try {
    const { id, variantNum } = req.params;
    const { text } = req.body;

    if (!['1', '2', '3'].includes(variantNum)) {
      return res.status(400).json({ error: 'Invalid variant number' });
    }

    const field = `variant_${variantNum}`;
    
    db.prepare(`UPDATE posts SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(text, id);

    res.json({ success: true });

  } catch (error) {
    console.error('Update variant error:', error);
    res.status(500).json({ error: 'Failed to update variant' });
  }
});

/**
 * Approve post (update choices and status)
 * POST /api/posts/:id/approve
 */
router.post('/:id/approve', (req, res) => {
  try {
    // Validate ID is an integer
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const { choice, imgChoice, schedule } = req.body;

    // Validate choice is required and must be 1, 2, or 3
    if (![1, 2, 3].includes(choice)) {
      return res.status(400).json({ error: 'Variant choice is required and must be 1, 2, or 3' });
    }

    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get final content based on choice
    const variantField = `variant_${choice}`;
    const finalContent = post[variantField];

    // Get final images based on img_choice
    let finalImg = '';
    if (imgChoice) {
      const imgIndices = imgChoice.split(',').map(s => s.trim());
      const imgs = [];
      
      for (const idx of imgIndices) {
        const imgNum = parseInt(idx);
        if (imgNum >= 1 && imgNum <= 3) {
          // Stability AI images (1-3)
          const url = post[`image_url_${imgNum}`];
          if (url) imgs.push(url);
        } else if (imgNum >= 4 && imgNum <= 6) {
          // Google Drive images (4-6) - stored in additional_img
          if (post.additional_img) {
            const driveUrls = post.additional_img.split(',').map(s => s.trim());
            const driveIdx = imgNum - 4;
            if (driveUrls[driveIdx]) {
              imgs.push(driveUrls[driveIdx]);
            }
          }
        }
      }
      
      finalImg = imgs.join(', ');
    }

    // If additional images exist and no specific choice, use those
    if (!finalImg && post.additional_img) {
      finalImg = post.additional_img;
    }

    db.prepare(`
      UPDATE posts SET 
        choice = ?,
        img_choice = ?,
        post_schedule = ?,
        status = 'Approved',
        final_content = ?,
        final_img = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(choice, imgChoice, schedule, finalContent, finalImg, id);

    res.json({ success: true, message: 'Post approved' });

  } catch (error) {
    console.error('Approve post error:', error);
    res.status(500).json({ error: 'Failed to approve post' });
  }
});

/**
 * Reject post
 * POST /api/posts/:id/reject
 */
router.post('/:id/reject', (req, res) => {
  try {
    const { id } = req.params;

    db.prepare(`
      UPDATE posts SET 
        status = 'Rejected',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    res.json({ success: true, message: 'Post rejected' });

  } catch (error) {
    console.error('Reject post error:', error);
    res.status(500).json({ error: 'Failed to reject post' });
  }
});

/**
 * Restore post (from rejected to generated)
 * POST /api/posts/:id/restore
 */
router.post('/:id/restore', (req, res) => {
  try {
    const { id } = req.params;

    db.prepare(`
      UPDATE posts SET 
        status = 'generated',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    res.json({ success: true, message: 'Post restored' });

  } catch (error) {
    console.error('Restore post error:', error);
    res.status(500).json({ error: 'Failed to restore post' });
  }
});

/**
 * Update post choices (variant and image selection)
 * PUT /api/posts/:id/choices
 */
router.put('/:id/choices', (req, res) => {
  try {
    const { id } = req.params;
    const { selected_variant, selected_image, drive_image_url } = req.body;

    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const updates = [];
    const values = [];

    if (selected_variant !== undefined) {
      updates.push('choice = ?');
      values.push(selected_variant);
    }

    if (selected_image !== undefined) {
      updates.push('img_choice = ?');
      values.push(String(selected_image));
      
      // If Drive image is selected (4-6), store the URL in additional_img
      if (selected_image >= 4 && selected_image <= 6 && drive_image_url) {
        // Store Drive image URL - append to additional_img or replace if empty
        const currentAdditional = post.additional_img || '';
        const driveUrls = currentAdditional ? currentAdditional.split(',').map(s => s.trim()) : [];
        const driveIdx = selected_image - 4;
        driveUrls[driveIdx] = drive_image_url;
        updates.push('additional_img = ?');
        values.push(driveUrls.filter(Boolean).join(', '));
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No choices to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ success: true, message: 'Choices updated' });

  } catch (error) {
    console.error('Update choices error:', error);
    res.status(500).json({ error: 'Failed to update choices' });
  }
});

/**
 * Update post schedule
 * PUT /api/posts/:id/schedule
 */
router.put('/:id/schedule', (req, res) => {
  try {
    const { id } = req.params;
    const { schedule } = req.body;

    db.prepare(`
      UPDATE posts SET 
        post_schedule = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(schedule, id);

    res.json({ success: true, message: 'Schedule updated' });

  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

/**
 * Delete post
 * DELETE /api/posts/:id
 */
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ success: true, message: 'Post deleted' });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

/**
 * Bulk delete posts
 * POST /api/posts/bulk-delete
 */
router.post('/bulk-delete', (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array is required' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM posts WHERE id IN (${placeholders})`).run(...ids);

    res.json({
      success: true,
      message: `Deleted ${result.changes} posts`
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to delete posts' });
  }
});

/**
 * Bulk update posts
 * POST /api/posts/bulk-update
 */
router.post('/bulk-update', (req, res) => {
  try {
    const { posts } = req.body;

    if (!Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({ error: 'Posts array is required' });
    }

    const allowedFields = ['instruction', 'type', 'template', 'purpose', 'sample', 'keywords'];

    const updatePost = db.transaction((postsToUpdate) => {
      let updated = 0;
      for (const post of postsToUpdate) {
        if (!post.id) continue;

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
          if (post[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(post[field]);
          }
        }

        if (updates.length > 0) {
          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(post.id);
          db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
          updated++;
        }
      }
      return updated;
    });

    const updatedCount = updatePost(posts);

    res.json({
      success: true,
      message: `Updated ${updatedCount} posts`
    });

  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to update posts' });
  }
});

/**
 * Get posts for sheet interface (manual input columns only)
 * GET /api/posts/sheet
 */
router.get('/sheet/data', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT id, post_id, instruction, type, template, purpose, sample, keywords, status, created_at
      FROM posts
      ORDER BY created_at DESC
    `).all();

    res.json({
      rows: posts.map(p => ({
        id: p.id,
        post_id: p.post_id,
        instruction: p.instruction || '',
        type: p.type || '',
        template: p.template || '',
        purpose: p.purpose || '',
        sample: p.sample || '',
        keywords: p.keywords || '',
        status: p.status || '',
        created_at: p.created_at
      }))
    });

  } catch (error) {
    console.error('Get sheet data error:', error);
    res.status(500).json({ error: 'Failed to get sheet data' });
  }
});

/**
 * Check if generation is in progress
 * GET /api/posts/generation-status
 */
router.get('/generation-status', (req, res) => {
  try {
    const queueCount = db.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'Queue'").get();
    
    res.json({
      running: queueCount.count > 0,
      queueCount: queueCount.count
    });

  } catch (error) {
    console.error('Get generation status error:', error);
    res.status(500).json({ error: 'Failed to get generation status' });
  }
});

/**
 * Check if has generated content
 * GET /api/posts/has-generated
 */
router.get('/has-generated', (req, res) => {
  try {
    const generatedCount = db.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'generated'").get();
    
    res.json({
      hasGenerated: generatedCount.count > 0,
      count: generatedCount.count
    });

  } catch (error) {
    console.error('Check generated error:', error);
    res.status(500).json({ error: 'Failed to check generated content' });
  }
});

module.exports = router;