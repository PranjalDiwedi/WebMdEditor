import { StorageProvider } from './StorageProvider';
import type { StorageFile } from '../types/storage';
import { isMarkdownFile, ensureMarkdownFileName, validateFileName } from '../utils/fileValidation';
import { OAUTH_CONFIGS } from '../config/constants';

export interface GitHubAuthConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}

export interface GitHubRepoDetails {
  owner: string;
  repo: string;
  branch: string;
  defaultBranch: string;
  isPrivate: boolean;
  description?: string;
}

export interface GitHubRepositoryItem {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  description: string | null;
  default_branch: string;
  updated_at: string;
  stargazers_count: number;
  fork: boolean;
  html_url?: string;
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUtf8(str: string): string {
  const clean = str.replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (m) => m.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function cleanFilePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

export function getGitHubApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return `/api/github/rest${cleanPath}`;
  }
  return `https://api.github.com${cleanPath}`;
}

export class GitHubProvider extends StorageProvider {
  name = 'GitHub';
  type = 'github' as const;

  private token = '';
  private owner = '';
  private repo = '';
  private branch = 'main';
  private defaultBranch = 'main';
  private isPrivate = false;
  private fileShas: Map<string, string> = new Map();

  getToken(): string {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token.trim();
  }

  getRepoInfo(): GitHubRepoDetails {
    return {
      owner: this.owner,
      repo: this.repo,
      branch: this.branch,
      defaultBranch: this.defaultBranch,
      isPrivate: this.isPrivate,
    };
  }

  private getHeaders(tokenOverride?: string): Record<string, string> {
    const t = tokenOverride || this.token;
    return {
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: 'application/json',
      Authorization: `Bearer ${t}`,
    };
  }

  /**
   * Internal request helper that tries proxy first, then falls back to direct API.
   */
  private async requestGitHub(path: string, options: RequestInit = {}): Promise<Response> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    // 1. Try local or Netlify proxy (/api/github/rest)
    try {
      const proxyRes = await fetch(`/api/github/rest${cleanPath}`, options);
      const ct = proxyRes.headers.get('content-type') || '';
      if (proxyRes.status !== 404 && !ct.includes('text/html')) {
        return proxyRes;
      }
    } catch {
      // Fallback
    }

