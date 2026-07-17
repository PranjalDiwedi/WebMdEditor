import { Modal } from './Modal';
import { Button } from './Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

export function SettingsModal({ isOpen, onClose, theme, onThemeChange }: SettingsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="settings-modal">
        <div className="setting-section">
          <h3>Appearance</h3>
          <div className="setting-item">
            <label>Theme</label>
            <div className="theme-selector">
              <button
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => onThemeChange('light')}
              >
                <span className="theme-icon">☀️</span>
                Light
              </button>
              <button
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => onThemeChange('dark')}
              >
                <span className="theme-icon">🌙</span>
                Dark
              </button>
            </div>
          </div>
        </div>

        <div className="setting-section">
          <h3>About</h3>
          <div className="setting-item">
            <p>Web MD Editor v1.2.0</p>
            <p className="setting-description">
              A Mac Notes-inspired markdown editor with support for multiple cloud storage providers.
            </p>
          </div>
        </div>

        <div className="modal-actions">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}