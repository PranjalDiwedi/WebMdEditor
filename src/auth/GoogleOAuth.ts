import type { User, AuthTokens } from '../types/auth';
import { OAUTH_CONFIGS } from '../config/constants';
import {
  storeTokens,
  getStoredTokens,
  clearStoredTokens
} from '../utils/oauthHelpers';
import { loadGisClient } from '../utils/googleScripts';

const AUTH_SCOPES = [
  'openid',
  'email',
  'profile',
].join(' ');

export class GoogleOAuth {
  private static instance: GoogleOAuth;
  private tokens: AuthTokens | null = null;
  private user: User | null = null;
  private tokenClient: any = null;

  private constructor() {
    this.loadStoredTokens();
  }

  static getInstance(): GoogleOAuth {
    if (!GoogleOAuth.instance) {
      GoogleOAuth.instance = new GoogleOAuth();
    }
    return GoogleOAuth.instance;
  }

  private loadStoredTokens(): void {
    const stored = getStoredTokens('google');
    if (stored) {
      this.tokens = stored;
      this.user = stored.user;
    }
  }

  async signIn(): Promise<User> {
    const clientId = OAUTH_CONFIGS.google.clientId;
    if (!clientId) {
      throw new Error(
        'Missing VITE_GOOGLE_CLIENT_ID. Copy .env.example to .env and add your Google OAuth client ID.'
      );
    }

    await loadGisClient();

    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services failed to initialize');
    }

    return new Promise((resolve, reject) => {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: AUTH_SCOPES,
        callback: async (tokenResponse: { access_token?: string; error?: string }) => {
          try {
            if (tokenResponse.error || !tokenResponse.access_token) {
              reject(new Error(tokenResponse.error || 'No access token received'));
              return;
            }

            const user = await this.fetchUserInfo(tokenResponse.access_token);

            this.tokens = {
              accessToken: tokenResponse.access_token,
              expiresAt: Date.now() + 3600 * 1000,
            };

            this.user = { ...user, provider: 'google' };
            storeTokens('google', { ...this.tokens, user: this.user });
            resolve(this.user);
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        },
        error_callback: (error: { type?: string; message?: string }) => {
          reject(new Error(error.message || error.type || 'Google OAuth error'));
        },
      });

      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  /** @deprecated Implicit redirect callback is no longer used. Kept for compatibility. */
  async handleCallback(): Promise<User> {
    if (this.user && this.isAuthenticated()) {
      return this.user;
    }
    throw new Error('No pending Google OAuth callback');
  }

  private async fetchUserInfo(accessToken: string): Promise<Omit<User, 'provider'>> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      avatar: data.picture,
    };
  }

  async signOut(): Promise<void> {
    const token = this.tokens?.accessToken;
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token);
    }
    this.tokens = null;
    this.user = null;
    clearStoredTokens('google');
  }

  getCurrentUser(): User | null {
    return this.user;
  }

  getAccessToken(): string | null {
    return this.tokens?.accessToken || null;
  }

  isAuthenticated(): boolean {
    return this.tokens !== null && this.tokens.expiresAt > Date.now();
  }

  isPending(): boolean {
    return false;
  }
}
