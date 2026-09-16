import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { GitHubIcon } from '../components/GitHubIcon';
import { GitHubProvider } from './GitHubProvider';
import { OAUTH_CONFIGS } from '../config/constants';

interface GitHubConnectModalProps {
  isOpen: boolean;
  onAuthenticated: (provider: GitHubProvider) => void;
  onCancel: () => void;
}

export function GitHubConnectModal({
  isOpen,
  onAuthenticated,
  onCancel,
}: GitHubConnectModalProps) {
  const [activeTab, setActiveTab] = useState<'oauth' | 'token'>(
    OAUTH_CONFIGS.github.clientId ? 'oauth' : 'token'
  );
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync default tab if config changes
  useEffect(() => {
    if (OAUTH_CONFIGS.github.clientId) {
      setActiveTab('oauth');
    }
  }, [isOpen]);

  const processedCodesRef = React.useRef<Set<string>>(new Set());

  // Listen for OAuth popup callback messages
  useEffect(() => {
    if (!isOpen) return;

    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GITHUB_OAUTH_CALLBACK') {
        const { token: oauthToken, code, error: oauthError } = event.data;
        if (oauthError) {
          setError(oauthError);
          setIsLoading(false);
          return;
        }

        if (oauthToken) {
          try {
            const provider = new GitHubProvider();
            provider.setToken(oauthToken);
            await provider.listUserRepositories(oauthToken);
            onAuthenticated(provider);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to authenticate via GitHub OAuth.');
          } finally {
            setIsLoading(false);
          }
        } else if (code) {
          // Prevent double exchange of single-use OAuth code
          if (processedCodesRef.current.has(code)) {
            return;
          }
          processedCodesRef.current.add(code);

          try {
            setIsLoading(true);
            const gatekeeper = OAUTH_CONFIGS.github.gatekeeperUrl;
            const redirectUri = OAUTH_CONFIGS.github.redirectUri;
            const exchangeUrl = gatekeeper
              ? `${gatekeeper}/${code}`
              : `/api/github/oauth/exchange?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

            const res = await fetch(exchangeUrl);
            const contentType = res.headers.get('content-type') || '';
            const rawText = await res.text();

            let data: { token?: string; error?: string; scope?: string } = {};
            if (contentType.includes('application/json') || rawText.trim().startsWith('{')) {
              try {
                data = JSON.parse(rawText);
              } catch {
                data = {};
              }
            }

            if (!res.ok) {
              let errorMsg = data.error || `HTTP ${res.status}: Failed to exchange authorization code.`;
              if (rawText.includes('<!doctype') || rawText.includes('<html') || rawText.includes('<head>')) {
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                  errorMsg =
                    'Dev server OAuth proxy not initialized. Please restart your dev server (npm run dev) so Vite loads the updated proxy configuration.';
                } else {
                  errorMsg =
                    'Netlify OAuth Function route was not found or returned the SPA page. Please ensure netlify.toml is deployed and VITE_GITHUB_CLIENT_SECRET is set in Netlify Environment Variables.';
                }
              }
              throw new Error(errorMsg);
            }

            if (data.error) {
              throw new Error(data.error);
            }
            if (data.token) {
              const provider = new GitHubProvider();
              provider.setToken(data.token);
              onAuthenticated(provider);
              return;
            }
            if (rawText.includes('<!doctype') || rawText.includes('<html')) {
              if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                throw new Error(
                  'Dev server OAuth proxy not initialized. Please restart your dev server (npm run dev) so Vite loads the updated proxy configuration.'
                );
              } else {
                throw new Error(
                  'OAuth exchange endpoint returned HTML instead of token. Please verify Netlify functions deployment.'
                );
              }
            }
            throw new Error('No access token returned from OAuth authorization server.');
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setIsLoading(false);
          }
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => {
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, [isOpen, onAuthenticated]);

  const handleOAuthPopup = () => {
    setError(null);
    const clientId = OAUTH_CONFIGS.github.clientId;
    if (!clientId) {
      setError(
        'GitHub OAuth Client ID is not configured. Please paste a Personal Access Token below, or set VITE_GITHUB_CLIENT_ID in your environment variables.'
      );
      return;
    }

    setIsLoading(true);
    const redirectUri = OAUTH_CONFIGS.github.redirectUri;
    const scopes = OAUTH_CONFIGS.github.scopes.join(' ');
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    const width = 600;
    const height = 720;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      authUrl,
      'github_oauth_popup',
      `width=${width},height=${height},top=${top},left=${left},status=no,toolbar=no,menubar=no`
    );

    if (!popup) {
      setIsLoading(false);
      setError('Popup was blocked by your browser. Please allow popups for this site and try again.');
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanToken = token.trim();
    if (!cleanToken) {
      setError('Please paste your GitHub Personal Access Token below to continue.');
      return;
    }

    setIsLoading(true);

    try {
      const provider = new GitHubProvider();
      provider.setToken(cleanToken);

      // Verify token by loading user's repository list
      const repos = await provider.listUserRepositories(cleanToken);
      if (!Array.isArray(repos)) {
        throw new Error('Unexpected response from GitHub API');
      }

      onAuthenticated(provider);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to verify token with GitHub. Please check that the token is valid and has "repo" scope.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Connect GitHub Account">
      <div className="github-connect-form">
        <div className="github-modal-header-banner">
          <div className="github-banner-icon">
            <GitHubIcon size={26} />
          </div>
          <div className="github-banner-text">
            <strong>Direct GitHub Sync</strong>
            <span>Browse, edit, and commit markdown notes directly to your GitHub repositories.</span>
          </div>
        </div>

        <div className="github-security-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>
            <strong>Zero-Server Privacy:</strong> Your token/session is stored strictly in browser session memory and never transmitted to any third-party server.
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="github-auth-tabs">
          <button
            type="button"
            className={`github-auth-tab ${activeTab === 'oauth' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('oauth');
              setError(null);
            }}
          >
            ⚡ 1-Click OAuth Popup
          </button>
          <button
            type="button"
            className={`github-auth-tab ${activeTab === 'token' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('token');
              setError(null);
            }}
          >
            🔑 Personal Access Token (PAT)
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Tab 1: 1-Click OAuth */}
        {activeTab === 'oauth' && (
          <div className="github-tab-content">
            {OAUTH_CONFIGS.github.clientId ? (
              <div className="github-oauth-section">
                <p className="github-oauth-description">
                  Authorize Mandrak via GitHub to automatically load your repository list with 1-click popup authentication.
                </p>
                <button
                  type="button"
                  className="github-oauth-btn"
                  onClick={handleOAuthPopup}
                  disabled={isLoading}
                >
                  <GitHubIcon size={20} />
                  <span>{isLoading ? 'Waiting for GitHub authorization...' : 'Authorize with GitHub (1-Click Popup)'}</span>
                </button>
              </div>
            ) : (
              <div className="github-oauth-setup-notice">
                <div className="oauth-setup-header">
                  <strong>OAuth App Client ID Not Configured</strong>
                  <span>To enable 1-click login like Google Drive:</span>
                </div>
                <ol className="oauth-setup-steps">
                  <li>
                    Register a free OAuth App at{' '}
                    <a
                      href="https://github.com/settings/applications/new"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      github.com/settings/applications/new ↗
                    </a>
                  </li>
                  <li>
                    Set Callback URL to: <code>{window.location.origin}/auth/callback/github</code>
                  </li>
                  <li>
                    Add <code>VITE_GITHUB_CLIENT_ID=your_client_id</code> to <code>.env</code>
                  </li>
                </ol>
                <div className="oauth-setup-fallback-action">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setActiveTab('token')}
                  >
                    Use Personal Access Token Instead ➔
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Personal Access Token */}
        {activeTab === 'token' && (
          <div className="github-tab-content">
            <form onSubmit={handleTokenSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="github-field-group">
                <div className="github-field-label-row">
                  <label htmlFor="github-pat-input">Personal Access Token</label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Mandrak%20Markdown%20Editor"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="github-token-link"
                  >
                    Generate Token on GitHub ↗
                  </a>
                </div>
                <div className="github-token-input-wrapper">
                  <input
                    id="github-pat-input"
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Paste token (ghp_... or github_pat_...)"
                    autoComplete="off"
                    spellCheck={false}
                    className="github-input"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="github-token-toggle-btn"
                    onClick={() => setShowToken((prev) => !prev)}
                    title={showToken ? 'Hide token' : 'Show token'}
                  >
                    {showToken ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <span className="github-field-help">
                  Requires <code>repo</code> scope to load repositories and commit markdown files.
                </span>
              </div>

              {/* Actions */}
              <div className="github-modal-actions">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Verifying & Fetching Repos...' : 'Continue to Choose Repository ➔'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
}
