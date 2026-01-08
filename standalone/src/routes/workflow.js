/**
 * Workflow Routes
 * Handles content generation workflow operations
 */

const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const workflowService = require('../services/workflowService');
const storageService = require('../services/storageService');

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Start content generation workflow
 * POST /api/workflow/generate
 */
router.post('/generate', async (req, res) => {
  try {
    const { count = 10 } = req.body;
    
    // Check if already running
    const status = workflowService.isGenerationInProgress();
    if (status.running) {
      return res.status(400).json({ 
        error: 'Generation already in progress',
        ...status 
      });
    }

    const result = await workflowService.startWorkflow(req.user.id, count);
    
    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Start workflow error:', error);
    res.status(500).json({ error: 'Failed to start workflow' });
  }
});

/**
 * Queue posts for generation
 * POST /api/workflow/queue
 */
router.post('/queue', (req, res) => {
  try {
    const { count = 10 } = req.body;
    const result = workflowService.queuePosts(req.user.id, count);
    
    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Queue posts error:', error);
    res.status(500).json({ error: 'Failed to queue posts' });
  }
});

/**
 * Get generation status
 * GET /api/workflow/status
 */
router.get('/status', (req, res) => {
  try {
    const status = workflowService.isGenerationInProgress();
    res.json(status);

  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * Get workflow session status
 * GET /api/workflow/session/:sessionId
 */
router.get('/session/:sessionId', (req, res) => {
  try {
    const status = workflowService.getSessionStatus(req.params.sessionId);
    res.json(status);

  } catch (error) {
    console.error('Get session status error:', error);
    res.status(500).json({ error: 'Failed to get session status' });
  }
});

/**
 * Upload additional images for a post
 * POST /api/workflow/upload-images/:postId
 */
router.post('/upload-images/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { files } = req.body; // Array of { name, type, data (base64) }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const result = await storageService.saveAdditionalImages(req.user.id, postId, files);
    
    res.json(result);

  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

/**
 * Get workflow history
 * GET /api/workflow/history
 */
router.get('/history', (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT * FROM workflow_sessions 
      ORDER BY started_at DESC 
      LIMIT 50
    `).all();

    res.json({ sessions });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get workflow history' });
  }
});

/**
 * Cancel running workflow
 * POST /api/workflow/cancel/:sessionId
 */
router.post('/cancel/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    // Reset queued posts
    db.prepare(`
      UPDATE posts SET status = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE status = 'Queue'
    `).run();

    // Mark session as failed
    db.prepare(`
      UPDATE workflow_sessions SET 
        status = 'failed',
        error_message = 'Cancelled by user',
        completed_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(sessionId);

    res.json({ 
      success: true, 
      message: 'Workflow cancelled' 
    });

  } catch (error) {
    console.error('Cancel workflow error:', error);
    res.status(500).json({ error: 'Failed to cancel workflow' });
  }
});

/**
 * Get environmental impact stats
 * GET /api/workflow/stats
 */
router.get('/stats', (req, res) => {
  try {
    // Count total content generations (posts with any variant)
    const generationCount = db.prepare(`
      SELECT COUNT(*) as count FROM posts 
      WHERE variant_1 IS NOT NULL OR variant_2 IS NOT NULL OR variant_3 IS NOT NULL
    `).get();

    // Count total images generated (posts with image URLs)
    const imageCount = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM posts WHERE image_1 IS NOT NULL) +
        (SELECT COUNT(*) FROM posts WHERE image_2 IS NOT NULL) +
        (SELECT COUNT(*) FROM posts WHERE image_3 IS NOT NULL) as count
    `).get();

    // Get completed workflow sessions for historical tracking
    const sessionStats = db.prepare(`
      SELECT 
        SUM(posts_processed) as totalProcessed,
        COUNT(*) as totalSessions
      FROM workflow_sessions 
      WHERE status = 'completed'
    `).get();

    res.json({
      stats: {
        totalGenerations: generationCount?.count || 0,
        totalImages: imageCount?.count || 0,
        completedSessions: sessionStats?.totalSessions || 0,
        totalPostsProcessed: sessionStats?.totalProcessed || 0
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
