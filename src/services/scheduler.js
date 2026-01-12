/**
 * Scheduler Service
 * Handles background job scheduling using node-cron
 */

const cron = require('node-cron');
const db = require('../database/db');

/**
 * Active cron jobs
 */
const jobs = {};

/**
 * Initialize scheduler
 */
function initScheduler() {
  // Clean up old workflow sessions (daily at midnight)
  jobs.cleanupSessions = cron.schedule('0 0 * * *', () => {
    console.log('[Scheduler] Cleaning up old workflow sessions...');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      db.prepare(`
        DELETE FROM workflow_sessions 
        WHERE completed_at < ? AND status IN ('completed', 'failed')
      `).run(thirtyDaysAgo.toISOString());
      
      console.log('[Scheduler] Session cleanup completed');
    } catch (error) {
      console.error('[Scheduler] Cleanup error:', error);
    }
  });

  // Check for stuck "Queue" posts (every 30 minutes)
  jobs.checkStuckPosts = cron.schedule('*/30 * * * *', () => {
    console.log('[Scheduler] Checking for stuck posts...');
    try {
      // Find posts that have been in Queue status for more than 2 hours
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      
      const stuckPosts = db.prepare(`
        SELECT id, post_id FROM posts 
        WHERE status = 'Queue' AND updated_at < ?
      `).all(twoHoursAgo.toISOString());
      
      if (stuckPosts.length > 0) {
        console.log(`[Scheduler] Found ${stuckPosts.length} stuck posts, resetting status`);
        
        db.prepare(`
          UPDATE posts SET status = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE status = 'Queue' AND updated_at < ?
        `).run(twoHoursAgo.toISOString());
      }
    } catch (error) {
      console.error('[Scheduler] Stuck posts check error:', error);
    }
  });

  // Check for scheduled posts to publish (every 5 minutes)
  jobs.checkScheduledPosts = cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduler] Checking for scheduled posts to publish...');
    try {
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      
      // Find posts scheduled for now or in the past (within next 5 minutes)
      const scheduledPosts = db.prepare(`
        SELECT id, post_id, final_content
        FROM posts 
        WHERE status IN ('Approved', 'Scheduled')
          AND post_schedule IS NOT NULL
          AND post_schedule <= ?
          AND (linkedin_post_url IS NULL OR linkedin_post_url = '')
        ORDER BY post_schedule ASC
        LIMIT 10
      `).all(fiveMinutesFromNow.toISOString());
      
      if (scheduledPosts.length > 0) {
        console.log(`[Scheduler] Found ${scheduledPosts.length} scheduled posts to publish`);
        
        const linkedInService = require('./linkedInService');
        
        for (const post of scheduledPosts) {
          try {
            console.log(`[Scheduler] Publishing post ${post.post_id} (ID: ${post.id})`);
            await linkedInService.postScheduledPost(post.id);
            console.log(`[Scheduler] Successfully published post ${post.post_id}`);
          } catch (error) {
            console.error(`[Scheduler] Failed to publish post ${post.post_id}:`, error.message);
            // Post remains in Scheduled/Approved status for manual retry
          }
        }
      }
    } catch (error) {
      console.error('[Scheduler] Scheduled posts check error:', error);
    }
  });

  // Log scheduler status
  console.log('[Scheduler] Background jobs initialized');
  console.log('  - Session cleanup: daily at midnight');
  console.log('  - Stuck posts check: every 30 minutes');
  console.log('  - Scheduled posts check: every 5 minutes');
}

/**
 * Stop all scheduled jobs
 */
function stopScheduler() {
  Object.values(jobs).forEach(job => {
    if (job && typeof job.stop === 'function') {
      job.stop();
    }
  });
  console.log('[Scheduler] All jobs stopped');
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  return {
    running: Object.keys(jobs).length > 0,
    jobs: Object.keys(jobs).map(key => ({
      name: key,
      running: jobs[key]?.running || false
    }))
  };
}

module.exports = {
  initScheduler,
  stopScheduler,
  getSchedulerStatus
};
