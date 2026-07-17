import CryptoJS from 'crypto-js';

const SESSION_KEY_STORAGE = 'md_editor_encryption_key';
const ENV_KEY = import.meta.env.VITE_ENCRYPTION_KEY as string | undefined;

/**
 * Resolve the AES key used for token at-rest encryption.
 * Prefer VITE_ENCRYPTION_KEY; otherwise use a per-browser key in sessionStorage.
 * Never fall back to a hardcoded production default.
 */
function resolveSecretKey(): string {
  if (ENV_KEY && ENV_KEY !== 'your_encryption_key_here_generate_a_strong_random_key') {
    return ENV_KEY;
  }

  if (import.meta.env.PROD && !ENV_KEY) {
    console.warn(
      'VITE_ENCRYPTION_KEY is not set. Using a session-scoped key (tokens will not survive tab close).'
    );
  }

  try {
    const existing = sessionStorage.getItem(SESSION_KEY_STORAGE);
    if (existing) {
      return existing;
    }

    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const generated = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(SESSION_KEY_STORAGE, generated);
    return generated;
  } catch {
    // Last resort for environments without Web Crypto / sessionStorage
    const fallback = `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      sessionStorage.setItem(SESSION_KEY_STORAGE, fallback);
    } catch {
      // ignore
    }
    return fallback;
  }
}

function getSecretKey(): string {
  return resolveSecretKey();
}

/**
 * Heuristic: CryptoJS AES ciphertext typically starts with "U2FsdGVkX1" (Salted__)
 * or is otherwise not a raw Google oauth token (ya29.*).
 */
export function looksLikePlaintextAccessToken(value: unknown): boolean {
  if (typeof value !== 'string' || !value) {
    return false;
  }
  // Google access tokens commonly start with ya29.
  if (value.startsWith('ya29.') || value.startsWith('eyJ')) {
    return true;
  }
  // Not CryptoJS OpenSSL-salted format
  if (!value.startsWith('U2FsdGVkX1') && value.length < 80 && !/[+/=]/.test(value)) {
    return true;
  }
  return false;
}

export function encryptToken(token: string): string {
  try {
    return CryptoJS.AES.encrypt(token, getSecretKey()).toString();
  } catch (error) {
    console.error('Token encryption failed:', error);
    throw new Error('Failed to encrypt token');
  }
}

export function decryptToken(encryptedToken: string): string {
  try {
    if (looksLikePlaintextAccessToken(encryptedToken)) {
      throw new Error('Plaintext token detected');
    }

    const bytes = CryptoJS.AES.decrypt(encryptedToken, getSecretKey());
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
      throw new Error('Token decryption failed - invalid token format');
    }

    return decrypted;
  } catch (error) {
    console.error('Token decryption failed:', error);
    throw new Error('Failed to decrypt token');
  }
}

export function encryptTokenObject(tokens: Record<string, unknown>): Record<string, unknown> {
  try {
    const accessToken = tokens.accessToken;
    if (typeof accessToken !== 'string') {
      throw new Error('Missing accessToken');
    }

    return {
      ...tokens,
      accessToken: encryptToken(accessToken),
      refreshToken:
        typeof tokens.refreshToken === 'string'
          ? encryptToken(tokens.refreshToken)
          : undefined,
      _encrypted: true,
    };
  } catch (error) {
    console.error('Token object encryption failed:', error);
    throw new Error('Failed to encrypt token object');
  }
}

export function decryptTokenObject(
  encryptedTokens: Record<string, unknown>
): Record<string, unknown> {
  try {
    const accessToken = encryptedTokens.accessToken;
    if (typeof accessToken !== 'string') {
      throw new Error('Missing accessToken');
    }

    // Migration: plaintext tokens from older builds must be discarded
    if (looksLikePlaintextAccessToken(accessToken) || encryptedTokens._encrypted !== true) {
      if (looksLikePlaintextAccessToken(accessToken)) {
        throw new Error('Plaintext token storage is no longer supported');
      }
    }

    return {
      ...encryptedTokens,
      accessToken: decryptToken(accessToken),
      refreshToken:
        typeof encryptedTokens.refreshToken === 'string'
          ? decryptToken(encryptedTokens.refreshToken)
          : undefined,
    };
  } catch (error) {
    console.error('Token object decryption failed:', error);
    throw new Error('Failed to decrypt token object');
  }
}

export function isValidEncryptedToken(encryptedToken: string): boolean {
  try {
    decryptToken(encryptedToken);
    return true;
  } catch {
    return false;
  }
}
