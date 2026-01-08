# SLOP - LinkedIn Content Automizer (Standalone Edition)

SLOP is a standalone application for automating LinkedIn content creation using AI. It generates post variants and images based on your instructions, allowing you to review, edit, and schedule content.

## Features

- **AI Content Generation**: Uses OpenAI GPT to generate multiple post variants
- **AI Image Generation**: Uses Stability AI to create custom images for posts
- **Fully Configurable Prompts**: All system prompts and AI settings are editable in the UI
- **Stability AI Options**: Configure aspect ratio, model, output format, negative prompts, and more
- **Google Drive Integration**: Browse and upload images directly from Google Drive
- **Content Management**: Review, edit, approve, or reject generated content
- **Calendar View**: Visual calendar for scheduled posts with drag-and-drop
- **Sheet Interface**: Spreadsheet-like interface for bulk content management
- **User Management**: Multi-user support with admin and user roles
- **Environmental Calculator**: Track the environmental impact of AI usage

## Prerequisites

- Node.js 18+ 
- npm or yarn
- API Keys:
  - OpenAI API Key
  - Stability AI API Key
  - DigitalOcean Spaces credentials (for image storage)

## Quick Start

### 1. Clone and Install

```bash
cd standalone
npm install
```

### 2. Configure Environment

```bash
cp env.example.txt .env
```

Edit `.env` with your settings:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-random-string-at-least-32-characters

# Database
DATABASE_PATH=./data/slop.db

# API Keys (can also be set in the UI)
OPENAI_API_KEY=sk-your-openai-api-key
STABILITY_API_KEY=sk-your-stability-api-key

# DigitalOcean Spaces
SPACES_NAME=your-space-name
SPACES_REGION=blr1
SPACES_KEY=your-access-key
SPACES_SECRET=your-secret-key

# Google Drive OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-drive/callback
```

### 3. Run Database Migration

```bash
npm run migrate
```

### 4. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### 5. Access the Application

Open `http://localhost:3000` in your browser.

On first launch, you'll be prompted to create an admin account.

## API Keys Setup

API keys can be configured in two ways:

1. **Environment Variables** (`.env` file) - Set during deployment
2. **Settings Panel** (UI) - Set after login via Settings tab

## Configuration Features

### AI Prompts Configuration

All AI prompts are fully configurable in the Settings tab:

- **System Prompt**: The main prompt that defines AI behavior, voice, and content structure
- **User Prompt Template**: Template for building user prompts from post data (supports placeholders like `{{instruction}}`, `{{type}}`, etc.)
- **Image Style Prefix/Suffix**: Style modifiers for image generation prompts

### Stability AI Image Options

Configure all Stability AI image generation settings:

- **Aspect Ratio**: Choose from 1:1, 16:9, 9:16, 4:3, 3:4
- **Model**: Select from SD3 Large Turbo, SD3, or Stable Diffusion XL
- **Output Format**: PNG or JPEG
- **Negative Prompt**: Elements to avoid in generated images
- **Advanced Options**: Seed, Steps, CFG Scale (optional)

### Google Drive Integration

Connect your Google Drive account to:

- Browse images from your Drive
- Upload generated images to Drive
- Access your image library directly from the app

To set up Google Drive:

1. Create a Google Cloud Project and enable Google Drive API
2. Create OAuth 2.0 credentials
3. Add the credentials to your `.env` file
4. Connect via Settings → Google Drive Integration

## Project Structure

```
standalone/
├── data/                 # SQLite database files
├── public/               # Frontend files
│   ├── css/             # Stylesheets
│   ├── js/              # JavaScript modules
│   └── index.html       # Main HTML file
├── src/
│   ├── database/        # Database configuration and migrations
│   ├── middleware/      # Express middleware (auth, etc.)
│   ├── routes/          # API route handlers
│   └── services/        # Business logic services
├── .env                 # Environment configuration
├── package.json         # Dependencies
└── README.md            # This file
```

## Usage Guide

### Creating Content

1. Go to **Settings** → **Content Management**
2. Click **Add New Post**
3. Fill in the content instruction and optional fields
4. Save the post

### Generating Content

1. Posts with "Pending" status are ready for generation
2. Click **Generate Content** in the Content tab
3. The system will generate 3 variants + 3 images per post

### Reviewing Content

1. In the **Content** tab, review each generated post
2. Click on a variant to select it
3. Click on an image to select it
4. Use **Edit** to modify variant text
5. Set a schedule date/time
6. Click **Approve** or **Reject**

### Keyboard Shortcuts

- `Alt + 1-5`: Switch tabs
- `1, 2, 3`: Select variant
- `A`: Approve post
- `R`: Reject post
- `E`: Edit selected variant
- `↑/↓`: Navigate between cards

## Development

### Running in Development Mode

```bash
npm run dev
```

This enables auto-reload on file changes.

### Database

The application uses SQLite with the following tables:

- `users` - User accounts
- `posts` - Content posts
- `settings` - User settings (API keys stored encrypted)
- `workflow_sessions` - Generation session tracking

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/setup` | Initial admin setup |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/posts` | List posts |
| POST | `/api/posts` | Create post |
| PUT | `/api/posts/:id` | Update post |
| DELETE | `/api/posts/:id` | Delete post |
| POST | `/api/workflow/generate` | Start content generation |
| GET | `/api/workflow/status` | Get generation status |
| GET | `/api/settings` | Get settings |
| POST | `/api/settings` | Save settings |

## Production Deployment

See `DEPLOYMENT.md` for detailed deployment instructions.

### Quick Deploy to DigitalOcean

1. Create an Ubuntu droplet
2. SSH into the server
3. Run the deployment script:

```bash
curl -sSL https://raw.githubusercontent.com/your-repo/slop/main/deploy.sh | bash
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `SESSION_SECRET` | Session encryption key | Yes |
| `DATABASE_PATH` | SQLite database path | No |
| `OPENAI_API_KEY` | OpenAI API key | No* |
| `STABILITY_API_KEY` | Stability AI key | No* |
| `SPACES_NAME` | DO Spaces bucket name | No* |
| `SPACES_REGION` | DO Spaces region | No* |
| `SPACES_KEY` | DO Spaces access key | No* |
| `SPACES_SECRET` | DO Spaces secret key | No* |

*Can be configured via Settings UI instead

## Troubleshooting

### Database Errors

Reset the database:
```bash
rm -rf data/slop.db
npm run migrate
```

### Port Already in Use

Change the port in `.env`:
```env
PORT=3001
```

### API Key Issues

1. Check keys are correctly set in Settings
2. Use the "Test" buttons to verify connectivity
3. Check API quotas and billing

## License

MIT License - See LICENSE file for details.

## Support

For issues and feature requests, please create an issue on GitHub.
