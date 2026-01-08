/**
 * Workflow Service
 * Orchestrates content generation workflow
 * Replaces n8n workflow functionality
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const contentService = require('./contentService');
const imageService = require('./imageService');
const storageService = require('./storageService');

/**
 * Queue posts for processing
 * @param {number} userId - User ID
 * @param {number} count - Number of posts to queue (default 10)
 * @returns {Object} Result with queued count
 */
function queuePosts(userId, count = 10) {
  // Find posts with null status (not yet processed)
  const posts = db.prepare(`
    SELECT id FROM posts 
    WHERE status IS NULL 
    ORDER BY created_at ASC 
    LIMIT ?
  `).all(count);

  if (posts.length === 0) {
    return { queued: 0, message: 'No posts available to queue' };
  }

  // Update status to Queue
  const updateStmt = db.prepare(`
    UPDATE posts SET status = 'Queue', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);

  const queueMany = db.transaction((postsToQueue) => {
    for (const post of postsToQueue) {
      updateStmt.run(post.id);
    }
  });

  queueMany(posts);

  return { 
    queued: posts.length, 
    message: `Queued ${posts.length} posts for processing` 
  };
}

/**
 * Process queued posts (full workflow)
 * @param {number} userId - User ID for API keys
 * @param {string} sessionId - Workflow session ID
 * @returns {Object} Processing results
 */
async function processQueue(userId, sessionId) {
  // Get all queued posts
  const queuedPosts = db.prepare(`
    SELECT * FROM posts WHERE status = 'Queue' ORDER BY created_at ASC
  `).all();

  if (queuedPosts.length === 0) {
    return { processed: 0, message: 'No posts in queue' };
  }

  // Update session
  db.prepare(`
    UPDATE workflow_sessions SET 
      status = 'processing',
      total_posts = ?
    WHERE session_id = ?
  `).run(queuedPosts.length, sessionId);

  const results = {
    total: queuedPosts.length,
    contentGenerated: 0,
    imagesGenerated: 0,
    failed: 0,
    errors: []
  };

  // Create uploader function for this user
  const uploadFn = storageService.createUploader(userId);

  for (let i = 0; i < queuedPosts.length; i++) {
    const post = queuedPosts[i];

    try {
      // Step 1: Generate content
      console.log(`[Workflow] Processing post ${i + 1}/${queuedPosts.length}: ${post.post_id}`);
      
      const content = await contentService.generateContent(userId, post);

      // Update post with content
      db.prepare(`
        UPDATE posts SET
          variant_1 = ?,
          variant_2 = ?,
          variant_3 = ?,
          image_prompt_1 = ?,
          image_prompt_2 = ?,
          image_prompt_3 = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        content.variant_1,
        content.variant_2,
        content.variant_3,
        content.image_prompt_1,
        content.image_prompt_2,
        content.image_prompt_3,
        post.id
      );

      results.contentGenerated++;

      // Step 2: Generate images
      console.log(`[Workflow] Generating images for: ${post.post_id}`);
      
      const imagePrompts = [
        content.image_prompt_1,
        content.image_prompt_2,
        content.image_prompt_3
      ].filter(Boolean);

      const imageUrls = [];
      for (let j = 0; j < imagePrompts.length; j++) {
        try {
          const imageBuffer = await imageService.generateImage(userId, imagePrompts[j]);
          const url = await uploadFn(imageBuffer, `${post.post_id}-${j + 1}.png`);
          imageUrls.push(url);
          
          // Delay between image generations
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (imgError) {
          console.error(`Image generation failed for prompt ${j + 1}:`, imgError);
          imageUrls.push(null);
        }
      }

      // Update post with image URLs
      db.prepare(`
        UPDATE posts SET
          image_url_1 = ?,
          image_url_2 = ?,
          image_url_3 = ?,
          status = 'generated',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        imageUrls[0] || null,
        imageUrls[1] || null,
        imageUrls[2] || null,
        post.id
      );

      if (imageUrls.some(Boolean)) {
        results.imagesGenerated++;
      }

      // Update session progress
      db.prepare(`
        UPDATE workflow_sessions SET processed_posts = ? WHERE session_id = ?
      `).run(i + 1, sessionId);

    } catch (error) {
      console.error(`[Workflow] Failed to process post ${post.post_id}:`, error);
      results.failed++;
      results.errors.push({ postId: post.post_id, error: error.message });

      // Reset post status on failure
      db.prepare(`
        UPDATE posts SET status = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(post.id);
    }
  }

  // Update session as completed
  db.prepare(`
    UPDATE workflow_sessions SET 
      status = 'completed',
      completed_at = CURRENT_TIMESTAMP
    WHERE session_id = ?
  `).run(sessionId);

  return results;
}

/**
 * Start a new workflow session
 * @param {number} userId - User ID
 * @param {number} postCount - Number of posts to process
 * @returns {Object} Session info
 */
async function startWorkflow(userId, postCount = 10) {
  const sessionId = uuidv4();

  // Create session record
  db.prepare(`
    INSERT INTO workflow_sessions (session_id, status, total_posts)
    VALUES (?, 'pending', 0)
  `).run(sessionId);

  // Queue posts
  const queueResult = queuePosts(userId, postCount);

  if (queueResult.queued === 0) {
    db.prepare(`
      UPDATE workflow_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(sessionId);

    return {
      sessionId,
      queued: 0,
      message: 'No posts available to process'
    };
  }

  // Process asynchronously
  setImmediate(async () => {
    try {
      await processQueue(userId, sessionId);
    } catch (error) {
      console.error('[Workflow] Processing error:', error);
      db.prepare(`
        UPDATE workflow_sessions SET 
          status = 'failed',
          error_message = ?,
          completed_at = CURRENT_TIMESTAMP
        WHERE session_id = ?
      `).run(error.message, sessionId);
    }
  });

  return {
    sessionId,
    queued: queueResult.queued,
    message: `Started processing ${queueResult.queued} posts`
  };
}

/**
 * Get workflow session status
 * @param {string} sessionId - Session ID
 * @returns {Object} Session status
 */
function getSessionStatus(sessionId) {
  const session = db.prepare(`
    SELECT * FROM workflow_sessions WHERE session_id = ?
  `).get(sessionId);

  if (!session) {
    return { error: 'Session not found' };
  }

  // Count remaining queue items
  const queueCount = db.prepare(`
    SELECT COUNT(*) as count FROM posts WHERE status = 'Queue'
  `).get();

  return {
    ...session,
    queueRemaining: queueCount.count,
    progress: session.total_posts > 0 
      ? Math.round((session.processed_posts / session.total_posts) * 100)
      : 0
  };
}

/**
 * Check if generation is in progress
 * @returns {Object} Generation status
 */
function isGenerationInProgress() {
  const queueCount = db.prepare(`
    SELECT COUNT(*) as count FROM posts WHERE status = 'Queue'
  `).get();

  const processingSession = db.prepare(`
    SELECT * FROM workflow_sessions WHERE status = 'processing' ORDER BY started_at DESC LIMIT 1
  `).get();

  return {
    running: queueCount.count > 0 || !!processingSession,
    queueCount: queueCount.count,
    session: processingSession || null
  };
}

module.exports = {
  queuePosts,
  processQueue,
  startWorkflow,
  getSessionStatus,
  isGenerationInProgress
};
