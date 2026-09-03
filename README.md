# Mandrak 🏔️

**Mandrak** (*Mountain of Knowledge*) is a fast, distraction-free, local-first Markdown editor with native file system access and seamless cloud sync (Google Drive, Dropbox, OneDrive). 100% private, client-side, and designed for focused writing.

## Features

- **Multiple Storage Providers**: Google Drive, Dropbox, OneDrive, and local file system
- **Markdown Editing**: Rich markdown editing with TipTap editor
- **Mac Notes-Inspired UI**: Clean, modern interface similar to Mac Notes
- **Real-time Preview**: Live markdown preview as you type
- **File Management**: Create, edit, delete, and search markdown files
- **Secure Authentication**: OAuth-based authentication with Google
- **Auto-save**: Automatic saving with manual save option
- **Dark/Light Mode**: Theme support for comfortable editing
- **100% Free**: Built using only free and open-source libraries

## Tech Stack

- **Frontend**: React + TypeScript
- **Build Tool**: Vite
- **Editor**: TipTap (free and open-source)
- **Authentication**: Direct OAuth implementation
- **Storage**: Provider-specific SDKs (Google API Client, Dropbox SDK, Microsoft Graph SDK)
- **File System**: Browser File System Access API

## Prerequisites

Before running the application, you need to set up OAuth credentials for each storage provider you want to use.

### Google Drive Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API" and enable it
4. Configure the OAuth consent screen (External) if prompted
5. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: **Web application**
   - **Authorized JavaScript origins**: `http://localhost:5173`
   - **Authorized redirect URIs**: `http://localhost:5173` (required by Google Cloud Console; sign-in uses GIS popup, not redirects)
   - Replace with your production origin when deploying
6. Copy the Client ID (and create an API key if you use Google Drive)
7. Add them to your `.env` file:
   ```
   VITE_GOOGLE_CLIENT_ID=your_client_id
   VITE_GOOGLE_API_KEY=your_api_key
   ```
8. Restart the Vite dev server after changing `.env`

### Dropbox Setup

1. Go to [Dropbox Developers](https://www.dropbox.com/developers)
2. Create a new app:
   - App type: "Scoped API"
   - App name: Your choice
   - Permission type: "Full Dropbox" or "App folder"
3. Configure OAuth 2.0:
   - Redirect URI: `http://localhost:5173/auth/callback/dropbox`
4. Copy the App Key (Client ID)
5. Add to your `.env` file:
   ```
   VITE_DROPBOX_CLIENT_ID=your_dropbox_client_id
   ```

### OneDrive Setup

1. Go to [Microsoft Azure Portal](https://portal.azure.com/)
2. Register a new application:
   - Navigate to "Microsoft identity platform" > "App registrations"
   - Click "New registration"
   - Name: Your choice
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: `http://localhost:5173/auth/callback/onedrive`
3. Configure API permissions:
   - Go to "API permissions" > "Add a permission"
   - Select "Microsoft Graph" > "Delegated permissions"
   - Add: `Files.Read`, `Files.ReadWrite`
4. Copy the Application (client) ID
5. Add to your `.env` file:
   ```
   VITE_ONEDRIVE_CLIENT_ID=your_onedrive_client_id
   ```

## Installation

1. Clone the repository and navigate to the project directory
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your OAuth credentials

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Usage

1. **Sign In**: Click "Sign in with Google" to authenticate
2. **Select Storage Provider**: Choose from Google Drive (default), Dropbox, OneDrive, or Local Files
3. **Create/Edit Files**: 
   - Click the "+" button to create a new markdown file
   - Click on existing files to open them
   - Use the editor toolbar for formatting options
4. **Save Files**: Files auto-save, or use Cmd/Ctrl+S to save manually
5. **Search**: Use the search bar to filter files by name or content

## File Structure

```
src/
├── auth/              # Authentication components and logic
├── components/        # Reusable UI components
├── config/           # Application configuration
├── editor/           # TipTap editor components
├── files/            # File management logic
├── layout/           # Layout components
├── storage/          # Storage provider implementations
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
├── App.tsx           # Main application component
├── App.css           # Application styles
├── main.tsx          # Application entry point
└── index.css         # Global styles
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run linter

### Adding New Storage Providers

1. Create a new provider class extending `StorageProvider`
2. Implement all required methods
3. Add the provider to `ProviderSelector.tsx`
4. Add OAuth configuration to `constants.ts`

## Browser Compatibility

- Chrome/Edge: Full support (including File System Access API)
- Firefox: Good support (File System Access API limited)
- Safari: Good support (File System Access API limited)

## Security Notes

- OAuth tokens are stored in localStorage
- In production, consider using httpOnly cookies for token storage
- Always use HTTPS in production
- Never commit `.env` files to version control

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.