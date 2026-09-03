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
    if (stored && typeof stored.accessToken === 'string') {
      this.tokens = {
        accessToken: stored.accessToken,
        refreshToken: typeof stored.refreshToken === 'string' ? stored.refreshToken : undefined,
        expiresAt: typeof stored.expiresAt === 'number' ? stored.expiresAt : 0,
      };
      this.user = (stored.user as User) || null;
      if (this.tokens.expiresAt && this.tokens.expiresAt <= Date.now()) {
        this.tokens = null;
        this.user = null;
        clearStoredTokens('google');
      }
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
        callback: async (tokenResponse: { access_token?: string; error?: string; expires_in?: number }) => {
          try {
            if (tokenResponse.error || !tokenResponse.access_token) {
              reject(new Error(tokenResponse.error || 'No access token received'));
              return;
            }

            const user = await this.fetchUserInfo(tokenResponse.access_token);

            // Set token expiration (default to 1 hour if not provided)
            const expiresIn = tokenResponse.expires_in || 3600;
            const expiresAt = Date.now() + (expiresIn * 1000);

            this.tokens = {
              accessToken: tokenResponse.access_token,
              expiresAt: expiresAt,
            };

            this.user = { ...user, provider: 'google' };
            storeTokens('google', { ...this.tokens, user: this.user });
            resolve(this.user);
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        },
        error_callback: (error: { type?: string; message?: string }) => {
          const isBlocked = error.type === 'popup_blocked_by_browser' || error.message?.includes('popup');
          reject(
            new Error(
              isBlocked
                ? 'Google Sign-in popup was blocked by Firefox/browser. Please enable popups for this site and try again.'
                : error.message || error.type || 'Google OAuth error'
            )
          );
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