    // 2. Fallback to direct https://api.github.com
    return fetch(`https://api.github.com${cleanPath}`, options);
  }

  /**
   * List all repositories accessible to the user (sorted by recently updated).
   */
  async listUserRepositories(tokenOverride?: string): Promise<GitHubRepositoryItem[]> {
    const t = tokenOverride || this.token;
    if (!t) {
      throw new Error('Authentication token is required to list repositories.');
    }

    const res = await this.requestGitHub(
      '/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member',
      { headers: this.getHeaders(t) }
    );

    if (res.status === 401) {
      throw new Error('Invalid or expired GitHub token. Please verify token permissions.');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch repositories (${res.status})`);
    }

    const repos: GitHubRepositoryItem[] = await res.json();
    return repos;
  }

  /**
   * List branches for a specific repository.
   */
  async listBranches(owner?: string, repo?: string, tokenOverride?: string): Promise<string[]> {
    const o = owner || this.owner;
    const r = repo || this.repo;
    const t = tokenOverride || this.token;

    if (!o || !r || !t) {
      return ['main'];
    }

    try {
      const res = await this.requestGitHub(`/repos/${o}/${r}/branches?per_page=100`, {
        headers: this.getHeaders(t),
      });

      if (!res.ok) {
        return ['main'];
      }

      const branches: Array<{ name: string }> = await res.json();
      return branches.map((b) => b.name);
    } catch {
      return ['main'];
    }
  }

  /**
   * Select a repository and branch to mount.
   */
  selectRepository(
    repo: GitHubRepositoryItem | { owner: string; repo: string; branch?: string; isPrivate?: boolean; defaultBranch?: string },
    branchChoice?: string
  ): void {
    if ('full_name' in repo) {
      this.owner = repo.owner.login;
      this.repo = repo.name;
      this.defaultBranch = repo.default_branch || 'main';
      this.branch = (branchChoice || repo.default_branch || 'main').trim();
      this.isPrivate = !!repo.private;
    } else {
      this.owner = repo.owner;
      this.repo = repo.repo;
      this.defaultBranch = repo.defaultBranch || 'main';
      this.branch = (branchChoice || repo.branch || repo.defaultBranch || 'main').trim();
      this.isPrivate = !!repo.isPrivate;
    }

    this.name = `${this.owner}/${this.repo}`;
    this.isAuthenticated = true;
  }

  async authenticate(config?: unknown): Promise<void> {
    if (config && typeof config === 'object') {
      const { token, owner, repo, branch } = config as GitHubAuthConfig;

      if (!token?.trim()) {
        throw new Error('GitHub Personal Access Token is required.');
      }
      if (!owner?.trim() || !repo?.trim()) {
        throw new Error('Repository owner and name are required.');
      }

      const cleanToken = token.trim();
      const cleanOwner = owner.trim();
      const cleanRepo = repo.trim();

      // 1. Verify Repository access
      const repoRes = await this.requestGitHub(`/repos/${cleanOwner}/${cleanRepo}`, {
        headers: this.getHeaders(cleanToken),
      });

      if (repoRes.status === 401) {
        throw new Error('Invalid GitHub Personal Access Token. Please check your token and scopes.');
      }
      if (repoRes.status === 404) {
        throw new Error(`Repository "${cleanOwner}/${cleanRepo}" not found. Verify the name and token permissions.`);
      }
      if (!repoRes.ok) {
        const errData = await repoRes.json().catch(() => ({}));
        throw new Error(errData.message || `GitHub error (${repoRes.status}): Failed to access repository.`);
      }

      const repoData = await repoRes.json();
      const targetBranch = (branch?.trim() || repoData.default_branch || 'main').trim();

      // 2. Verify target branch
      const branchRes = await this.requestGitHub(
        `/repos/${cleanOwner}/${cleanRepo}/branches/${encodeURIComponent(targetBranch)}`,
        {
          headers: this.getHeaders(cleanToken),
        }
      );

      if (!branchRes.ok) {
        throw new Error(`Branch "${targetBranch}" not found in repository "${cleanOwner}/${cleanRepo}".`);
      }

      // Set authenticated state strictly in memory
      this.token = cleanToken;
      this.owner = cleanOwner;
      this.repo = cleanRepo;
      this.branch = targetBranch;
      this.defaultBranch = repoData.default_branch || 'main';
      this.isPrivate = !!repoData.private;
      this.name = `${this.owner}/${this.repo}`;
      this.isAuthenticated = true;
      return;
    }

    // 1-Click OAuth flow (when VITE_GITHUB_CLIENT_ID is set)
    const clientId = OAUTH_CONFIGS.github.clientId;
    if (!clientId) {
      throw new Error(
        'GitHub OAuth Client ID is not configured in .env. Please configure VITE_GITHUB_CLIENT_ID or use a Personal Access Token.'
      );
    }

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
      throw new Error('Popup was blocked by your browser. Please allow popups for this site and try again.');
    }

    return new Promise((resolve, reject) => {
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'GITHUB_OAUTH_CALLBACK') {
          window.removeEventListener('message', handleMessage);
          const { token: oauthToken, code, error } = event.data;
          if (error) {
            reject(new Error(error));
            return;
          }

          if (oauthToken) {
            this.setToken(oauthToken);
            resolve();
          } else if (code) {
            try {
              const gatekeeper = OAUTH_CONFIGS.github.gatekeeperUrl;
              const exchangeUrl = gatekeeper
                ? `${gatekeeper}/${code}`
                : `/api/github/oauth/exchange?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

              const res = await fetch(exchangeUrl);
              const data = await res.json();
              if (data.error) {
                reject(new Error(data.error));
                return;
              }
              if (data.token) {
                this.setToken(data.token);
                resolve();
                return;
              }
              reject(new Error('No access token returned from exchange endpoint.'));
            } catch (err) {
              reject(new Error('Failed to exchange authorization code: ' + String(err)));
            }
          }
        }
      };

      window.addEventListener('message', handleMessage);
    });
  }

  async listFiles(): Promise<StorageFile[]> {
    if (!this.isAuthenticated || !this.token) {
      throw new Error('Not authenticated with GitHub.');
    }

    try {
      // Single API call to Git Trees endpoint to list entire repository tree recursively
      const res = await this.requestGitHub(
        `/repos/${this.owner}/${this.repo}/git/trees/${encodeURIComponent(this.branch)}?recursive=1`,
        { headers: this.getHeaders() }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to fetch file tree (${res.status})`);
      }

      const data = await res.json();
      const files: StorageFile[] = [];

      if (Array.isArray(data.tree)) {
        for (const item of data.tree) {
          if (item.type === 'blob' && isMarkdownFile(item.path)) {
            const clean = cleanFilePath(item.path);
            this.fileShas.set(clean, item.sha);

            const pathParts = clean.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const displayPath = `/${clean}`;

            files.push(
              this.convertToStorageFile(
                clean,
                fileName,
                '', // lazy loaded on read
                displayPath,
                new Date(),
                item.size || 0
              )
            );
          }
        }
      }

      return files;
    } catch (error) {
      throw new Error(`Failed to list GitHub files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async readFile(fileId: string): Promise<string> {
    if (!this.isAuthenticated || !this.token) {
      throw new Error('Not authenticated with GitHub.');
    }

    const clean = cleanFilePath(fileId);

    try {
      const res = await this.requestGitHub(
        `/repos/${this.owner}/${this.repo}/contents/${encodeURIComponent(clean)}?ref=${encodeURIComponent(this.branch)}`,
        { headers: this.getHeaders() }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to read file (${res.status})`);
      }

      const data = await res.json();
      if (data.sha) {
        this.fileShas.set(clean, data.sha);
      }

      if (data.content && data.encoding === 'base64') {
        return base64ToUtf8(data.content);
      }

      return data.content || '';
    } catch (error) {
      throw new Error(`Failed to read GitHub file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async fetchCurrentSha(cleanPath: string): Promise<string | undefined> {
    try {
      const res = await this.requestGitHub(
        `/repos/${this.owner}/${this.repo}/contents/${encodeURIComponent(cleanPath)}?ref=${encodeURIComponent(this.branch)}`,
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.sha) {
          this.fileShas.set(cleanPath, data.sha);
          return data.sha;
        }
      }
    } catch {}
    return undefined;
  }

  async writeFile(fileId: string, content: string, commitMessage?: string): Promise<void> {
    if (!this.isAuthenticated || !this.token) {
      throw new Error('Not authenticated with GitHub.');
    }

    const clean = cleanFilePath(fileId);
    let sha = this.fileShas.get(clean);

    if (!sha) {
      sha = await this.fetchCurrentSha(clean);
    }

    const fileName = clean.split('/').pop() || clean;
    const message = commitMessage?.trim() || `Update ${fileName} via Mandrak`;

    const body: Record<string, unknown> = {
      message,
      content: utf8ToBase64(content),
      branch: this.branch,
    };

    if (sha) {
      body.sha = sha;
    }

    const res = await this.requestGitHub(
      `/repos/${this.owner}/${this.repo}/contents/${encodeURIComponent(clean)}`,
      {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      }
    );

    if (res.status === 409) {
      // Refresh SHA on conflict
      await this.fetchCurrentSha(clean);
      throw new Error('Conflict: This file was modified remotely. Please pull or refresh the latest changes before saving.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to save file to GitHub (${res.status})`);
    }

    const result = await res.json();
    if (result.content?.sha) {
      this.fileShas.set(clean, result.content.sha);
    }
  }

  async createFile(
    name: string,
    content: string,
    path?: string,
    commitMessage?: string
  ): Promise<StorageFile> {
    if (!this.isAuthenticated || !this.token) {
      throw new Error('Not authenticated with GitHub.');
    }

    const validation = validateFileName(name);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid file name');
    }

    const fileName = ensureMarkdownFileName(name);
    const folder = path ? cleanFilePath(path) : '';
    const cleanPath = folder ? `${folder}/${fileName}` : fileName;

    const message = commitMessage?.trim() || `Create ${fileName} via Mandrak`;

    const body = {
      message,
      content: utf8ToBase64(content),
      branch: this.branch,
    };

    const res = await this.requestGitHub(
      `/repos/${this.owner}/${this.repo}/contents/${encodeURIComponent(cleanPath)}`,
      {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create file on GitHub (${res.status})`);
    }

    const result = await res.json();
    if (result.content?.sha) {
      this.fileShas.set(cleanPath, result.content.sha);
    }

    return this.convertToStorageFile(
      cleanPath,
      fileName,
      content,
      `/${cleanPath}`,
      new Date(),
      content.length
    );
  }

  async deleteFile(fileId: string, commitMessage?: string): Promise<void> {
    if (!this.isAuthenticated || !this.token) {
      throw new Error('Not authenticated with GitHub.');
    }

    const clean = cleanFilePath(fileId);
    let sha = this.fileShas.get(clean);

    if (!sha) {
      sha = await this.fetchCurrentSha(clean);
    }

    if (!sha) {
      throw new Error('Cannot delete file: SHA not found.');
    }

    const fileName = clean.split('/').pop() || clean;
    const message = commitMessage?.trim() || `Delete ${fileName} via Mandrak`;

    const res = await this.requestGitHub(
      `/repos/${this.owner}/${this.repo}/contents/${encodeURIComponent(clean)}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
        body: JSON.stringify({
          message,
          sha,
          branch: this.branch,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to delete file from GitHub (${res.status})`);
    }

    this.fileShas.delete(clean);
  }

  async moveFile(fileId: string, newPath: string): Promise<void> {
    const oldClean = cleanFilePath(fileId);
    const newClean = cleanFilePath(newPath);

    if (oldClean === newClean) return;

    // Read content from existing file
    const content = await this.readFile(oldClean);
    const fileName = newClean.split('/').pop() || 'file.md';

    // Create at new path
    await this.createFile(fileName, content, newClean.split('/').slice(0, -1).join('/'), `Move ${oldClean} to ${newClean}`);

    // Delete old file
    await this.deleteFile(oldClean, `Remove old ${oldClean} after moving`);
  }

  async disconnect(): Promise<void> {
    this.token = '';
    this.owner = '';
    this.repo = '';
    this.branch = 'main';
    this.defaultBranch = 'main';
    this.fileShas.clear();
    this.isAuthenticated = false;
  }
}
