/**
 * LinkedIn Service
 * Handles LinkedIn API integration for posting content
 */

const { getSettingValue } = require('../routes/settings');
const db = require('../database/db');

/**
 * Get LinkedIn access token (with automatic refresh if needed)
 * @param {number} userId - User ID
 * @returns {Promise<string>} Access token
 */
async function getAccessToken(userId) {
  let accessToken = getSettingValue(userId, 'linkedin_access_token');
  const refreshToken = getSettingValue(userId, 'linkedin_refresh_token');
  const clientId = getSettingValue(userId, 'linkedin_client_id');
  const clientSecret = getSettingValue(userId, 'linkedin_client_secret');

  if (!accessToken) {
    throw new Error('LinkedIn access token not configured. Please authenticate in Settings.');
  }

  if (!clientId || !clientSecret) {
    throw new Error('LinkedIn API credentials not configured. Please add Client ID and Client Secret in Settings.');
  }

  // Try to use the access token first
  // If it fails, we'll refresh it
  return accessToken;
}

/**
 * Refresh LinkedIn access token
 * @param {number} userId - User ID
 * @returns {Promise<string>} New access token
 */
async function refreshAccessToken(userId) {
  const refreshToken = getSettingValue(userId, 'linkedin_refresh_token');
  const clientId = getSettingValue(userId, 'linkedin_client_id');
  const clientSecret = getSettingValue(userId, 'linkedin_client_secret');

  if (!refreshToken) {
    throw new Error('LinkedIn refresh token not available. Please re-authenticate.');
  }

  if (!clientId || !clientSecret) {
    throw new Error('LinkedIn API credentials not configured.');
  }

  try {
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token || refreshToken; // LinkedIn may not always return a new refresh token

    // Save new tokens
    const { encrypt } = require('../routes/settings');
    const upsertSetting = db.prepare(`
      INSERT INTO settings (user_id, key, value, encrypted, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);

    upsertSetting.run(userId, 'linkedin_access_token', encrypt(newAccessToken), 1);
    if (newRefreshToken !== refreshToken) {
      upsertSetting.run(userId, 'linkedin_refresh_token', encrypt(newRefreshToken), 1);
    }

    return newAccessToken;
  } catch (error) {
    console.error('[LinkedIn] Token refresh error:', error);
    throw error;
  }
}

/**
 * Get LinkedIn user profile (to verify authentication)
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Profile data with person ID
 */
async function getProfile(userId) {
  const accessToken = await getAccessToken(userId);

  try {
    // Try userinfo endpoint first (OAuth 2.0)
    let response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401) {
      // Token expired, try to refresh
      await refreshAccessToken(userId);
      return getProfile(userId); // Retry with new token
    }

    if (response.ok) {
      const userInfo = await response.json();
      // userinfo returns 'sub' which is the person ID
      return {
        sub: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email,
        personId: userInfo.sub, // For compatibility
      };
    }

    // Fallback to /v2/me endpoint
    response = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401) {
      await refreshAccessToken(userId);
      return getProfile(userId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LinkedIn API error: ${response.status} ${errorText}`);
    }

    const meData = await response.json();
    // Extract person ID from the response
    const personId = meData.id || meData.sub;
    
    return {
      sub: personId,
      personId: personId,
      name: meData.localizedFirstName + ' ' + meData.localizedLastName,
    };
  } catch (error) {
    console.error('[LinkedIn] Get profile error:', error);
    throw error;
  }
}

/**
 * Upload an image to LinkedIn
 * @param {number} userId - User ID
 * @param {string} imageUrl - URL of the image to upload
 * @returns {Promise<string>} LinkedIn image URN
 */
