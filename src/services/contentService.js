/**
 * Content Generation Service
 * Uses OpenAI GPT for generating LinkedIn post content
 * Replaces the n8n OpenAI node functionality
 */

const OpenAI = require('openai');
const db = require('../database/db');
const { getSettingValue, getPromptValue } = require('../routes/settings');

/**
 * Default system prompt for LinkedIn content generation
 * This can be overridden via user settings
 * Based on the SLOP WORKFLOW.json configuration
 */
const DEFAULT_SYSTEM_PROMPT = `You are Adam Ridgway, Founder and CEO of ONE MOTO.

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

OUTPUT REQUIREMENTS

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

ANTI-REPETITION LOGIC

You MUST actively avoid:

• "I've learned that…"
• "Here's the thing…"
• "Most people think…"
• "It turns out…"
• "In the early days…"
• "As founders…"
• "The reality is…"

If a sentence feels familiar, rewrite it colder and simpler.

IMAGE PROMPTS — STABILITY-OPTIMISED (CRITICAL)

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

FINAL OUTPUT FORMAT (STRICT JSON)

{
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

If not, regenerate.`;

/**
 * Default image style prompt for Stability AI
 * Applied to all image generation requests
 */
const DEFAULT_IMAGE_STYLE_PROMPT = `Ultra-photorealistic, documentary-style photograph. Shot on Sony A7R IV or Canon R5 with 50mm lens at f/2.8-f/4. Natural or practical lighting only. No people, faces, hands, or text. Subtle imperfections like dust, fingerprints, cable clutter. Professional editorial realism suitable for LinkedIn. Avoid: neon lighting, cinematic glow, fantasy elements, stylised art, over-polished renders.`;

/**
 * Get the system prompt for a user (custom or default)
 */
function getSystemPrompt(userId) {
  return getPromptValue(userId, 'content_system_prompt') || DEFAULT_SYSTEM_PROMPT;
}

/**
 * Generate content for a single post
 * @param {number} userId - User ID for API key lookup
 * @param {Object} post - Post object with instruction, type, template, etc.
 * @returns {Object} Generated content with variants and image prompts
 */
async function generateContent(userId, post) {
  const apiKey = getSettingValue(userId, 'openai_api_key');
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey });

  // Get customizable prompts
  const systemPrompt = getSystemPrompt(userId);
  const userPrompt = buildUserPrompt(userId, post);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0].message.content;
    const result = JSON.parse(content);

    return {
      variant_1: result.variant_1 || '',
      variant_2: result.variant_2 || '',
      variant_3: result.variant_3 || '',
      image_prompt_1: result.image_prompt_1 || '',
      image_prompt_2: result.image_prompt_2 || '',
      image_prompt_3: result.image_prompt_3 || ''
    };

  } catch (error) {
    console.error('Content generation error:', error);
    throw new Error(`Content generation failed: ${error.message}`);
  }
}

/**
 * Build user prompt from post data using customizable template
 * @param {number} userId - User ID for prompt lookup
 * @param {Object} post - Post object with instruction, type, template, etc.
 */
function buildUserPrompt(userId, post) {
  // Get custom template or use default
  let template = getPromptValue(userId, 'content_user_template');
  
  // If no custom template, use simple default
  if (!template) {
    let prompt = 'Generate LinkedIn post content based on the following:\n\n';

    if (post.instruction) {
      prompt += `## Instruction\n${post.instruction}\n\n`;
    }

    if (post.type) {
      prompt += `## Post Type\n${post.type}\n\n`;
    }

    if (post.template) {
      prompt += `## Template/Structure\n${post.template}\n\n`;
    }

    if (post.purpose) {
      prompt += `## Purpose\n${post.purpose}\n\n`;
    }

    if (post.sample) {
      prompt += `## Sample/Reference\n${post.sample}\n\n`;
    }

    if (post.keywords) {
      prompt += `## Keywords to Include\n${post.keywords}\n\n`;
    }

    prompt += 'Please generate 3 unique variants and 3 image prompts in JSON format.';

    return prompt;
  }
  
  // Process mustache-like template syntax
  // {{#field}}...{{/field}} - conditional block (only shows if field has value)
  // {{field}} - simple replacement
  
  const fields = {
    instruction: post.instruction || '',
    type: post.type || '',
    template: post.template || '',
    purpose: post.purpose || '',
    sample: post.sample || '',
    keywords: post.keywords || ''
  };
  
  // Process conditional blocks {{#field}}...{{/field}}
  for (const [key, value] of Object.entries(fields)) {
    const conditionalRegex = new RegExp(`\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, 'g');
    template = template.replace(conditionalRegex, value ? `$1` : '');
  }
  
  // Replace simple placeholders {{field}}
  for (const [key, value] of Object.entries(fields)) {
    template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  
  return template;
}

/**
 * Process a batch of posts for content generation
 * @param {number} userId - User ID for API key lookup
 * @param {Array} postIds - Array of post IDs to process
 * @returns {Object} Results with success and failure counts
 */
async function processBatch(userId, postIds) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const postId of postIds) {
    try {
      // Get post data
      const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
      
      if (!post) {
        results.failed++;
        results.errors.push({ id: postId, error: 'Post not found' });
        continue;
      }

      // Generate content
      const content = await generateContent(userId, post);

      // Update post with generated content
      db.prepare(`
        UPDATE posts SET
          variant_1 = ?,
          variant_2 = ?,
          variant_3 = ?,
          image_prompt_1 = ?,
          image_prompt_2 = ?,
          image_prompt_3 = ?,
          status = 'generated',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        content.variant_1,
        content.variant_2,
        content.variant_3,
        content.image_prompt_1,
        content.image_prompt_2,
        content.image_prompt_3,
        postId
      );

      results.success++;

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      results.failed++;
      results.errors.push({ id: postId, error: error.message });
      
      // Update post status to indicate failure
      db.prepare(`
        UPDATE posts SET status = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(postId);
    }
  }

  return results;
}

/**
 * Get the image style prompt for a user (custom or default)
 */
function getImageStylePrompt(userId) {
  return getPromptValue(userId, 'image_style_prompt') || DEFAULT_IMAGE_STYLE_PROMPT;
}

module.exports = {
  generateContent,
  processBatch,
  getSystemPrompt,
  getImageStylePrompt,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_IMAGE_STYLE_PROMPT
};
