export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'google' | 'dropbox' | 'onedrive' | 'local';
  avatar?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  apiKey?: string;
}