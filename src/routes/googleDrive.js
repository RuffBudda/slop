/**
 * Google Drive Routes
 * Handles Google Drive OAuth and file operations
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const googleDriveService = require('../services/googleDriveService');
const db = require('../database/db');

const router = express.Router();

// OAuth callback doesn't require auth middleware (handled manually)
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code missing' });
    }

    // Check if user is in session
    const userId = req.session.userId;
    if (!userId) {
      // Redirect to login, then back to settings
      return res.redirect('/login?redirect=/settings&googleDrive=error');
    }

    // Exchange code for tokens (use userId if available)
    const userId = req.session.userId;
    const tokens = await googleDriveService.getTokensFromCode(code, userId);
    
    // Save tokens for current user
    googleDriveService.saveTokens(userId, tokens);
    
    // Redirect to settings page with success message
    res.redirect('/?tab=settings&googleDrive=connected');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/?tab=settings&googleDrive=error');
  }
});

// Apply authentication to all other routes
router.use(requireAuth);

/**
 * Get Google Drive authorization URL
 * GET /api/google-drive/auth-url
 */
router.get('/auth-url', (req, res) => {
  try {
    const authUrl = googleDriveService.getAuthUrl(req.user.id);
    res.json({ authUrl });
  } catch (error) {
    console.error('Get auth URL error:', error);
    res.status(500).json({ error: 'Failed to get authorization URL', details: error.message });
  }
});


/**
 * Check connection status
 * GET /api/google-drive/status
 */
router.get('/status', (req, res) => {
  try {
    const isConnected = googleDriveService.isConnected(req.user.id);
    const connectionType = googleDriveService.getConnectionType(req.user.id);
    res.json({ 
      connected: isConnected,
      connectionType: connectionType || null
    });
  } catch (error) {
    console.error('Check status error:', error);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

/**
 * Disconnect Google Drive
 * DELETE /api/google-drive/disconnect
 */
router.delete('/disconnect', (req, res) => {
  try {
    // Remove both OAuth tokens and service account key
    db.prepare(`
      DELETE FROM settings 
      WHERE user_id = ? AND key IN (
        'google_drive_access_token', 
        'google_drive_refresh_token',
        'google_drive_service_account'
      )
    `).run(req.user.id);
    
    res.json({ success: true, message: 'Google Drive disconnected' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

/**
 * List files in a folder
 * GET /api/google-drive/files?folderId=xxx&query=xxx
 */
router.get('/files', async (req, res) => {
  try {
    const { folderId, query } = req.query;
    const files = await googleDriveService.listFiles(req.user.id, folderId || null, query || '');
    res.json({ files });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files', details: error.message });
  }
});

/**
 * List folders
 * GET /api/google-drive/folders?parentId=xxx
 */
router.get('/folders', async (req, res) => {
  try {
    const { parentId } = req.query;
    const folders = await googleDriveService.listFolders(req.user.id, parentId || null);
    res.json({ folders });
  } catch (error) {
    console.error('List folders error:', error);
    res.status(500).json({ error: 'Failed to list folders', details: error.message });
  }
});

/**
 * Get file metadata
 * GET /api/google-drive/file/:fileId
 */
router.get('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = await googleDriveService.getFile(req.user.id, fileId);
    res.json({ file });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: 'Failed to get file', details: error.message });
  }
});

/**
 * Get folder metadata
 * GET /api/google-drive/folder/:folderId
 */
router.get('/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const folder = await googleDriveService.getFolder(req.user.id, folderId);
    res.json({ folder });
  } catch (error) {
    console.error('Get folder error:', error);
    res.status(500).json({ error: 'Failed to get folder', details: error.message });
  }
});

/**
 * Extract folder ID from link
 * POST /api/google-drive/extract-folder-id
 */
router.post('/extract-folder-id', (req, res) => {
  try {
    const { link } = req.body;
    if (!link) {
      return res.status(400).json({ error: 'Link is required' });
    }
    
    const folderId = googleDriveService.extractFolderIdFromLink(link);
    if (!folderId) {
      return res.status(400).json({ error: 'Invalid Google Drive link format' });
    }
    
    res.json({ folderId });
  } catch (error) {
    console.error('Extract folder ID error:', error);
    res.status(500).json({ error: 'Failed to extract folder ID', details: error.message });
  }
});

/**
 * Download file
 * GET /api/google-drive/download/:fileId
 */
router.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const fileBuffer = await googleDriveService.downloadFile(req.user.id, fileId);
    const file = await googleDriveService.getFile(req.user.id, fileId);
    
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.send(fileBuffer);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Failed to download file', details: error.message });
  }
});

/**
 * Upload file to Google Drive
 * POST /api/google-drive/upload
 */
router.post('/upload', express.raw({ type: 'image/*', limit: '50mb' }), async (req, res) => {
  try {
    const { fileName, folderId, mimeType } = req.query;
    
    if (!fileName) {
      return res.status(400).json({ error: 'File name is required' });
    }

    const fileBuffer = req.body;
    const uploadedFile = await googleDriveService.uploadFile(
      req.user.id,
      fileBuffer,
      fileName,
      folderId || null,
      mimeType || 'image/png'
    );
    
    res.json({ file: uploadedFile, success: true });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: 'Failed to upload file', details: error.message });
  }
});

module.exports = router;
