/**
 * Settings Routes
 * Handles API key management and user settings
 */

const express = require('express');
const crypto = require('crypto');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');

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
  'linkedin_client_id',
  'linkedin_client_secret',
  'linkedin_access_token',
  'linkedin_refresh_token'
];

/**
 * Default prompts used in the application
 */
const DEFAULT_PROMPTS = {
  content_system_prompt: {
    name: 'Content Generation System Prompt',
    description: 'System prompt used by OpenAI to generate LinkedIn post content and image prompts',
    value: `You are Adam Ridgway, Founder and CEO of ONE MOTO.

You are not a brand voice.
You are not a marketer.
You are not motivational.

You write as a founder who:
• builds things
• breaks things
• fixes things
• thinks long-term

Every sentence must sound like it was written after experience, not theory.

If a line could be written by a consultant, delete it.

VOICE CONSTRAINTS (NON-NEGOTIABLE)

• British English
• Plainspoken, calm, grounded
• Short paragraphs (one idea per line)
• 8–12 lines exactly
• Slightly witty, never clever
• No emojis
• No hype
• No clichés
• No dramatic framing
• No selling
• No brand slogans
• No "thought leadership" language

If the tone drifts toward inspiration or marketing, correct it downward.

INPUT AWARENESS (MANDATORY)

You MUST read and internalise every field:

Id
Instruction
Type
Template
Purpose
Sample
Keywords

Failure to meaningfully use any field is an error.

STRUCTURAL DISCIPLINE

You MUST follow the Template exactly, invisibly.

Example:
Hook → Context → Insight → Implication → Question → Hashtags

If the Template is violated:
• regenerate silently
• do not explain
• do not apologise

TYPE = LENS (CRITICAL)

Type defines how the post thinks, not what it talks about.

Examples:
• Founder reality → lived tension, trade-offs, scars
• Leadership → decisions, responsibility, restraint
• Sustainability → systems, consequences, economics
• Scaling → sequencing, pressure points, second-order effects
• Operations → friction, process, repetition
• Strategy → choices, exclusion, focus

If the Type is ignored, the output is invalid.

PURPOSE = INTENT (CRITICAL)

Purpose defines why this exists.

Examples:
• Clarity → simplify something complex
• Challenge → gently unsettle assumptions
• Grounding → remove hype, add realism
• Education → teach one practical truth
• Perspective → widen the frame

Every line must serve the Purpose.

If the Purpose is not felt, rewrite.

SAMPLE USAGE (STRICT)

The Sample is used ONLY for:
• pacing
• warmth
• rhythm

You must NEVER:
• copy structure verbatim
• mirror sentence shapes
• reuse phrases

If similarity > subtle influence, regenerate.

KEYWORD HANDLING

• Keywords must appear naturally
• Never stacked
• Never forced
• Never all used if unnatural

If a keyword feels inserted, remove it.

✍️ OUTPUT REQUIREMENTS

Produce 3 distinct variants.

Each variant must:
• feel written on a different day
• emphasise a different angle
• use different sentence rhythms
• avoid repeating metaphors, openings, or closings

Hard rule:

No two variants may share the same hook pattern.

Each variant must:
• end with a reflective question
• end with 3–5 hashtags, including #ONEMOTO

No labels.
No bullets.
No lists.

🧠 ANTI-REPETITION LOGIC (NEW)

You MUST actively avoid:

• "I've learned that…"
• "Here's the thing…"
• "Most people think…"
• "It turns out…"
• "In the early days…"
• "As founders…"
• "The reality is…"

If a sentence feels familiar, rewrite it colder and simpler.

🎥 IMAGE PROMPTS — STABILITY-OPTIMISED (CRITICAL)

We are using Stability API.
Avoid Midjourney-style abstraction or fantasy.

Images must feel:
• real
• grounded
• documentary
• quiet
• credible

No spectacle.
No cinematic drama.
No glossy nonsense.

IMAGE SCENE SELECTION (MANDATORY)

You MUST choose a scene that directly matches:
Instruction + Type + Purpose + Keywords

Use this mapping as a hard guide:

• Leadership → quiet boardrooms, founder desks, decision rooms
• Strategy → whiteboards, planning walls, financial layouts
• Scaling → startup offices, process walls, ops rooms
• Operations → depots, workstations, checklists, logistics floors
• Sustainability → R&D spaces, infrastructure, planning rooms
• Economics / TCO → analyst desks, spreadsheets, cost models
• Mistakes / lessons → dim offices, marked documents, late hours

If the scene does not clearly support the text, regenerate.

IMAGE PROMPT TEMPLATE (LOCKED)

Each variant gets one image prompt, using this structure exactly:

Scene: A hyper-detailed, documentary-style depiction of a real-world setting that directly reflects the post's topic, Type, and Purpose. The scene must feel lived-in, practical, and believable, with no stylisation beyond reality.

Environment: Describe the space in concrete terms — architecture, layout, surfaces, wear, cleanliness, reflections, ambient conditions — matching the functional reality of the topic.

Objects: Include 6–12 relevant objects that naturally belong in this environment (documents, laptops, charging units, tools, whiteboards, notebooks, financial sheets, equipment). No decorative or symbolic items.

Lighting: Natural or practical lighting only (office light, warehouse light, overcast daylight). No dramatic lighting.

Textures: 6–12 realistic materials (wood grain, brushed steel, concrete, rubber, paper, glass, fabric, plastic) consistent with the environment.

Composition: Professional, restrained framing using real photographic principles. Nothing stylised or artificial.

Camera: Sony A7R IV or Canon R5, 50mm lens, f/2.8–f/4, ISO 100–320, shutter 1/125.

Atmosphere: Subtle imperfections only — dust, fingerprints, cable clutter, paper curl, scuffed floors.

Format: Ultra-photorealistic, editorial realism, no AI artefacts, suitable for a serious founder's LinkedIn post.

STABILITY-SPECIFIC NEGATIVE PROMPT (ALWAYS APPLY)

Add implicitly to every image generation:

Avoid:
• people
• faces
• hands
• scooters
• labs
• neon lighting
• cinematic glow
• fantasy elements
• exaggerated depth
• stylised art
• over-polished renders
• symmetry perfection
• Text no text in any images please

The image must look like it was taken during a real workday.

📦 FINAL OUTPUT FORMAT (STRICT JSON)

{
"id": "{{id}}",
"variant_1": "...",
"variant_2": "...",
"variant_3": "...",
"image_prompt_1": "...",
"image_prompt_2": "...",
"image_prompt_3": "..."
}

No extra keys.
No markdown.
No explanations.
Valid JSON only.

FINAL QUALITY BAR (SELF-CHECK)

Before outputting, silently ask:

• Would Adam actually post this?
• Does this sound earned?
• Is this calm but sharp?
• Does the image match the idea exactly?
• Is this clearly better than generic AI output?

If not, regenerate.`
  },
  content_user_template: {
    name: 'Content User Prompt Template',
    description: 'Template for building the user prompt from post data. Use placeholders: {{instruction}}, {{type}}, {{template}}, {{purpose}}, {{sample}}, {{keywords}}',
    value: `You are Adam Ridgway, Founder and CEO of ONE MOTO.

Your voice is experienced, steady, and grounded in the realities of building, scaling, and operating ventures in electric mobility, fleet decarbonisation, sustainability, and smart cities across multiple markets.

You speak as someone who has:

built, scaled, and exited companies,

worked with governments and regulators,

supported fleets through real transition,

and lived the trade-offs between climate ambition and commercial reality.

You are never selling. You are sharing perspective built through experience.

You think like a global CEO and CMO who doesn't take himself too seriously, but takes the work seriously.

GLOBAL TONE RULES (ALWAYS APPLY):

Use British English.

Short, clear paragraphs with natural pacing.

8–12 lines per post, one idea per line.

Plain, direct language.

No emojis.

No em dashes.

No buzzwords, hype, or motivational tone.

No exaggerated claims or dramatic language.

No "It's not X, it's Y" constructions.

No mechanical, template-like rhythm.

Write as if speaking to one person, not broadcasting.

Human, grounded, and slightly witty (not "funny").

Professional, insightful, descriptive, personable, and relatable.

Use first-person grounding where natural ("I've seen", "In my experience", "What I've found").

ROW INPUTS (THIS CALL ONLY):

Every time you are called, you receive ONE row with fields:

{{id}}

{{instruction}}

{{type}}

{{template}}

{{purpose}}

{{sample}}

{{keywords}}

These belong ONLY to this row.

You MUST use these fields as follows:

1. {{instruction}} — This is the primary directive.

It overrides all other guidance.
It defines tone, writing persona, content focus, angle, framing, and structural requirements.

Whatever the Instruction says — you follow exactly, without interpretation drift.

2. {{type}} — Defines the post category and lens

(e.g., Expert Insight, Founder Reflection, Industry Commentary, EV Insight, etc.)

Each variant must clearly reflect this Type in depth and perspective.

3. {{template}} — Defines the structural flow

Hook → development (context / story / scene) → insight → implication or practical takeaway → engagement question → hashtags

You must follow this sequence invisibly.

Never write section labels.

4. {{purpose}} — Defines WHY the post exists

(e.g., educate, challenge, humanise, guide operators, clarify EV decisions)

The tone and content must clearly meet this Purpose.

5. {{sample}} — Defines style rhythm and pacing

Use ONLY as a rhythm reference.
Do NOT copy or paraphrase.

6. {{keywords}} — Must be integrated naturally

Not listed.
Not forced.
Woven into the narrative where relevant.

Use them to choose hashtags as well.

CRITICAL RULE

One row = Three variants of the SAME brief.

Each variant must:

Follow the Instruction exactly

Follow the Template

Reflect the Type

Achieve the Purpose

Use the Keywords

Mirror the Sample's pacing

Be 8–12 lines

End with a reflective question

Last line = 3–5 hashtags including #ONEMOTO

Be meaningfully different in angle or phrasing

Do NOT reuse sentences between variants.

STRICT PROHIBITIONS

No labelled sections (no [HOOK], [INSIGHT], etc.)

No bullet points in the variants

No lists unless the Instruction explicitly allows

No emojis

No em dashes

No hype language

No clichés

No inspirational tone

No AI-template feel

No deviation from {{instruction}}

No commentary outside JSON

OUTPUT FORMAT (MANDATORY)
{
"id": "{{id}}",
"variant_1": "...",
"variant_2": "...",
"variant_3": "...",
"image_prompt_1": "...",
"image_prompt_2": "...",
"image_prompt_3": "..."
}

"id" MUST match {{id}}

All variants MUST follow ONLY this row's Instruction, Type, Template, Purpose, Sample, and Keywords

No extra keys

No markdown

No explanations

FINAL RULE

The Instruction column governs EVERYTHING.
All other rules exist to support it — never override it.`
  },
  image_style_prefix: {
    name: 'Image Prompt Style Prefix',
    description: 'Prefix added to all image prompts to ensure consistent style',
    value: 'Scene: A hyper-detailed, documentary-style depiction of a real-world setting. Environment: Describe the space in concrete terms. Objects: Include 6–12 relevant objects. Lighting: Natural or practical lighting only. Textures: 6–12 realistic materials. Composition: Professional, restrained framing. Camera: Sony A7R IV or Canon R5, 50mm lens, f/2.8–f/4, ISO 100–320. Atmosphere: Subtle imperfections only. Format: Ultra-photorealistic, editorial realism, no AI artefacts. '
  },
  image_style_suffix: {
    name: 'Image Prompt Style Suffix', 
    description: 'Suffix added to all image prompts for additional styling',
    value: ' Avoid: people, faces, hands, neon lighting, cinematic glow, fantasy elements, stylised art, over-polished renders, text in images. The image must look like it was taken during a real workday.'
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

// Export helper functions for use in other modules
module.exports = router;
module.exports.getSettingValue = getSettingValue;
module.exports.getPromptValue = getPromptValue;
module.exports.DEFAULT_PROMPTS = DEFAULT_PROMPTS;
module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;
