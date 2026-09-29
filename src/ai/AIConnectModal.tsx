import { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { useAI } from './useAI';
import { SUPPORTED_PROVIDERS } from './constants';
import { testAIConnection } from './providers';
import type { LLMProviderId, KeyStorageMode, AIConfig } from './types';

interface AIConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIConnectModal({ isOpen, onClose }: AIConnectModalProps) {
  const { config, setAIConfig, disconnectAI, isConnected } = useAI();

  const [selectedProvider, setSelectedProvider] = useState<LLMProviderId>('groq');
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [storageMode, setStorageMode] = useState<KeyStorageMode>('ephemeral');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Sync state when modal opens or config changes
  useEffect(() => {
    if (isOpen) {
      if (config) {
        setSelectedProvider(config.provider);
        setApiKey(config.apiKey || '');
        const provDef = SUPPORTED_PROVIDERS.find((p) => p.id === config.provider);
        const isPredefined = provDef?.availableModels.some((m) => m.id === config.model && m.id !== 'custom');
        if (isPredefined) {
          setSelectedModel(config.model);
          setCustomModelId('');
        } else {
          setSelectedModel('custom');
          setCustomModelId(config.model);
        }
        setStorageMode(config.storageMode || 'ephemeral');
        setBaseUrl(config.baseUrl || '');
      } else {
        setSelectedProvider('gemini');
        const defaultProv = SUPPORTED_PROVIDERS.find((p) => p.id === 'gemini');
        setSelectedModel(defaultProv?.defaultModel || 'gemini-3.8-flash');
        setCustomModelId('');
        setApiKey('');
        setStorageMode('ephemeral');
        setBaseUrl('');
      }
      setTestStatus(null);
    }
  }, [isOpen, config]);

  const activeProviderDef = SUPPORTED_PROVIDERS.find((p) => p.id === selectedProvider)!;

  const handleProviderChange = (providerId: LLMProviderId) => {
    setSelectedProvider(providerId);
    const def = SUPPORTED_PROVIDERS.find((p) => p.id === providerId)!;
    setSelectedModel(def.defaultModel);
    setCustomModelId('');
    if (def.defaultBaseUrl) {
      setBaseUrl(def.defaultBaseUrl);
    }
    setTestStatus(null);
  };

  const getEffectiveModel = () => {
    if (selectedModel === 'custom') {
      return customModelId.trim() || activeProviderDef.defaultModel;
    }
    return selectedModel;
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const draftConfig: AIConfig = {
        provider: selectedProvider,
        apiKey: apiKey.trim(),
        model: getEffectiveModel(),
        storageMode,
        baseUrl: baseUrl.trim() || undefined,
      };
      await testAIConnection(draftConfig);
      setTestStatus({ success: true, message: 'Connection successful! Ready to use.' });
    } catch (err: any) {
      setTestStatus({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to connect to provider.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (activeProviderDef.requiresApiKey && !apiKey.trim()) {
      setTestStatus({ success: false, message: 'Please provide an API key.' });
      return;
    }

    const newConfig: AIConfig = {
      provider: selectedProvider,
      apiKey: apiKey.trim(),
      model: getEffectiveModel(),
      storageMode,
      baseUrl: baseUrl.trim() || undefined,
    };

    setAIConfig(newConfig);
    onClose();
  };

  const handleDisconnect = () => {
    disconnectAI();
    setApiKey('');
    setTestStatus(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect AI Assistant (BYOK)">
      <div className="ai-connect-modal" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        {/* Provider Selector Tabs */}
        <div className="setting-section">
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.45rem' }}>
            Choose Provider
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.45rem' }}>
            {SUPPORTED_PROVIDERS.map((prov) => {
              const isSelected = selectedProvider === prov.id;
              return (
                <button
                  key={prov.id}
                  type="button"
                  onClick={() => handleProviderChange(prov.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--accent-glow)' : 'var(--bg-surface)',
                    color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{prov.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {prov.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Model Selector */}
        <div className="setting-section">
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.45rem' }}>
            Model
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          >
            {activeProviderDef.availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.description}
              </option>
            ))}
          </select>

          {selectedModel === 'custom' && (
            <div style={{ marginTop: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Custom Model Identifier:
              </label>
              <input
                type="text"
                value={customModelId}
                onChange={(e) => {
                  setCustomModelId(e.target.value);
                  setTestStatus(null);
                }}
                placeholder="e.g. gemini-3.8-flash, gemini-3.8-pro..."
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  outline: 'none',
                }}
              />
            </div>
          )}
        </div>

        {/* API Key Input (if required) */}
        {activeProviderDef.requiresApiKey ? (
          <div className="setting-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                API Key
              </label>
              <a
                href={activeProviderDef.keyDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
              >
                Get {activeProviderDef.name.split(' ')[0]} Key ↗
              </a>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestStatus(null);
                }}
                placeholder={activeProviderDef.keyPlaceholder}
                style={{
                  width: '100%',
                  padding: '0.55rem 2.4rem 0.55rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  fontSize: '0.8rem',
                }}
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
        ) : (
          <div className="setting-section">
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.45rem' }}>
              Ollama Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-mono, monospace)',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Storage Persistence Preference */}
        <div className="setting-section">
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.45rem' }}>
            Key Storage Mode
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                padding: '0.6rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${storageMode === 'ephemeral' ? 'var(--accent)' : 'var(--border)'}`,
                background: storageMode === 'ephemeral' ? 'var(--accent-glow)' : 'var(--bg-surface)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="storageMode"
                  checked={storageMode === 'ephemeral'}
                  onChange={() => setStorageMode('ephemeral')}
                />
                <span>Ephemeral (In-Memory)</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingLeft: '1.2rem' }}>
                Wipes instantly on page reload. Zero disk trace.
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                padding: '0.6rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${storageMode === 'session' ? 'var(--accent)' : 'var(--border)'}`,
                background: storageMode === 'session' ? 'var(--accent-glow)' : 'var(--bg-surface)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="storageMode"
                  checked={storageMode === 'session'}
                  onChange={() => setStorageMode('session')}
                />
                <span>Tab Session</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingLeft: '1.2rem' }}>
                Survives reload (F5). Clears when tab is closed.
              </span>
            </label>
          </div>
        </div>

        {/* Test Result Message */}
        {testStatus && (
          <div
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              background: testStatus.success ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${testStatus.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: testStatus.success ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>{testStatus.success ? '✓' : '⚠️'}</span>
            <span>{testStatus.message}</span>
          </div>
        )}

        {/* Security Assurance Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            padding: '0.6rem 0.75rem',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ fontSize: '0.9rem' }}>🔒</span>
          <span>
            <strong>100% Client-Side & Private:</strong> Keys are used strictly within your browser directly with {activeProviderDef.name.split(' ')[0]}. They are never sent to Mandrak or stored on our servers.
          </span>
        </div>

        {/* Actions Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <div>
            {isConnected && (
              <Button variant="danger" size="small" onClick={handleDisconnect}>
                Disconnect & Clear Key
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="secondary"
              size="small"
              onClick={handleTest}
              disabled={isTesting || (activeProviderDef.requiresApiKey && !apiKey.trim())}
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button variant="primary" size="small" onClick={handleSave}>
              Save & Activate
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
