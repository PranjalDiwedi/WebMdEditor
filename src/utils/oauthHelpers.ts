import { encryptTokenObject, decryptTokenObject, looksLikePlaintextAccessToken } from './tokenEncryption';
import { generateSecureState } from './cryptoUtils';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TOKEN_STORAGE = sessionStorage;

function tokenKey(provider: string): string {
  return `md_editor_${provider}_tokens`;
}

function stateKey(provider: string): string {
  return `md_editor_${provider}_oauth_state`;
}

export function generateState(): string {
  return generateSecureState();
}

/** Store OAuth state with timestamp for replay protection. */
export function storeOAuthState(provider: string, state: string): void {
  sessionStorage.setItem(
    stateKey(provider),
    JSON.stringify({ state, createdAt: Date.now() })
  );
}

/**
 * Validate OAuth state and enforce TTL.
 * Clears stored state after check (one-time use).
 */
export function consumeOAuthState(provider: string, receivedState: string): boolean {
  const raw = sessionStorage.getItem(stateKey(provider));
  sessionStorage.removeItem(stateKey(provider));

  if (!raw || !receivedState) {
    return false;
  }

  try {
    const parsed = JSON.parse(raw) as { state?: string; createdAt?: number };
    if (!parsed.state || typeof parsed.createdAt !== 'number') {
      return false;
    }
    if (Date.now() - parsed.createdAt > STATE_TTL_MS) {
      return false;
    }
    return parsed.state === receivedState;
  } catch {
    return false;
  }
}

/** @deprecated Prefer consumeOAuthState for redirect flows */
export function validateState(receivedState: string, originalState: string): boolean {
  return receivedState === originalState && receivedState.length > 0;
}

export function parseTokenFromUrl(): string | null {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

export function parseCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

export function clearAuthParams(): void {
  window.history.replaceState({}, document.title, window.location.pathname);
}

export function storeTokens(provider: string, tokens: Record<string, unknown>): void {
  const key = tokenKey(provider);
  try {
    const encryptedTokens = encryptTokenObject(tokens);
    TOKEN_STORAGE.setItem(key, JSON.stringify(encryptedTokens));
    // Remove any legacy localStorage copy
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to store encrypted tokens:', error);
    throw new Error('Failed to securely store tokens');
  }
}

export function getStoredTokens(provider: string): Record<string, unknown> | null {
  const key = tokenKey(provider);

  // Prefer sessionStorage; migrate-clear legacy localStorage
  let stored = TOKEN_STORAGE.getItem(key);
  const legacy = localStorage.getItem(key);
  if (!stored && legacy) {
    // Clear plaintext/legacy localStorage tokens — force re-auth
    localStorage.removeItem(key);
    return null;
  }

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>;

    if (looksLikePlaintextAccessToken(parsed.accessToken)) {
      clearStoredTokens(provider);
      return null;
    }

    return decryptTokenObject(parsed);
  } catch (error) {
    console.error('Failed to decrypt stored tokens:', error);
    clearStoredTokens(provider);
    return null;
  }
}

export function clearStoredTokens(provider: string): void {
  const key = tokenKey(provider);
  TOKEN_STORAGE.removeItem(key);
  localStorage.removeItem(key);
}
