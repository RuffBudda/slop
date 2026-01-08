/**
 * Image Generation Service
 * Uses Stability AI for generating LinkedIn post images
 * Replaces the n8n Stability AI node functionality
 */

const db = require('../database/db');
const { getSettingValue, getPromptValue } = require('../routes/settings');

const STABILITY_API_URL = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';

/**
 * Enhance image prompt with customizable style prefix/suffix
 * @param {number} userId - User ID for settings lookup
 * @param {string} prompt - Original image prompt
 * @returns {string} Enhanced prompt with style modifiers
 */
function enhanceImagePrompt(userId, prompt) {
  const prefix = getPromptValue(userId, 'image_style_prefix') || '';
  const suffix = getPromptValue(userId, 'image_style_suffix') || '';
  
  let enhancedPrompt = prompt;
  
  if (prefix) {
    enhancedPrompt = `${prefix} ${enhancedPrompt}`;
  }
  
  if (suffix) {
    enhancedPrompt = `${enhancedPrompt}${suffix}`;
  }
  
  return enhancedPrompt.trim();
}

/**
 * Generate an image using Stability AI
 * @param {number} userId - User ID for API key lookup
 * @param {string} prompt - Image generation prompt
 * @param {Object} options - Generation options (overrides user settings)
 * @returns {Buffer} Generated image as buffer
 */
async function generateImage(userId, prompt, options = {}) {
  const apiKey = getSettingValue(userId, 'stability_api_key');
  
  if (!apiKey) {
    throw new Error('Stability AI API key not configured');
  }

  // Get user-configured defaults, allow options to override
  const aspectRatio = options.aspectRatio || getPromptValue(userId, 'stability_aspect_ratio') || '1:1';
  const outputFormat = options.outputFormat || getPromptValue(userId, 'stability_output_format') || 'png';
  const model = options.model || getPromptValue(userId, 'stability_model') || 'sd3-large-turbo';
  const negativePrompt = options.negativePrompt || getPromptValue(userId, 'stability_negative_prompt') || '';
  const seed = options.seed || getPromptValue(userId, 'stability_seed') || null;
  const steps = options.steps || getPromptValue(userId, 'stability_steps') || null;
  const cfgScale = options.cfgScale || getPromptValue(userId, 'stability_cfg_scale') || null;
  const enhancePrompt = options.enhancePrompt !== undefined ? options.enhancePrompt : true;

  // Enhance prompt with style modifiers if enabled
  const finalPrompt = enhancePrompt ? enhanceImagePrompt(userId, prompt) : prompt;

  try {
    const formData = new FormData();
    formData.append('prompt', finalPrompt);
    formData.append('aspect_ratio', aspectRatio);
    formData.append('output_format', outputFormat);
    formData.append('model', model);
    
    // Add optional parameters if configured
    if (negativePrompt) {
      formData.append('negative_prompt', negativePrompt);
    }
    if (seed && seed.trim() !== '') {
      formData.append('seed', parseInt(seed));
    }
    if (steps && steps.trim() !== '') {
      formData.append('steps', parseInt(steps));
    }
    if (cfgScale && cfgScale.trim() !== '') {
      formData.append('cfg_scale', parseFloat(cfgScale));
    }

    const response = await fetch(STABILITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'image/*'
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `API error: ${response.status}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    return imageBuffer;

  } catch (error) {
    console.error('Image generation error:', error);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

/**
 * Generate all images for a post
 * @param {number} userId - User ID for API key lookup
 * @param {Object} post - Post object with image prompts
 * @returns {Array} Array of generated image buffers
 */
async function generatePostImages(userId, post) {
  const images = [];
  const prompts = [
    post.image_prompt_1,
    post.image_prompt_2,
    post.image_prompt_3
  ].filter(Boolean);

  for (const prompt of prompts) {
    try {
      const imageBuffer = await generateImage(userId, prompt);
      images.push({
        buffer: imageBuffer,
        prompt: prompt
      });
      
      // Delay between requests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Failed to generate image for prompt: ${prompt.substring(0, 50)}...`, error);
      images.push({
        buffer: null,
        prompt: prompt,
        error: error.message
      });
    }
  }

  return images;
}

/**
 * Process images for a batch of posts
 * @param {number} userId - User ID for API key lookup
 * @param {Array} postIds - Array of post IDs to process
 * @param {Function} uploadFn - Function to upload images to storage
 * @returns {Object} Results with success and failure counts
 */
async function processBatch(userId, postIds, uploadFn) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const postId of postIds) {
    try {
      const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
      
      if (!post) {
        results.failed++;
        results.errors.push({ id: postId, error: 'Post not found' });
        continue;
      }

      // Generate images
      const images = await generatePostImages(userId, post);

      // Upload images and get URLs
      const imageUrls = [];
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (image.buffer) {
          try {
            const url = await uploadFn(image.buffer, `${post.post_id}-${i + 1}.png`);
            imageUrls.push(url);
          } catch (uploadError) {
            console.error('Image upload error:', uploadError);
            imageUrls.push(null);
          }
        } else {
          imageUrls.push(null);
        }
      }

      // Update post with image URLs
      db.prepare(`
        UPDATE posts SET
          image_url_1 = ?,
          image_url_2 = ?,
          image_url_3 = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        imageUrls[0] || null,
        imageUrls[1] || null,
        imageUrls[2] || null,
        postId
      );

      results.success++;

    } catch (error) {
      results.failed++;
      results.errors.push({ id: postId, error: error.message });
    }
  }

  return results;
}

module.exports = {
  generateImage,
  generatePostImages,
  processBatch,
  enhanceImagePrompt
};
