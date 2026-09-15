/**
 * Keyboard shortcuts utilities and platform-aware key symbol helpers.
 */

export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');

export const modSymbol = isMac ? '⌘' : 'Ctrl';
export const altSymbol = isMac ? '⌥' : 'Alt';
export const shiftSymbol = isMac ? '⇧' : 'Shift';

/**
 * Returns formatted shortcut string matching the current operating system.
 * e.g. formatShortcut('⌘S', 'Ctrl+S') -> '⌘S' on Mac, 'Ctrl+S' on Windows/Linux
 */
export function formatShortcut(macShortcut: string, winShortcut?: string): string {
  if (isMac) return macShortcut;
  return winShortcut || macShortcut.replace(/⌘/g, 'Ctrl+').replace(/⌥/g, 'Alt+').replace(/⇧/g, 'Shift+');
}

/**
 * Focuses and selects all text in the primary search input if present in the DOM.
 */
export function focusSearchInput(): boolean {
  const searchInput = document.getElementById('mandrak-search-input') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.focus();
    searchInput.select();
    return true;
  }
  return false;
}
