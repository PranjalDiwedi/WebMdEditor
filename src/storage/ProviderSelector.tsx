import { useState } from 'react';
import { StorageProvider } from './StorageProvider';
import { GoogleDriveProvider } from './GoogleDriveProvider';
import { DropboxProvider } from './DropboxProvider';
import { OneDriveProvider } from './OneDriveProvider';
import { LocalProvider } from './LocalProvider';
import { MandrakLogo } from '../components/MandrakLogo';
import { GoogleDriveIcon } from '../components/GoogleDriveIcon';

interface ProviderSelectorProps {
  onProviderSelected: (provider: StorageProvider | null) => void;
  onDriveAuthenticated?: (provider: GoogleDriveProvider) => void;
  onSelectTemplate?: (templateName: string, templateContent: string) => void;
  currentProvider: StorageProvider | null;
  /** Full picker for the main area; compact status for the header */
  variant?: 'full' | 'compact';
}

const STARTER_TEMPLATES = [
  {
    id: 'meeting-notes',
    name: '📝 Meeting Notes',
    fileName: 'meeting-notes.md',
    content: `# 📝 Meeting Notes

**Date:** ${new Date().toLocaleDateString()}  
**Participants:**  
- [ ] Name 1
- [ ] Name 2

---

## 🎯 Objectives
1. Review project milestones
2. Align on next quarter deliverables

## 💬 Discussion & Key Points
- 

## ⚡ Action Items
- [ ] **Task 1:** Assigned to @name by Friday
- [ ] **Task 2:** Prepare architectural spec
`,
  },
  {
    id: 'project-roadmap',
    name: '🎯 Project Roadmap',
    fileName: 'project-roadmap.md',
    content: `# 🎯 Project Roadmap

> High-level strategy, milestones, and release timeline.

---

## 🚀 Q1 Milestones
- [x] Initial design prototype & validation
- [ ] Core architecture implementation
- [ ] Alpha release for beta testers

## 🛠️ Technical Stack
\`\`\`typescript
interface FeatureFlags {
  enableSplitView: boolean;
  enableCloudSync: boolean;
}
\`\`\`

## 📌 Success Metrics
| Metric | Goal | Status |
| :--- | :--- | :--- |
| Latency | < 50ms | 🟢 On Track |
| Reliability | 99.9% | 🟢 Healthy |
`,
  },
  {
    id: 'daily-journal',
    name: '📔 Daily Journal',
    fileName: 'daily-journal.md',
    content: `# 📔 Daily Journal — ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}

### ☀️ Morning Intentions
- What are the 3 most important things I want to accomplish today?
  1. 
  2. 
  3. 

### 💡 Daily Reflections & Notes
- 

### 🌙 Evening Gratitude
- One win from today: 
`,
  },
  {
    id: 'blank-note',
    name: '⚡ Blank Note',
    fileName: 'untitled.md',
    content: `# Untitled Note

Start typing your thoughts in markdown...
`,
  },
];

