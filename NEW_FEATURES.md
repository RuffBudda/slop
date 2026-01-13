# New Features Documentation

## 1. Identification Field

### Overview
A new optional field has been added to post creation and editing forms to allow users to add an identifier or reference for posts.

### Usage
- When creating or editing a post, you'll see a new "Identification" field at the top of the form
- This field is optional and can be used to store any identifier or reference you want
- The field appears in the Content Ideas sheet view

### Database
- Field name: `identification`
- Type: TEXT (nullable)
- Added via automatic migration on server start

## 2. File Import for Template and Sample Fields

### Overview
Users can now import text files directly into the Template and Sample fields instead of manually typing or pasting content.

### Usage
1. Click the "📄 Import" button next to the Template or Sample field
2. Select a `.txt` file from your computer
3. The file content will be automatically loaded into the field
4. You can still manually edit the content after importing

### Supported Formats
- `.txt` files only
- File content is trimmed (leading/trailing whitespace removed)

### Implementation Details
- File reading is done client-side using the File API
- No file upload to server - content is read directly in the browser
- File input is reset after each import

## 3. Settings Page Reorganization

### New Structure
Settings are now organized into logical groups:

1. **Account & Security**
   - Profile Settings
   - Change Password

2. **API & Integrations**
   - API Configuration (OpenAI, Stability AI, DigitalOcean Spaces)
   - Google Drive Integration
   - LinkedIn API Integration

3. **AI Configuration**
   - AI Prompts Configuration
   - Stability AI Image Generation Options

4. **Content Management**
   - Content Ideas (sheet view)

5. **Analytics & Tools**
   - Environmental Impact Calculator

6. **Administration**
   - User Management (Admin only)

### Visual Changes
- Each group has a clear title with bottom border
- Groups are visually separated with spacing
- Easier navigation and finding specific settings

## 4. Removed Preconfigurations

### What Changed
All preconfigured prompts that contained Adam Ridgway's voice and ONE MOTO branding have been removed and replaced with generic templates.

### Affected Prompts
- `content_system_prompt`: Now uses generic professional content creator prompt
- `content_user_template`: Now uses generic template without brand-specific references
- `image_style_prefix`: Simplified to generic professional image prompt
- `image_style_suffix`: Simplified to generic negative prompt

### Impact
- Fresh installations will start with generic prompts
- Users can customize prompts to match their brand voice
- Existing installations with custom prompts are unaffected

### Customization
Users can customize all prompts in Settings → AI Configuration → AI Prompts Configuration.

## 5. Environmental Impact Calculator Enhancement

### What Changed
The calculator now pulls data from scheduled posts count in addition to workflow statistics.

### How It Works
1. First, it attempts to get scheduled posts count via `API.posts.getScheduled()`
2. If scheduled posts exist, it uses that count for calculations
3. Falls back to workflow statistics if no scheduled posts
4. Assumes 3 images per scheduled post for image count calculation

### Benefits
- More accurate representation of planned content generation
- Better tracking of environmental impact for scheduled content
- Combines actual generation stats with planned generation

## Authentication Note

### 401 Error When Adding Posts
If you encounter a 401 Unauthorized error when adding posts:

1. **Check if you're logged in**: Ensure you have an active session
2. **Session expiration**: Sessions expire after 24 hours - try logging out and back in
3. **Browser cookies**: Ensure cookies are enabled and not blocked
4. **HTTPS requirement**: In production, ensure you're using HTTPS (secure cookies require HTTPS)

### Troubleshooting
- Clear browser cookies and log in again
- Check browser console for any CORS or cookie errors
- Verify `SESSION_SECRET` environment variable is set
- Check server logs for authentication errors

## Code Locations

### Backend
- Database migration: `src/database/db.js` (lines 105-117)
- Posts routes: `src/routes/posts.js`
- Settings routes: `src/routes/settings.js` (DEFAULT_PROMPTS)

### Frontend
- Post form: `public/index.html` (postEditModal)
- Settings page: `public/index.html` (settingsView)
- Settings JavaScript: `public/js/settings.js`
- API client: `public/js/api.js`

### Styling
- Settings groups: `public/css/styles.css` (.settings-group, .settings-group-title)
