import { useState } from 'react';
import { StorageProvider } from './StorageProvider';
import { GoogleDriveProvider } from './GoogleDriveProvider';
import { DropboxProvider } from './DropboxProvider';
import { OneDriveProvider } from './OneDriveProvider';
import { LocalProvider } from './LocalProvider';

interface ProviderSelectorProps {
  onProviderSelected: (provider: StorageProvider | null) => void;
  onDriveAuthenticated?: (provider: GoogleDriveProvider) => void;
  currentProvider: StorageProvider | null;
  /** Full picker for the main area; compact status for the header */
  variant?: 'full' | 'compact';
}

export function ProviderSelector({
  onProviderSelected,
  onDriveAuthenticated,
  currentProvider,
  variant = 'full',
}: ProviderSelectorProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providers = [
    {
      id: 'local',
      name: 'Local Files',
      icon: '💻',
      description: 'Select .md files from your computer',
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      icon: '🔵',
      description: 'Pick a folder and edit markdown files in Google Drive',
    },
    // {
    //   id: 'dropbox',
    //   name: 'Dropbox',
    //   icon: '📦',
    //   description: 'Access markdown files in your Dropbox',
    // },
    // {
    //   id: 'onedrive',
    //   name: 'OneDrive',
    //   icon: '☁️',
    //   description: 'Access markdown files in OneDrive',
    // },
  ];

  const handleConnect = async (providerId: string) => {
    setIsConnecting(true);
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
      setIsConnecting(false);
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
      <div className="provider-connected compact">
        <div className="provider-info">
          <span className="provider-icon">✓</span>
          <span className="provider-name">{currentProvider.name}</span>
        </div>
        <button
          className="disconnect-button"
          onClick={handleDisconnect}
          disabled={isConnecting}
          type="button"
        >
          Change
        </button>
      </div>
    );
  }

  if (currentProvider && variant === 'full') {
    return null;
  }

  return (
    <div className={`provider-selector ${variant === 'full' ? 'provider-selector-full' : ''}`}>
      <h3>{variant === 'full' ? 'Where are your markdown files?' : 'Select Storage'}</h3>
      {variant === 'full' && (
        <p className="provider-selector-subtitle">
          Choose a source to open and edit your notes
        </p>
      )}
      {error && <div className="error-message">{error}</div>}
      <div className={`provider-list ${variant === 'full' ? 'provider-list-grid' : ''}`}>
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            className="provider-card"
            onClick={() => !isConnecting && handleConnect(provider.id)}
            disabled={isConnecting}
          >
            <div className="provider-icon">{provider.icon}</div>
            <div className="provider-details">
              <div className="provider-name">{provider.name}</div>
              <div className="provider-description">{provider.description}</div>
            </div>
            {isConnecting && (
              <div className="connecting-indicator">Connecting...</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
