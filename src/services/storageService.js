/**
 * Storage Service
 * Handles file uploads to DigitalOcean Spaces
 * Replaces the n8n DigitalOcean Spaces node functionality
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { getSettingValue } = require('../routes/settings');

/**
 * Get configured S3 client for DigitalOcean Spaces
 * @param {number} userId - User ID for settings lookup
 * @returns {AWS.S3} Configured S3 client
 */
function getS3Client(userId) {
  const spacesName = getSettingValue(userId, 'spaces_name');
  const spacesRegion = getSettingValue(userId, 'spaces_region') || 'blr1';
  const spacesKey = getSettingValue(userId, 'spaces_key');
  const spacesSecret = getSettingValue(userId, 'spaces_secret');

  if (!spacesKey || !spacesSecret || !spacesName) {
    throw new Error('DigitalOcean Spaces credentials not configured');
  }

  const spacesEndpoint = new AWS.Endpoint(`${spacesRegion}.digitaloceanspaces.com`);
  
  return new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: spacesKey,
    secretAccessKey: spacesSecret
  });
}

/**
 * Upload a file to DigitalOcean Spaces
 * @param {number} userId - User ID for settings lookup
 * @param {Buffer} fileBuffer - File data as buffer
 * @param {string} fileName - File name
 * @param {Object} options - Upload options
 * @returns {string} Public URL of uploaded file
 */
async function uploadFile(userId, fileBuffer, fileName, options = {}) {
  const spacesName = getSettingValue(userId, 'spaces_name');
  const spacesRegion = getSettingValue(userId, 'spaces_region') || 'blr1';
  const s3 = getS3Client(userId);

  const {
    contentType = 'image/png',
    acl = 'public-read',
    folder = 'slop'
  } = options;

  // Generate unique file name
  const uniqueName = `${folder}/${Date.now()}-${uuidv4().substring(0, 8)}-${fileName}`;

  const params = {
    Bucket: spacesName,
    Key: uniqueName,
    Body: fileBuffer,
    ACL: acl,
    ContentType: contentType
  };

  try {
    await s3.upload(params).promise();
    
    // Return public URL
    const publicUrl = `https://${spacesName}.${spacesRegion}.cdn.digitaloceanspaces.com/${uniqueName}`;
    return publicUrl;

  } catch (error) {
    console.error('Upload error:', error);
    throw new Error(`File upload failed: ${error.message}`);
  }
}

/**
 * Upload multiple files
 * @param {number} userId - User ID for settings lookup
 * @param {Array} files - Array of {buffer, name, contentType}
 * @param {Object} options - Upload options
 * @returns {Array} Array of uploaded file URLs
 */
async function uploadMultiple(userId, files, options = {}) {
  const urls = [];

  for (const file of files) {
    try {
      const url = await uploadFile(
        userId,
        file.buffer,
        file.name,
        { ...options, contentType: file.contentType || 'image/png' }
      );
      urls.push(url);
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      urls.push(null);
    }
  }

  return urls;
}

/**
 * Delete a file from DigitalOcean Spaces
 * @param {number} userId - User ID for settings lookup
 * @param {string} fileUrl - URL of file to delete
 */
async function deleteFile(userId, fileUrl) {
  const spacesName = getSettingValue(userId, 'spaces_name');
  const s3 = getS3Client(userId);

  // Extract key from URL
  const url = new URL(fileUrl);
  const key = url.pathname.substring(1); // Remove leading slash

  const params = {
    Bucket: spacesName,
    Key: key
  };

  try {
    await s3.deleteObject(params).promise();
  } catch (error) {
    console.error('Delete error:', error);
    throw new Error(`File deletion failed: ${error.message}`);
  }
}

/**
 * Save additional images uploaded by user
 * @param {number} userId - User ID for settings lookup
 * @param {number} postId - Post ID
 * @param {Array} files - Array of base64 encoded files
 * @returns {Object} Result with uploaded URLs
 */
async function saveAdditionalImages(userId, postId, files) {
  const urls = [];

  for (const file of files) {
    try {
      // Convert base64 to buffer
      const buffer = Buffer.from(file.data, 'base64');
      
      // Determine content type
      let contentType = file.type || 'image/png';
      
      // Generate file name
      const ext = contentType.split('/')[1] || 'png';
      const fileName = `${file.name || 'image'}.${ext}`;

      const url = await uploadFile(userId, buffer, fileName, { contentType });
      urls.push(url);

    } catch (error) {
      console.error('Failed to upload additional image:', error);
    }
  }

  // Update post with additional images
  if (urls.length > 0) {
    db.prepare(`
      UPDATE posts SET 
        additional_img = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(urls.join(', '), postId);
  }

  return {
    ok: urls.length > 0,
    urls,
    message: `Uploaded ${urls.length} of ${files.length} images`
  };
}

/**
 * Create upload function bound to a user
 * @param {number} userId - User ID for settings lookup
 * @returns {Function} Upload function
 */
function createUploader(userId) {
  return async (buffer, fileName, options = {}) => {
    return uploadFile(userId, buffer, fileName, options);
  };
}

module.exports = {
  uploadFile,
  uploadMultiple,
  deleteFile,
  saveAdditionalImages,
  createUploader,
  getS3Client
};
