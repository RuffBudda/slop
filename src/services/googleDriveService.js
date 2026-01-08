/**
 * Google Drive Service
 * Handles Google Drive OAuth and file operations
 */

const { google } = require('googleapis');
const db = require('../database/db');
const { getSettingValue, encrypt, decrypt } = require('../routes/settings');

// Google OAuth2 configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google-drive/callback';

/**
 * Get OAuth2 client for a user
 * @param {number} userId - User ID
 * @returns {google.auth.OAuth2Client} OAuth2 client
 */
function getOAuth2Client(userId = null) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  if (userId) {
    const accessToken = getSettingValue(userId, 'google_drive_access_token');
    const refreshToken = getSettingValue(userId, 'google_drive_refresh_token');
    
    if (accessToken && refreshToken) {
      oauth2Client.setCredentials({
        access_token: decrypt(accessToken),
        refresh_token: decrypt(refreshToken)
      });
    }
  }

  return oauth2Client;
}

/**
 * Get authorization URL for OAuth flow
 * @returns {string} Authorization URL
 */
function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  
  const scopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code
 * @returns {Object} Tokens
 */
async function getTokensFromCode(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Save tokens for a user
 * @param {number} userId - User ID
 * @param {Object} tokens - OAuth tokens
 */
function saveTokens(userId, tokens) {
  if (tokens.access_token) {
    db.prepare(`
      INSERT INTO settings (user_id, key, value, encrypted, updated_at)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, 'google_drive_access_token', encrypt(tokens.access_token));
  }

  if (tokens.refresh_token) {
    db.prepare(`
      INSERT INTO settings (user_id, key, value, encrypted, updated_at)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, 'google_drive_refresh_token', encrypt(tokens.refresh_token));
  }
}

/**
 * Refresh access token if needed
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Updated tokens
 */
async function refreshAccessToken(userId) {
  const oauth2Client = getOAuth2Client(userId);
  const refreshToken = getSettingValue(userId, 'google_drive_refresh_token');
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  oauth2Client.setCredentials({
    refresh_token: decrypt(refreshToken)
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  
  if (credentials.access_token) {
    saveTokens(userId, credentials);
  }

  return credentials;
}

/**
 * Get authenticated Drive client
 * @param {number} userId - User ID
 * @returns {Promise<google.drive.Drive>} Drive client
 */
async function getDriveClient(userId) {
  // Check if service account key is configured (preferred method)
  const serviceAccountKey = getSettingValue(userId, 'google_drive_service_account');
  
  if (serviceAccountKey) {
    try {
      // Parse service account JSON (it's stored as encrypted string)
      let serviceAccount;
      try {
        const decrypted = decrypt(serviceAccountKey);
        serviceAccount = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
      } catch (parseError) {
        // If decryption fails, try parsing directly (might be unencrypted in dev)
        serviceAccount = typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey;
      }
      
      // Validate service account structure
      if (!serviceAccount.client_email || !serviceAccount.private_key) {
        throw new Error('Service account key missing required fields');
      }
      
      // Create JWT client from service account
      const auth = new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.file'
        ]
      });
      
      return google.drive({ version: 'v3', auth });
    } catch (error) {
      console.error('Service account authentication error:', error);
      throw new Error(`Invalid service account key: ${error.message}`);
    }
  }
  
  // Fallback to OAuth2
  const oauth2Client = getOAuth2Client(userId);
  
  // Try to refresh token if needed
  try {
    await refreshAccessToken(userId);
    // Recreate client with new tokens
    const updatedClient = getOAuth2Client(userId);
    return google.drive({ version: 'v3', auth: updatedClient });
  } catch (error) {
    // If refresh fails, try with existing tokens
    return google.drive({ version: 'v3', auth: oauth2Client });
  }
}

/**
 * Extract folder ID from Google Drive link
 * Supports various Google Drive link formats:
 * - https://drive.google.com/drive/folders/FOLDER_ID
 * - https://drive.google.com/open?id=FOLDER_ID
 * - FOLDER_ID (direct ID)
 * @param {string} link - Google Drive link or folder ID
 * @returns {string|null} Folder ID or null if invalid
 */
