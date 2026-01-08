<div align="center">

# 🚀 SLOP

### **S**ocial **L**inkedIn **O**ptimization **P**latform

**AI-Powered LinkedIn Content Creation & Automation**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
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
  - DigitalOcean Spaces credentials (optional, for image storage)

## 🚀 Quick Start

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/RuffBudda/slop.git
   cd slop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example.txt .env
   ```
   
   Edit `.env` with your settings (see [Configuration](#-configuration) below)

4. **Initialize database**
   ```bash
   npm run migrate
   ```

5. **Start the server**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   
   Open `http://localhost:3000` in your browser and create your admin account.

## ⚙️ Configuration

### Environment Variables

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

# DigitalOcean Spaces (for image storage)
SPACES_NAME=your-space-name
SPACES_REGION=blr1
SPACES_KEY=your-access-key
SPACES_SECRET=your-secret-key

# Google Drive OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-drive/callback
```

> **Note**: API keys can be configured either via environment variables or through the Settings UI after logging in.

### Google Drive Setup

1. Create a [Google Cloud Project](https://console.cloud.google.com/)
2. Enable the Google Drive API
3. Create OAuth 2.0 credentials or a Service Account
4. Add credentials to `.env` or configure via Settings UI

For detailed setup instructions, see [DIGITALOCEAN-SETUP.md](DIGITALOCEAN-SETUP.md)

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

### Creating Content

1. Navigate to **Settings** → **Content Management**
2. Click **Add New Post**
3. Fill in:
   - **Instruction**: Main content directive
   - **Type**: Post category (e.g., Founder Reflection, Industry Commentary)
   - **Template**: Structural flow (Hook → Context → Insight → Question)
   - **Purpose**: Intent (Clarity, Challenge, Education, etc.)
   - **Sample**: Style reference
   - **Keywords**: Relevant keywords to include

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

### DigitalOcean Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

**Quick Deploy:**

```bash
# On your Ubuntu server
curl -sSL https://raw.githubusercontent.com/RuffBudda/slop/main/deploy.sh | bash
```

### Docker (Coming Soon)

Docker support is planned for future releases.

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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [OpenAI GPT](https://openai.com/)
- Image generation powered by [Stability AI](https://stability.ai/)
- Storage via [DigitalOcean Spaces](https://www.digitalocean.com/products/spaces)

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/RuffBudda/slop/issues)
- **Discussions**: [GitHub Discussions](https://github.com/RuffBudda/slop/discussions)

---

<div align="center">

**Made with ❤️ by [RuffBudda](https://github.com/RuffBudda)**

[⭐ Star this repo](https://github.com/RuffBudda/slop) | [🐛 Report Bug](https://github.com/RuffBudda/slop/issues) | [💡 Request Feature](https://github.com/RuffBudda/slop/issues)

</div>
