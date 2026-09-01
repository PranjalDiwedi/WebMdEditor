import { Modal } from './Modal';
import { Button } from './Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

const SHORTCUTS = [
  { key: '⌘S / Ctrl+S', desc: 'Save current note' },
  { key: '⌘P / Ctrl+P', desc: 'Cycle view mode (Edit / Split / Preview)' },
  { key: '⌘N / Ctrl+N', desc: 'Create new note' },
  { key: '⌘B / Ctrl+B', desc: 'Bold text' },
  { key: '⌘I / Ctrl+I', desc: 'Italic text' },
  { key: '⌘E / Ctrl+E', desc: 'Inline code' },
  { key: '⌘K / Ctrl+K', desc: 'Insert link' },
  { key: '⌘Z / Ctrl+Z', desc: 'Undo' },
  { key: '⌘⇧Z / Ctrl+Y', desc: 'Redo' },
];

export function SettingsModal({ isOpen, onClose, theme, onThemeChange }: SettingsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings & Shortcuts">
      <div className="settings-modal" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="setting-section">
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Appearance
          </h4>
          <div className="theme-selector">
            <button
              type="button"
              className={`theme-option ${theme === 'light' ? 'active' : ''}`}
              onClick={() => onThemeChange('light')}
            >
              <span>☀️</span> Light Mode
            </button>
            <button
              type="button"
              className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => onThemeChange('dark')}
            >
              <span>🌙</span> Dark Mode (Obsidian)
            </button>
          </div>
        </div>

        <div className="setting-section">
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Keyboard Shortcuts
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
            {SHORTCUTS.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.35rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-app)',
                  fontSize: '0.8125rem',
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
                <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', background: 'var(--bg-surface)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  {item.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        <div className="setting-section" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>MarkLoom v2.0.0</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Fast, private, local-first markdown editor with native file system access and Google Drive cloud sync.
          </p>
        </div>

        <div className="modal-actions">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}