function extractFolderIdFromLink(link) {
  if (!link || typeof link !== 'string') return null;
  
  const trimmed = link.trim();
  
  // If it's already just an ID (no special characters that would be in a URL)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }
  
  // Try to extract from various Google Drive URL formats
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,  // /folders/FOLDER_ID
    /[?&]id=([a-zA-Z0-9_-]+)/,       // ?id=FOLDER_ID or &id=FOLDER_ID
    /\/d\/([a-zA-Z0-9_-]+)/,         // /d/FOLDER_ID
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Get folder metadata by ID
 * @param {number} userId - User ID
 * @param {string} folderId - Folder ID
 * @returns {Promise<Object>} Folder metadata
 */
async function getFolder(userId, folderId) {
  const drive = await getDriveClient(userId);
  
  const response = await drive.files.get({
    fileId: folderId,
    fields: 'id, name, mimeType, webViewLink'
  });

  return response.data;
}

/**
 * List files in a folder
 * @param {number} userId - User ID
 * @param {string} folderId - Folder ID (optional, defaults to root)
 * @param {string} query - Search query (optional)
 * @returns {Promise<Array>} List of files
 */
async function listFiles(userId, folderId = null, query = '') {
  const drive = await getDriveClient(userId);
  
  let q = "trashed = false and mimeType contains 'image/'";
  
  if (folderId) {
    q += ` and '${folderId}' in parents`;
  }
  
  if (query) {
    q += ` and name contains '${query}'`;
  }

  const response = await drive.files.list({
    q: q,
    fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, size, modifiedTime)',
    pageSize: 100,
    orderBy: 'modifiedTime desc'
  });

  return response.data.files || [];
}

/**
 * Get file by ID
 * @param {number} userId - User ID
 * @param {string} fileId - File ID
 * @returns {Promise<Object>} File metadata
 */
async function getFile(userId, fileId) {
  const drive = await getDriveClient(userId);
  
  const response = await drive.files.get({
    fileId: fileId,
    fields: 'id, name, mimeType, thumbnailLink, webViewLink, webContentLink, size, modifiedTime'
  });

  return response.data;
}

/**
 * Download file content
 * @param {number} userId - User ID
 * @param {string} fileId - File ID
 * @returns {Promise<Buffer>} File content
 */
async function downloadFile(userId, fileId) {
  const drive = await getDriveClient(userId);
  
  const response = await drive.files.get(
    { fileId: fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data);
}

/**
 * Upload file to Google Drive
 * @param {number} userId - User ID
 * @param {Buffer} fileBuffer - File content
 * @param {string} fileName - File name
 * @param {string} folderId - Parent folder ID (optional)
 * @param {string} mimeType - MIME type
 * @returns {Promise<Object>} Uploaded file metadata
 */
async function uploadFile(userId, fileBuffer, fileName, folderId = null, mimeType = 'image/png') {
  const drive = await getDriveClient(userId);
  
  const fileMetadata = {
    name: fileName
  };
  
  if (folderId) {
    fileMetadata.parents = [folderId];
  }

  const media = {
    mimeType: mimeType,
    body: fileBuffer
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, mimeType, thumbnailLink, webViewLink, webContentLink'
  });

  return response.data;
}

/**
 * List folders
 * @param {number} userId - User ID
 * @param {string} parentFolderId - Parent folder ID (optional)
 * @returns {Promise<Array>} List of folders
 */
async function listFolders(userId, parentFolderId = null) {
  const drive = await getDriveClient(userId);
  
  let q = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  
  if (parentFolderId) {
    q += ` and '${parentFolderId}' in parents`;
  } else {
    q += " and 'root' in parents";
  }

  const response = await drive.files.list({
    q: q,
    fields: 'files(id, name, mimeType)',
    pageSize: 100,
    orderBy: 'name'
  });

  return response.data.files || [];
}

/**
 * Check if user has Google Drive connected
 * @param {number} userId - User ID
 * @returns {boolean} True if connected
 */
function isConnected(userId) {
  const serviceAccount = getSettingValue(userId, 'google_drive_service_account');
  const refreshToken = getSettingValue(userId, 'google_drive_refresh_token');
  return !!(serviceAccount || refreshToken);
}

/**
 * Get connection type
 * @param {number} userId - User ID
 * @returns {string} 'service_account' or 'oauth' or null
 */
function getConnectionType(userId) {
  const serviceAccount = getSettingValue(userId, 'google_drive_service_account');
  if (serviceAccount) return 'service_account';
  
  const refreshToken = getSettingValue(userId, 'google_drive_refresh_token');
  if (refreshToken) return 'oauth';
  
  return null;
}

module.exports = {
  getAuthUrl,
  getTokensFromCode,
  saveTokens,
  refreshAccessToken,
  getDriveClient,
  listFiles,
  getFile,
  getFolder,
  downloadFile,
  uploadFile,
  listFolders,
  isConnected,
  getConnectionType,
  extractFolderIdFromLink,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
};
