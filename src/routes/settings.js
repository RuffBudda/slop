/**
 * Settings Routes
 * Handles API key management and user settings
 */

const express = require('express');
const crypto = require('crypto');
const db = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

// Encryption key derivation (in production, use proper key management)
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.SESSION_SECRET || 'default-key',
  'salt',
  32
);
const IV_LENGTH = 16;

/**
 * Encrypt a value
 */
function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt a value
 */
function decrypt(text) {
  if (!text) return null;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

/**
 * Define which settings are sensitive (should be encrypted)
 */
const SENSITIVE_KEYS = [
  'openai_api_key',
  'stability_api_key',
  'spaces_key',
  'spaces_secret',
  'google_drive_refresh_token',
  'google_drive_access_token',
  'google_drive_service_account',
  'google_drive_client_id',
  'google_drive_client_secret',
  'linkedin_client_id',
  'linkedin_client_secret',
  'linkedin_access_token',
  'linkedin_refresh_token'
];

/**
 * Default prompts used in the application
 * These are generic templates that can be customized by users
 */
const DEFAULT_PROMPTS = {
  content_system_prompt: {
    name: 'Content Generation System Prompt',
    description: 'System prompt used by OpenAI to generate LinkedIn post content and image prompts',
    value: `You are a professional content creator specializing in LinkedIn posts.

Generate high-quality, engaging content that follows the provided instructions, template structure, and guidelines.

INPUT FIELDS:
- {{id}}: Post identifier
- {{instruction}}: Primary directive for content creation
- {{type}}: Post category or lens
- {{template}}: Structural flow to follow
- {{purpose}}: Intent and goal of the post
- {{sample}}: Style reference for pacing and rhythm
- {{keywords}}: Keywords to naturally integrate

OUTPUT REQUIREMENTS:
- Produce 3 distinct variants
- Each variant should feel unique with different angles
- Follow the template structure invisibly
- Integrate keywords naturally
- End with a reflective question and 3-5 relevant hashtags
- Format as valid JSON with id, variant_1, variant_2, variant_3, image_prompt_1, image_prompt_2, image_prompt_3

IMAGE PROMPTS:
- Create realistic, professional image prompts
- Match the content theme and purpose
- Use documentary-style, photorealistic descriptions
- Avoid people, faces, text, or fantasy elements`
  },
  content_user_template: {
    name: 'Content User Prompt Template',
    description: 'Template for building the user prompt from post data. Use placeholders: {{instruction}}, {{type}}, {{template}}, {{purpose}}, {{sample}}, {{keywords}}',
    value: `Generate LinkedIn post content based on the following inputs:

{{id}}
{{instruction}}
{{type}}
{{template}}
{{purpose}}
{{sample}}
{{keywords}}

Follow the instruction exactly. Use the template structure, reflect the type, achieve the purpose, integrate keywords naturally, and match the sample's pacing style.

Output format (JSON only):
{
"id": "{{id}}",
"variant_1": "...",
"variant_2": "...",
"variant_3": "...",
"image_prompt_1": "...",
"image_prompt_2": "...",
"image_prompt_3": "..."
}

Each variant should be unique with different angles. End with a reflective question and 3-5 relevant hashtags.`
  },
  image_style_prefix: {
    name: 'Image Prompt Style Prefix',
    description: 'Prefix added to all image prompts to ensure consistent style',
    value: 'Professional, photorealistic image. Documentary style. Natural lighting. Realistic textures and composition. '
  },
  image_style_suffix: {
    name: 'Image Prompt Style Suffix', 
    description: 'Suffix added to all image prompts for additional styling',
    value: ' Avoid: people, faces, hands, text, fantasy elements, over-stylized renders.'
  },
  stability_aspect_ratio: {
    name: 'Stability AI Aspect Ratio',
    description: 'Aspect ratio for generated images (e.g., 1:1, 16:9, 9:16)',
    value: '1:1'
  },
  stability_model: {
    name: 'Stability AI Model',
    description: 'Model to use for image generation (e.g., sd3-large-turbo, sd3, stable-diffusion-xl-1024-v1-0)',
    value: 'sd3-large-turbo'
  },
  stability_output_format: {
    name: 'Stability AI Output Format',
    description: 'Output format for generated images (png or jpeg)',
    value: 'png'
  },
  stability_negative_prompt: {
    name: 'Stability AI Negative Prompt',
    description: 'Negative prompt to avoid certain elements in generated images',
    value: 'people, faces, hands, scooters, labs, neon lighting, cinematic glow, fantasy elements, exaggerated depth, stylised art, over-polished renders, symmetry perfection, text, words, letters, numbers'
  },
  stability_seed: {
    name: 'Stability AI Seed (Optional)',
    description: 'Random seed for reproducible results (leave empty for random)',
    value: ''
  },
  stability_steps: {
    name: 'Stability AI Steps',
    description: 'Number of inference steps (higher = better quality but slower, default: auto)',
    value: ''
  },
  stability_cfg_scale: {
    name: 'Stability AI CFG Scale',
    description: 'Classifier-free guidance scale (1-35, default: auto)',
    value: ''
  }
};

/**
 * Get all settings for current user
 * GET /api/settings
 */
router.get('/', (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT key, value, encrypted FROM settings WHERE user_id = ?
    `).all(req.user.id);

    const result = {};
    for (const setting of settings) {
      if (setting.encrypted) {
        // For sensitive settings, indicate they're set but don't return value
        result[setting.key] = {
          isSet: !!setting.value,
          masked: setting.value ? '••••••••' : null
        };
      } else {
        result[setting.key] = setting.value;
      }
    }

    res.json({ settings: result });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * Get a specific setting value (decrypted for server-side use)
 * Internal use only - not exposed as route
 */
function getSettingValue(userId, key) {
  const setting = db.prepare(`
    SELECT value, encrypted FROM settings WHERE user_id = ? AND key = ?
  `).get(userId, key);

  if (!setting) return null;
  
  if (setting.encrypted) {
    return decrypt(setting.value);
  }
  return setting.value;
}

/**
 * Update a setting
 * PUT /api/settings/:key
 */
router.put('/:key', (req, res) => {
  try {
    const { key } = req.params;
    let { value } = req.body;

    // Validate key name - only allow alphanumeric, underscore, and hyphen
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      return res.status(400).json({ error: 'Invalid setting key name' });
    }

    // Validate value length if provided
    if (value && typeof value === 'string' && value.length > 50000) {
      return res.status(400).json({ error: 'Setting value exceeds maximum length' });
    }

    // For service account key, ensure it's valid JSON before storing
    if (key === 'google_drive_service_account' && value) {
      try {
        // Validate JSON structure
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (parsed.type !== 'service_account' || !parsed.client_email || !parsed.private_key) {
          return res.status(400).json({ 
            error: 'Invalid service account key. Must contain type, client_email, and private_key.' 
          });
        }
        // Ensure it's stored as JSON string
        value = typeof value === 'string' ? value : JSON.stringify(value);
      } catch (parseError) {
        return res.status(400).json({ 
          error: 'Invalid JSON format for service account key' 
        });
      }
    }

    const isEncrypted = SENSITIVE_KEYS.includes(key);
    const storedValue = isEncrypted && value ? encrypt(value) : value;

    // Upsert setting
    db.prepare(`
      INSERT INTO settings (user_id, key, value, encrypted, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        encrypted = excluded.encrypted,
        updated_at = CURRENT_TIMESTAMP
    `).run(req.user.id, key, storedValue, isEncrypted ? 1 : 0);

    res.json({ 
      success: true, 
      message: `Setting '${key}' updated`,
      isSet: !!value
    });

  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

/**
 * Bulk update settings
 * PUT /api/settings
 */
router.put('/', (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const upsertSetting = db.prepare(`
      INSERT INTO settings (user_id, key, value, encrypted, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        encrypted = excluded.encrypted,
        updated_at = CURRENT_TIMESTAMP
    `);

    const updateMany = db.transaction((settingsToUpdate) => {
      for (const [key, value] of Object.entries(settingsToUpdate)) {
        const isEncrypted = SENSITIVE_KEYS.includes(key);
        const storedValue = isEncrypted && value ? encrypt(value) : value;
        upsertSetting.run(req.user.id, key, storedValue, isEncrypted ? 1 : 0);
      }
    });

    updateMany(settings);

    res.json({ 
      success: true, 
      message: 'Settings updated'
    });

  } catch (error) {
    console.error('Bulk update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * Delete a setting
 * DELETE /api/settings/:key
 */
router.delete('/:key', (req, res) => {
  try {
    const { key } = req.params;

    db.prepare(`
      DELETE FROM settings WHERE user_id = ? AND key = ?
    `).run(req.user.id, key);

    res.json({ 
      success: true, 
      message: `Setting '${key}' deleted`
    });

  } catch (error) {
    console.error('Delete setting error:', error);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

/**
 * Test OpenAI API key
 * POST /api/settings/test/openai
 */
router.post('/test/openai', async (req, res) => {
  try {
    const apiKey = getSettingValue(req.user.id, 'openai_api_key');
    
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key not configured' });
    }

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    // Simple test - list models
    const models = await openai.models.list();
    
    res.json({ 
      success: true, 
      message: 'OpenAI API key is valid',
      modelsAvailable: models.data.length
    });

  } catch (error) {
    console.error('OpenAI test error:', error);
    res.status(400).json({ 
      error: 'OpenAI API key test failed',
      details: error.message 
    });
  }
});

/**
 * Test Stability AI API key
 * POST /api/settings/test/stability
 */
router.post('/test/stability', async (req, res) => {
  try {
    const apiKey = getSettingValue(req.user.id, 'stability_api_key');
    
    if (!apiKey) {
      return res.status(400).json({ error: 'Stability AI API key not configured' });
    }

    // Test by fetching account info
    const response = await fetch('https://api.stability.ai/v1/user/account', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error('Invalid API key');
    }

    const data = await response.json();
    
    res.json({ 
      success: true, 
      message: 'Stability AI API key is valid',
      credits: data.credits
    });

  } catch (error) {
    console.error('Stability test error:', error);
    res.status(400).json({ 
      error: 'Stability AI API key test failed',
      details: error.message 
    });
  }
});

/**
 * Get current user profile
 * GET /api/settings/profile
 */
router.get('/profile', (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, email, display_name, role, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ profile: user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * Update current user profile (username, email, display_name)
 * PUT /api/settings/profile
 */
router.put('/profile', (req, res) => {
  try {
    const { username, email, displayName } = req.body;

    // Validate inputs
    if (!username && !email && !displayName) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Check for unique username
    if (username) {
      const existing = db.prepare(`
        SELECT id FROM users WHERE username = ? AND id != ?
      `).get(username, req.user.id);
      
      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    // Check for unique email
    if (email) {
      const existing = db.prepare(`
        SELECT id FROM users WHERE email = ? AND id != ?
      `).get(email, req.user.id);
      
      if (existing) {
        return res.status(400).json({ error: 'Email already taken' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (username) {
      updates.push('username = ?');
      values.push(username);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (displayName !== undefined) {
      updates.push('display_name = ?');
      values.push(displayName || null);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.id);

    db.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    // Fetch updated user
    const user = db.prepare(`
      SELECT id, username, email, display_name, role
      FROM users WHERE id = ?
    `).get(req.user.id);

    res.json({ 
      success: true, 
      message: 'Profile updated',
      profile: user
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * Change current user password
 * PUT /api/settings/password
 */
router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Verify current password
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash and save new password
    const newHash = await bcrypt.hash(newPassword, 10);
    
    db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newHash, req.user.id);

    res.json({ 
      success: true, 
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * Get all prompts (custom or defaults)
 * GET /api/settings/prompts
 */
router.get('/prompts', (req, res) => {
  try {
    const prompts = {};
    
    for (const [key, defaultPrompt] of Object.entries(DEFAULT_PROMPTS)) {
      // Check if user has a custom value
      const customValue = getSettingValue(req.user.id, `prompt_${key}`);
      
      prompts[key] = {
        name: defaultPrompt.name,
        description: defaultPrompt.description,
        value: customValue || defaultPrompt.value,
        isCustom: !!customValue,
        defaultValue: defaultPrompt.value
      };
    }
    
    res.json({ prompts });
  } catch (error) {
    console.error('Get prompts error:', error);
    res.status(500).json({ error: 'Failed to get prompts' });
  }
});

/**
 * Get a specific prompt
 * GET /api/settings/prompts/:key
 */
router.get('/prompts/:key', (req, res) => {
  try {
    const { key } = req.params;
    const defaultPrompt = DEFAULT_PROMPTS[key];
    
    if (!defaultPrompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    const customValue = getSettingValue(req.user.id, `prompt_${key}`);
    
    res.json({
      prompt: {
        key,
        name: defaultPrompt.name,
        description: defaultPrompt.description,
        value: customValue || defaultPrompt.value,
        isCustom: !!customValue,
        defaultValue: defaultPrompt.value
      }
    });
  } catch (error) {
    console.error('Get prompt error:', error);
    res.status(500).json({ error: 'Failed to get prompt' });
  }
});

/**
 * Update a prompt
 * PUT /api/settings/prompts/:key
 */
router.put('/prompts/:key', (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (!DEFAULT_PROMPTS[key]) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    if (!value || typeof value !== 'string') {
      return res.status(400).json({ error: 'Prompt value is required' });
    }
    
    // Save custom prompt as a setting
    db.prepare(`
      INSERT INTO settings (user_id, key, value, encrypted, updated_at)
      VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(req.user.id, `prompt_${key}`, value);
    
    res.json({
      success: true,
      message: 'Prompt updated',
      prompt: {
        key,
        name: DEFAULT_PROMPTS[key].name,
        value,
        isCustom: true
      }
    });
  } catch (error) {
    console.error('Update prompt error:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

/**
 * Reset a prompt to default
 * DELETE /api/settings/prompts/:key
 */
router.delete('/prompts/:key', (req, res) => {
  try {
    const { key } = req.params;
    
    if (!DEFAULT_PROMPTS[key]) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    // Delete custom prompt setting
    db.prepare(`
      DELETE FROM settings WHERE user_id = ? AND key = ?
    `).run(req.user.id, `prompt_${key}`);
    
    res.json({
      success: true,
      message: 'Prompt reset to default',
      prompt: {
        key,
        name: DEFAULT_PROMPTS[key].name,
        value: DEFAULT_PROMPTS[key].value,
        isCustom: false
      }
    });
  } catch (error) {
    console.error('Reset prompt error:', error);
    res.status(500).json({ error: 'Failed to reset prompt' });
  }
});

/**
 * Get a prompt value for internal use
 * Returns custom value if set, otherwise default
 */
function getPromptValue(userId, key) {
  const customValue = getSettingValue(userId, `prompt_${key}`);
  if (customValue) return customValue;
  
  const defaultPrompt = DEFAULT_PROMPTS[key];
  return defaultPrompt ? defaultPrompt.value : null;
}

/**
 * Test DigitalOcean Spaces credentials
 * POST /api/settings/test/spaces
 */
router.post('/test/spaces', async (req, res) => {
  try {
    const spacesName = getSettingValue(req.user.id, 'spaces_name');
    const spacesRegion = getSettingValue(req.user.id, 'spaces_region');
    const spacesKey = getSettingValue(req.user.id, 'spaces_key');
    const spacesSecret = getSettingValue(req.user.id, 'spaces_secret');
    
    if (!spacesName || !spacesKey || !spacesSecret) {
      return res.status(400).json({ error: 'DigitalOcean Spaces credentials not configured' });
    }

    const AWS = require('aws-sdk');
    const spacesEndpoint = new AWS.Endpoint(`${spacesRegion || 'nyc3'}.digitaloceanspaces.com`);
    const s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: spacesKey,
      secretAccessKey: spacesSecret
    });

    // Test by listing bucket
    await s3.listObjectsV2({ Bucket: spacesName, MaxKeys: 1 }).promise();
    
    res.json({ 
      success: true, 
      message: 'DigitalOcean Spaces credentials are valid',
      bucket: spacesName,
      region: spacesRegion
    });

  } catch (error) {
    console.error('Spaces test error:', error);
    res.status(400).json({ 
      error: 'DigitalOcean Spaces test failed',
      details: error.message 
    });
  }
});

/**
 * Test LinkedIn API credentials
 * POST /api/settings/test/linkedin
 */
router.post('/test/linkedin', async (req, res) => {
  try {
    const linkedInService = require('../services/linkedInService');
    
    // Test by getting user profile
    const profile = await linkedInService.getProfile(req.user.id);
    
    res.json({ 
      success: true, 
      message: 'LinkedIn API credentials are valid',
      profile: {
        name: profile.name,
        email: profile.email,
        sub: profile.sub
      }
    });

  } catch (error) {
    console.error('LinkedIn test error:', error);
    res.status(400).json({ 
      error: 'LinkedIn API test failed',
      details: error.message 
    });
  }
});

/**
 * Reset/Refresh entire instance
 * POST /api/settings/reset-instance
 * Requires admin authentication and confirmation text
 */
router.post('/reset-instance', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { adminUsername, adminPassword, confirmationText } = req.body;
    
    // Validate inputs
    if (!adminUsername || !adminPassword || !confirmationText) {
      return res.status(400).json({ 
        error: 'Admin username, password, and confirmation text are required' 
      });
    }
    
    // Expected confirmation text
    const expectedText = "Humpty Dumpty sat on a wall. Humpty Dumpty had a great fall. All the king's horses and all the king's men couldn't put Humpty together again.";
    
    // Verify confirmation text matches exactly
    if (confirmationText.trim() !== expectedText) {
      return res.status(400).json({ 
        error: 'Confirmation text does not match. Please copy and paste the exact text.' 
      });
    }
    
    // Verify admin username matches current user
    const currentUser = db.prepare('SELECT id, username, password_hash FROM users WHERE id = ?').get(req.user.id);
    
    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }
    
    if (currentUser.username !== adminUsername) {
      return res.status(400).json({ error: 'Admin username does not match' });
    }
    
    // Verify password
    const bcrypt = require('bcrypt');
    const isValidPassword = await bcrypt.compare(adminPassword, currentUser.password_hash);
    
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Admin password is incorrect' });
    }
    
    // All validations passed - proceed with reset
    // Clear all data from all tables (but keep schema)
    const resetTransaction = db.transaction(() => {
      // Delete all posts
      db.prepare('DELETE FROM posts').run();
      
      // Delete all settings
      db.prepare('DELETE FROM settings').run();
      
      // Delete all workflow sessions
      db.prepare('DELETE FROM workflow_sessions').run();
      
      // Delete all users except the current admin
      db.prepare('DELETE FROM users WHERE id != ?').run(req.user.id);
      
      // Reset sequences/indexes if needed (SQLite handles this automatically)
    });
    
    resetTransaction();
    
    // Send response first
    res.json({ 
      success: true, 
      message: 'Instance has been completely reset. All data has been cleared. You will need to log in again.',
      reset: true
    });
    
    // Destroy session after response is sent to force re-login
    setTimeout(() => {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
      });
    }, 100);

  } catch (error) {
    console.error('Reset instance error:', error);
    res.status(500).json({ 
      error: 'Failed to reset instance',
      details: error.message 
    });
  }
});

// Export helper functions for use in other modules
module.exports = router;
module.exports.getSettingValue = getSettingValue;
module.exports.getPromptValue = getPromptValue;
module.exports.DEFAULT_PROMPTS = DEFAULT_PROMPTS;
module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;