export function ProviderSelector({
  onProviderSelected,
  onDriveAuthenticated,
  onSelectTemplate,
  currentProvider,
  variant = 'full',
}: ProviderSelectorProps) {
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleConnect = async (providerId: string) => {
    setConnectingProvider(providerId);
    setError(null);

    try {
      let provider: StorageProvider;

      switch (providerId) {
        case 'google-drive': {
          const driveProvider = new GoogleDriveProvider();
          await driveProvider.authenticate();
          if (onDriveAuthenticated) {
            onDriveAuthenticated(driveProvider);
          } else {
            onProviderSelected(driveProvider);
          }
          return;
        }
        case 'dropbox':
          provider = new DropboxProvider();
          break;
        case 'onedrive':
          provider = new OneDriveProvider();
          break;
        case 'local':
          provider = new LocalProvider();
          break;
        default:
          throw new Error('Unknown provider');
      }

      await provider.authenticate();
      onProviderSelected(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to provider');
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async () => {
    if (currentProvider) {
      await currentProvider.disconnect();
      onProviderSelected(null);
    }
  };

  if (currentProvider && variant === 'compact') {
    return (
      <div className="storage-pill-compact">
        {currentProvider.type === 'google-drive' ? (
          <GoogleDriveIcon size={14} />
        ) : (
          <span className="status-dot" />
        )}
        <span>{currentProvider.name}</span>
        <button
          className="storage-change-btn"
          onClick={handleDisconnect}
          disabled={connectingProvider !== null}
          title="Switch storage location"
          type="button"
        >
          (Change)
        </button>
      </div>
    );
  }

  if (currentProvider && variant === 'full') {
    return null;
  }

  return (
    <div className="storage-picker-panel">
      <div className="landing-container">
        <div className="landing-badge">
          <MandrakLogo size={18} animated={false} />
          <span>Mandrak • Fast, Private, Local-First Markdown</span>
        </div>

        <h1 className="landing-headline">
          Write in Markdown. <br />
          <span className="headline-gradient">Save Anywhere.</span>
        </h1>

        <p className="landing-subtitle">
          A distraction-free, lightning-fast editor with native local file access and seamless Google Drive sync. No account required.
        </p>

        {error && <div className="error-message">{error}</div>}

        {/* Interactive Provider Cards */}
        <div className="landing-cards-grid">
          <div
            className="landing-provider-card"
            onClick={() => !connectingProvider && handleConnect('local')}
          >
            <div className="provider-card-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div className="provider-card-content">
              <h3>Local Storage</h3>
              <p>Open and edit markdown files directly on your computer with zero cloud lock-in.</p>
            </div>
            <button type="button" className="provider-card-btn" disabled={connectingProvider !== null}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              {connectingProvider === 'local' ? 'Connecting...' : 'Open Local Folder'}
            </button>
          </div>

          <div
            className="landing-provider-card"
            onClick={() => !connectingProvider && handleConnect('google-drive')}
          >
            <div className="provider-card-icon-wrapper" style={{ background: 'rgba(66, 133, 244, 0.12)' }}>
              <GoogleDriveIcon size={26} />
            </div>
            <div className="provider-card-content">
              <h3>Google Drive</h3>
              <p>Browse and sync your notes directly to Google Drive across all your devices.</p>
            </div>
            <button type="button" className="provider-card-btn" disabled={connectingProvider !== null}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {connectingProvider === 'google-drive' ? 'Connecting...' : 'Connect Google Drive'}
            </button>
          </div>
        </div>

        {/* Quick Starter Templates */}
        <div className="landing-templates-section">
          <span className="templates-title">Quick Starter Templates</span>
          <div className="templates-chips-wrapper">
            {STARTER_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                className="template-chip"
                onClick={() => {
                  if (onSelectTemplate) {
                    onSelectTemplate(tmpl.fileName, tmpl.content);
                  } else {
                    handleConnect('local');
                  }
                }}
              >
                {tmpl.name}
              </button>
            ))}
          </div>
        </div>

        {/* Dropzone */}
        <div
          className={`landing-dropzone ${isDragging ? 'drag-active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              const file = e.dataTransfer.files[0];
              const reader = new FileReader();
              reader.onload = (event) => {
                const text = event.target?.result as string;
                if (onSelectTemplate) {
                  onSelectTemplate(file.name, text);
                }
              };
              reader.readAsText(file);
            }
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span>or drop any .md file here to start editing immediately</span>
        </div>

        {/* Value Props Strip */}
        <div className="landing-feature-strip">
          <div className="feature-pill-item">
            <span>⚡</span> 0ms Latency
          </div>
          <div className="feature-pill-item">
            <span>🔒</span> 100% Client-Side Privacy
          </div>
          {/* <div className="feature-pill-item">
            <span>💾</span> Multi-Cloud Sync
          </div> */}
          <div className="feature-pill-item">
            <span>📄</span> GFM & Code Blocks
          </div>
        </div>
      </div>
    </div>
  );
}

