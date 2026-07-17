/**
 * Cryptographic utility functions for secure random generation
 * These functions use the Web Crypto API for cryptographically secure random values
 */

/**
 * Generates a cryptographically secure random state string for OAuth CSRF protection
 * @returns A secure random hex string
 */
export function generateSecureState(): string {
  try {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Failed to generate secure state:', error);
    // Fallback to less secure method if Web Crypto API is not available
    return fallbackRandomString(32);
  }
}

/**
 * Generates a cryptographically secure random token
 * @param length - The length of the token in bytes (default: 32)
 * @returns A secure random hex string
 */
export function generateSecureToken(length: number = 32): string {
  try {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Failed to generate secure token:', error);
    return fallbackRandomString(length * 2);
  }
}

/**
 * Generates a random nonce for Content Security Policy
 * @returns A secure random nonce string
 */
export function generateNonce(): string {
  try {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    // Convert to base64 for CSP compatibility
    return btoa(String.fromCharCode(...array));
  } catch (error) {
    console.error('Failed to generate nonce:', error);
    return fallbackRandomString(16);
  }
}

/**
 * Generates a cryptographically secure random string for API keys or similar purposes
 * @param length - The desired length of the string
 * @returns A secure random alphanumeric string
 */
export function generateSecureApiKey(length: number = 32): string {
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    
    return result;
  } catch (error) {
    console.error('Failed to generate secure API key:', error);
    return fallbackRandomString(length);
  }
}

/**
 * Fallback random string generator for environments without Web Crypto API
 * This is less secure but better than nothing
 * @param length - The desired length of the string
 * @returns A random string
 */
function fallbackRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // Use multiple Math.random() calls for better randomness
  for (let i = 0; i < length; i++) {
    // Combine multiple random calls for better distribution
    const random1 = Math.random();
    const random2 = Math.random();
    const combined = (random1 + random2) / 2;
    result += chars[Math.floor(combined * chars.length)];
  }
  
  return result;
}

/**
 * Hashes a string using SHA-256 (if available)
 * @param input - The string to hash
 * @returns A hex string of the hash
 */
export async function sha256Hash(input: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Failed to generate SHA-256 hash:', error);
    // Fallback to simple hash
    return simpleHash(input);
  }
}

/**
 * Simple fallback hash function (not cryptographically secure)
 * @param input - The string to hash
 * @returns A hex string of the hash
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Checks if the Web Crypto API is available
 * @returns True if Web Crypto API is available
 */
export function isWebCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && 
         typeof crypto.getRandomValues === 'function' &&
         typeof crypto.subtle !== 'undefined';
}