export const APP_NAME = 'MarkLoom';

export const SUPPORTED_FILE_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd'];

export const OAUTH_CONFIGS = {
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/auth/callback/google`,
    scopes: [
      // Full Drive access so existing .md files can be listed and edited.
      // Add yourself as a Test user on the OAuth consent screen while the app is in Testing.
      'https://www.googleapis.com/auth/drive'
    ],
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY || ''
  },
  dropbox: {
    clientId: import.meta.env.VITE_DROPBOX_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/auth/callback/dropbox`,
    scopes: ['files.content.read', 'files.content.write']
  },
  onedrive: {
    clientId: import.meta.env.VITE_ONEDRIVE_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/auth/callback/onedrive`,
    scopes: ['Files.Read', 'Files.ReadWrite']
  }
};

export const STORAGE_KEYS = {
  AUTH_TOKENS: 'md_editor_auth_tokens',
  USER_INFO: 'md_editor_user_info',
  RECENT_FILES: 'md_editor_recent_files',
  THEME: 'md_editor_theme',
  ACTIVE_PROVIDER: 'md_editor_active_provider'
};

export const EDITOR_CONFIG = {
  placeholder: 'Start writing your markdown...',
  autoSaveDelay: 2000, // 2 seconds
  maxFileSize: 10 * 1024 * 1024, // 10MB
  wordCountUpdateInterval: 500
};

export const THEME = {
  light: {
    background: '#ffffff',
    surface: '#f5f5f7',
    text: '#1d1d1f',
    textSecondary: '#86868b',
    border: '#d2d2d7',
    accent: '#0071e3',
    danger: '#ff3b30',
    success: '#34c759'
  },
  dark: {
    background: '#1c1c1e',
    surface: '#2c2c2e',
    text: '#f5f5f7',
    textSecondary: '#86868b',
    border: '#3a3a3c',
    accent: '#0a84ff',
    danger: '#ff453a',
    success: '#30d158'
  }
};