async function uploadImage(userId, imageUrl) {
  const accessToken = await getAccessToken(userId);

  try {
    // Get user's LinkedIn person ID
    const profile = await getProfile(userId);
    const personId = profile.sub || profile.personId;
    
    if (!personId) {
      throw new Error('Unable to get LinkedIn person ID');
    }
    
    // Step 1: Register image upload
    const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: `urn:li:person:${personId}`,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      }),
    });

    if (registerResponse.status === 401) {
      // Token expired, refresh and retry
      await refreshAccessToken(userId);
      return uploadImage(userId, imageUrl);
    }

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      throw new Error(`Image registration failed: ${registerResponse.status} ${errorText}`);
    }

    const registerData = await registerResponse.json();
    const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const asset = registerData.value.asset;

    // Step 2: Download image from URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }
    
    // Determine content type from response or URL
    const contentType = imageResponse.headers.get('content-type') || 
      (imageUrl.match(/\.(jpg|jpeg)$/i) ? 'image/jpeg' : 
       imageUrl.match(/\.png$/i) ? 'image/png' : 
       'image/jpeg');
    
    const imageBuffer = await imageResponse.arrayBuffer();

    // Step 3: Upload image to LinkedIn
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Image upload failed: ${uploadResponse.status} ${errorText}`);
    }

    return asset;
  } catch (error) {
    console.error('[LinkedIn] Image upload error:', error);
    throw error;
  }
}

/**
 * Post content to LinkedIn
 * @param {number} userId - User ID
 * @param {string} text - Post text content
 * @param {string[]} imageUrls - Array of image URLs (optional, max 9)
 * @returns {Promise<Object>} Post response with post URN
 */
async function createPost(userId, text, imageUrls = []) {
  const accessToken = await getAccessToken(userId);

  try {
    // Get user profile to get their LinkedIn person URN
    const profile = await getProfile(userId);
    const personUrn = `urn:li:person:${profile.sub}`;

    // Prepare post content
    const postContent = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: text,
          },
          shareMediaCategory: imageUrls.length > 0 ? 'IMAGE' : 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    // Add images if provided
    if (imageUrls.length > 0) {
      if (imageUrls.length > 9) {
        throw new Error('LinkedIn posts can have a maximum of 9 images');
      }

      const media = [];
      for (const imageUrl of imageUrls) {
        try {
          const imageUrn = await uploadImage(userId, imageUrl);
          media.push({
            status: 'READY',
            media: imageUrn,
            description: {
              text: 'Post image',
            },
            title: {
              text: 'Post image',
            },
          });
        } catch (error) {
          console.error(`[LinkedIn] Failed to upload image ${imageUrl}:`, error);
          // Continue with other images
        }
      }

      if (media.length > 0) {
        postContent.specificContent['com.linkedin.ugc.ShareContent'].media = media;
      }
    }

    // Create the post
    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postContent),
    });

    if (response.status === 401) {
      // Token expired, refresh and retry
      await refreshAccessToken(userId);
      return createPost(userId, text, imageUrls);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LinkedIn post failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    // Extract activity ID from URN (format: urn:li:ugcPost:1234567890)
    let postUrl = '';
    if (result.id) {
      const activityId = result.id.split(':').pop();
      postUrl = `https://www.linkedin.com/feed/update/${activityId}`;
    }
    
    return {
      success: true,
      postUrn: result.id,
      postUrl: postUrl,
    };
  } catch (error) {
    console.error('[LinkedIn] Create post error:', error);
    throw error;
  }
}

/**
 * Post a scheduled post to LinkedIn
 * @param {number} postId - Post ID from database
 * @param {number} userId - User ID (optional, will use first user with LinkedIn credentials if not provided)
 * @returns {Promise<Object>} Post result
 */
async function postScheduledPost(postId, userId = null) {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);

    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    if (!post.final_content) {
      throw new Error(`Post ${postId} has no final content`);
    }

    if (post.status !== 'Approved' && post.status !== 'Scheduled') {
      throw new Error(`Post ${postId} is not approved or scheduled (status: ${post.status})`);
    }

    // If userId not provided, find first user with LinkedIn credentials
    if (!userId) {
      const userWithLinkedIn = db.prepare(`
        SELECT DISTINCT user_id FROM settings 
        WHERE key = 'linkedin_access_token' AND value IS NOT NULL AND value != ''
        LIMIT 1
      `).get();
      
      if (!userWithLinkedIn) {
        throw new Error('No user with LinkedIn credentials found. Please configure LinkedIn API in Settings.');
      }
      
      userId = userWithLinkedIn.user_id;
    }

    // Parse image URLs from final_img
    const imageUrls = post.final_img
      ? post.final_img.split(',').map(url => url.trim()).filter(Boolean)
      : [];

    // Create the post
    const result = await createPost(userId, post.final_content, imageUrls);

    // Update post status and LinkedIn URL
    db.prepare(`
      UPDATE posts SET
        status = 'Posted',
        posted_at = CURRENT_TIMESTAMP,
        linkedin_post_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(result.postUrl, postId);

    return {
      success: true,
      postId,
      linkedInUrl: result.postUrl,
      message: 'Post published to LinkedIn successfully',
    };
  } catch (error) {
    console.error(`[LinkedIn] Failed to post ${postId}:`, error);

    // Update post with error (optional - you might want to keep it as Scheduled for retry)
    db.prepare(`
      UPDATE posts SET
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(postId);

    throw error;
  }
}

module.exports = {
  getAccessToken,
  refreshAccessToken,
  getProfile,
  uploadImage,
  createPost,
  postScheduledPost,
};
