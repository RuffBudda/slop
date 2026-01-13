<div align="center">

# 🚀 SLOP

### **S**ocial **L**inkedIn **O**ptimization **P**latform

**AI-Powered LinkedIn Content Creation & Automation**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Status-Active-success.svg)](https://github.com/RuffBudda/slop)

---

</div>

## 📖 Overview

SLOP is an intelligent content automation platform designed to streamline LinkedIn post creation. It leverages AI to generate multiple post variants and custom images, helping you maintain a consistent, engaging presence on LinkedIn with minimal effort.

### Key Features

✨ **AI Content Generation**
- Generate multiple post variants using OpenAI GPT
- Fully customizable prompts and templates
- British English voice with founder-focused tone

🎨 **AI Image Generation**
- Create custom images with Stability AI
- Multiple models supported (SD3, Stable Diffusion XL)
- Configurable aspect ratios, styles, and negative prompts

📁 **Google Drive Integration**
- Browse and select images from specific Google Drive folders
- Upload generated images directly to Drive
- OAuth and Service Account authentication support

📅 **Content Management**
- Visual calendar with drag-and-drop scheduling
- Spreadsheet-like interface for bulk operations
- Review, edit, approve, or reject generated content

👥 **Multi-User Support**
- Admin and user roles
- Secure authentication and session management
- User-specific settings and preferences

🌱 **Environmental Tracking**
- Monitor AI usage and environmental impact
- Calculate CO2 emissions and energy consumption
- Track your carbon footprint

📋 **Content Organization**
- Identification field for post references
- File import for templates and samples
- Tile-based settings navigation
- Password visibility toggles

---

## 🎯 What Makes SLOP Special?

- **No Code Required**: Fully web-based interface, no technical knowledge needed
- **Fully Configurable**: All AI prompts and settings editable through the UI
- **Privacy First**: API keys stored encrypted, runs on your infrastructure
- **Standalone**: Self-contained application, no external dependencies
- **Production Ready**: Includes deployment guides and scripts

---

### Prerequisites

- **Node.js** 18 or higher
- **npm** or **yarn**
- API Keys (can be configured later):
  - OpenAI API Key
  - Stability AI API Key

## 🚀 Quick Start

<details>
<summary><b>📦 Installation</b> (Click to expand)</summary>

### Step 1: Clone the Repository

```bash
git clone https://github.com/RuffBudda/slop.git
cd slop
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

```bash
cp env.example.txt .env
```

Edit `.env` with your settings (see [Configuration](#-configuration) below)

### Step 4: Initialize Database

```bash
npm run migrate
```

### Step 5: Start the Server

#### Development Mode (with auto-reload)

```bash
npm run dev
```

#### Production Mode with PM2

For production deployments, use PM2 to manage the process:

1. **Install PM2 globally** (if not already installed)
   ```bash
   npm install -g pm2
   ```

2. **Start the application with PM2**
   ```bash
   pm2 start src/server.js --name slop
   ```

3. **Configure PM2 to start on system boot**
   ```bash
   pm2 startup
   pm2 save
   ```

4. **Useful PM2 commands**
   ```bash
   # View logs
   pm2 logs slop
   
   # Monitor status
   pm2 status
   
   # Restart application
   pm2 restart slop
   
   # Stop application
   pm2 stop slop
   
   # View detailed info
   pm2 info slop
   ```

#### Alternative: Standard Node.js Start

```bash
npm start
```

### Step 6: Access the Application

Open `http://localhost:3000` in your browser and create your admin account.

</details>

### Configuration

#### Environment Variables

Create a `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-random-string-at-least-32-characters

# Database
DATABASE_PATH=./data/slop.db

# API Keys (can also be set in UI)
OPENAI_API_KEY=sk-your-openai-api-key
STABILITY_API_KEY=sk-your-stability-api-key

# Google Drive OAuth (optional - can also be configured in UI)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-drive/callback
```

> **Note**: API keys can be configured either via environment variables or through the Settings UI after logging in.

#### Google Drive Setup

1. Create a [Google Cloud Project](https://console.cloud.google.com/)
2. Enable the Google Drive API
3. Create OAuth 2.0 credentials or a Service Account
4. Configure credentials via Settings UI (recommended) or add to `.env`

## 🔧 Advanced Configuration

### AI Prompts

All AI prompts are fully customizable in the Settings tab:

- **System Prompt**: Defines AI behavior, voice, and content structure
- **User Prompt Template**: Template with placeholders (`{{instruction}}`, `{{type}}`, etc.)
- **Image Style Prefix/Suffix**: Style modifiers for image generation

### Stability AI Settings

Configure image generation options:

- **Aspect Ratio**: 1:1, 16:9, 9:16, 4:3, 3:4
- **Model**: SD3 Large Turbo, SD3, Stable Diffusion XL
- **Output Format**: PNG or JPEG
- **Negative Prompt**: Elements to avoid
- **Advanced**: Seed, Steps, CFG Scale

### Google Drive Folder Selection

Select a specific Google Drive folder to use for images:

1. Go to **Settings** → **Google Drive Integration**
2. Enter folder link or use **Browse** to navigate
3. Only images from the selected folder will be available

## 🏗️ Project Structure

```
slop/
├── src/
│   ├── database/       # Database config & migrations
│   ├── middleware/      # Express middleware
│   ├── routes/         # API route handlers
│   ├── services/       # Business logic
│   └── server.js       # Express server
├── public/             # Frontend files
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript modules
│   └── index.html      # Main HTML
├── data/               # SQLite database
├── .env                # Environment config
├── package.json        # Dependencies
└── README.md           # This file
```

## 📚 Usage Guide

### Setting Up Post Types

Post types are crucial for generating high-quality content. Each post type defines the **lens** through which the AI thinks about the content, not just the topic.

#### Understanding Post Types

**Type = LENS (Critical)**

The Type field defines how the post thinks, not what it talks about. Examples:

- **Founder Reality** → lived tension, trade-offs, scars, real experiences
- **Leadership** → decisions, responsibility, restraint, leading teams
- **Sustainability** → systems, consequences, economics, long-term impact
- **Scaling** → sequencing, pressure points, second-order effects
- **Operations** → friction, process, repetition, day-to-day execution
- **Strategy** → choices, exclusion, focus, strategic thinking
- **Economics / TCO** → cost analysis, financial models, value propositions

#### Post Type Setup Guidelines

1. **Be Specific**: Use descriptive types that capture the thinking mode
   - ✅ Good: "Founder Reality", "Scaling Challenges", "Operational Efficiency"
   - ❌ Bad: "Post", "Content", "Update"

2. **Match Your Voice**: The Type should align with how you want to think about the topic
   - If discussing a mistake → Use "Founder Reality" or "Lessons Learned"
   - If discussing growth → Use "Scaling" or "Strategy"
   - If discussing processes → Use "Operations"

3. **Consistency**: Use the same Type names across similar posts to maintain consistency

4. **Purpose Alignment**: Ensure Type and Purpose work together
   - Type = How you think about it
   - Purpose = Why you're writing it (Clarity, Challenge, Education, etc.)

### Creating Content

1. Navigate to **Settings** → **Content Management**
2. Click **Add New Post**
3. Fill in:
   - **Identification**: Optional identifier or reference for the post
   - **Instruction**: Main content directive (what you want to create)
   - **Type**: Post category/lens (see Post Type Setup above)
   - **Template**: Structural flow (e.g., "Hook → Context → Insight → Question")
   - **Purpose**: Intent (Clarity, Challenge, Education, Perspective, etc.)
   - **Sample**: Style reference (for pacing, warmth, rhythm - not to copy)
   - **Keywords**: Relevant keywords to include naturally

#### Template Field Tips

- Use arrow notation: `Hook → Story → Insight → CTA`
- Keep it simple and clear
- You can import templates from `.txt` files using the 📄 Import button

#### Sample Field Tips

- The Sample is used ONLY for pacing, warmth, and rhythm
- Never copy structure verbatim from the sample
- Use it as a subtle influence, not a template to mirror

### Generating Content

1. Posts with "Pending" status are ready for generation
2. Go to **Content** tab
3. Click **Generate Content**
4. System generates 3 variants + 3 images per post

### Reviewing & Scheduling

1. **Review** generated variants and images in the Content tab
2. **Select** your preferred variant and image
3. **Edit** text if needed
4. **Set** schedule date/time
5. **Approve** or **Reject** the post

### Keyboard Shortcuts

- `Alt + 1-5`: Switch between tabs
- `1, 2, 3`: Select variant
- `A`: Approve post
- `R`: Reject post
- `E`: Edit selected variant
- `↑/↓`: Navigate between cards

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

This enables auto-reload on file changes using `nodemon`.

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

## 🚢 Deployment

### Automated Deployment Script

For new server deployments, use the provided deployment script:

```bash
# 1. Point your domain to the server IP
# 2. SSH into your server
# 3. Clone the repository
git clone https://github.com/RuffBudda/slop.git /opt/slop
cd /opt/slop

# 4. Run the deployment script
sudo chmod +x deploy.sh
sudo ./deploy.sh yourdomain.com
```

The script will:
- Update the server packages
- Install Node.js, Nginx, PM2, and Certbot
- Clone the repository (if not already cloned)
- Install dependencies
- Set up environment variables
- Initialize the database
- Configure Nginx with your domain
- Start the application with PM2
- Set up SSL certificate with Let's Encrypt (optional)

**Prerequisites:**
- Ubuntu/Debian server
- Domain name pointing to server IP
- Root/sudo access

**After deployment:**
1. Edit `/opt/slop/.env` and add your API keys
2. Restart: `pm2 restart slop`
3. Access the application and create your admin account

**Useful commands:**
- View logs: `pm2 logs slop`
- Restart: `pm2 restart slop`
- Stop: `pm2 stop slop`
- Status: `pm2 status`

### Manual Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed manual deployment instructions on Ubuntu servers.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `SESSION_SECRET` | Session encryption key | Yes |
| `DATABASE_PATH` | SQLite database path | No |
| `OPENAI_API_KEY` | OpenAI API key | No* |
| `STABILITY_API_KEY` | Stability AI key | No* |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | No* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | No* |
| `GOOGLE_REDIRECT_URI` | Google OAuth Redirect URI | No* |

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

## 🐛 Troubleshooting

### Database Errors

```bash
rm -rf data/slop.db*
npm run migrate
```

### Port Already in Use

Change port in `.env`:
```env
PORT=3001
```

### API Key Issues

1. Check keys in Settings UI
2. Use "Test" buttons to verify connectivity
3. Check API quotas and billing

### Google Drive Connection Issues

1. Verify OAuth credentials in `.env`
2. Check redirect URI matches exactly
3. Ensure Google Drive API is enabled
4. Try Service Account method instead

---

## 📄 License

This software is **proprietary** and confidential. All rights reserved.

**NOTICE**: This Software is NOT open source. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited.

This software is owned by **Contractors Direct**. For licensing inquiries or permissions, please contact:

- **Email**: abu@contractors.direct
- **Website**: https://contractors.direct

See [LICENSE](LICENSE) file for full terms and conditions.

---

<div align="center">

**Proprietary Software by [Contractors Direct](https://contractors.direct)**

For inquiries: **abu@contractors.direct**

</div>
