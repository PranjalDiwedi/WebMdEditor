import { Modal } from './Modal';
import { Button } from './Button';
import { MandrakLogo } from './MandrakLogo';
import { modSymbol, altSymbol, shiftSymbol } from '../utils/keyboard';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

interface ShortcutItem {
  key: string;
  desc: string;
}

interface ShortcutGroup {
  groupName: string;
  items: ShortcutItem[];
}

export function SettingsModal({ isOpen, onClose, theme, onThemeChange }: SettingsModalProps) {
  const shortcutGroups: ShortcutGroup[] = [
    {
      groupName: 'General & Navigation',
      items: [
        { key: `${modSymbol}S`, desc: 'Save current note' },
        { key: `${modSymbol}N`, desc: 'Create new note' },
        { key: `${modSymbol}P`, desc: 'Cycle view mode (Edit / Split / Preview)' },
        { key: `${modSymbol}\\`, desc: 'Toggle sidebar' },
        { key: `${modSymbol}K`, desc: 'Focus note search' },
        { key: 'Esc', desc: 'Close dialog / Clear search' },
      ],
    },
    {
      groupName: 'Workspace Tabs',
      items: [
        { key: `${modSymbol}W`, desc: 'Close active tab' },
        { key: `Ctrl+Tab / Ctrl+⇧Tab`, desc: 'Cycle open tabs' },
        { key: `${modSymbol}${altSymbol}← / →`, desc: 'Previous / Next tab' },
        { key: `${modSymbol}${altSymbol}1..9`, desc: 'Jump to tab 1-9' },
      ],
    },
    {
      groupName: 'Markdown Editor Formatting',
      items: [
        { key: `${modSymbol}B`, desc: 'Bold text' },
        { key: `${modSymbol}I`, desc: 'Italic text' },
        { key: `${modSymbol}${shiftSymbol}X`, desc: 'Strikethrough' },
        { key: `${modSymbol}E`, desc: 'Inline code' },
        { key: `${modSymbol}K`, desc: 'Insert / Edit link' },
        { key: `${modSymbol}${altSymbol}1..3`, desc: 'Heading 1 / 2 / 3' },
        { key: `${modSymbol}${shiftSymbol}8`, desc: 'Bullet list' },
        { key: `${modSymbol}${shiftSymbol}7`, desc: 'Numbered list' },
        { key: `${modSymbol}${shiftSymbol}.`, desc: 'Blockquote' },
        { key: `${modSymbol}${altSymbol}C`, desc: 'Code block' },
        { key: `${modSymbol}${shiftSymbol}H`, desc: 'Horizontal divider' },
        { key: 'Tab / ⇧Tab', desc: 'Indent / Outdent list' },
        { key: `${modSymbol}Z / ${modSymbol}${shiftSymbol}Z`, desc: 'Undo / Redo' },
      ],
    },
  ];

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
              <span>🌙</span> Dark Mode
            </button>
          </div>
        </div>

        <div className="setting-section">
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Keyboard Shortcuts
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {shortcutGroups.map((group, gIdx) => (
              <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {group.groupName}
                </span>
                {group.items.map((item, i) => (
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
            ))}
          </div>
        </div>

        <div className="setting-section" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <MandrakLogo size={20} animated={false} />
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>Mandrak</p>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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