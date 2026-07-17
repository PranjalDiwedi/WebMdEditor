export function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export function validateState(receivedState: string, originalState: string): boolean {
  return receivedState === originalState;
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

export function storeTokens(provider: string, tokens: any): void {
  const key = `md_editor_${provider}_tokens`;
  localStorage.setItem(key, JSON.stringify(tokens));
}

export function getStoredTokens(provider: string): any | null {
  const key = `md_editor_${provider}_tokens`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
}

export function clearStoredTokens(provider: string): void {
  const key = `md_editor_${provider}_tokens`;
  localStorage.removeItem(key);
}