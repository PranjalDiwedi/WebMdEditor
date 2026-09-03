import { StorageProvider } from './StorageProvider';
import type { StorageFile } from '../types/storage';
import { OAUTH_CONFIGS } from '../config/constants';
import {
  isMarkdownFile,
  ensureMarkdownFileName,
  validateFileName,
} from '../utils/fileValidation';
import { initDriveClient, loadGisClient } from '../utils/googleScripts';
import { RateLimiter } from '../utils/rateLimiter';
import { toUserError, logSecurityEvent } from '../utils/securityErrors';

const TOKEN_SKEW_MS = 60_000; // refresh 1 minute before expiry

export class GoogleDriveProvider extends StorageProvider {
  name = 'Google Drive';
  type = 'google-drive' as const;
  private tokenClient: any = null;
  private accessToken: string = '';
  private tokenExpiresAt = 0;
  private folderId: string | null = null;
  private folderName = 'All Google Drive';
  private readonly rateLimiter = new RateLimiter(60);

  setTargetFolder(folderId: string | null, folderName: string): void {
    this.folderId = folderId;
    this.folderName = folderName;
  }

  getTargetFolder(): { id: string | null; name: string } {
    return { id: this.folderId, name: this.folderName };
  }

  async listChildFolders(parentId: string = 'root'): Promise<Array<{ id: string; name: string }>> {
    await this.ensureReadyAsync();

    return this.rateLimiter.schedule(async () => {
      const folders: Array<{ id: string; name: string }> = [];
      let pageToken: string | undefined;

      do {
        const response = await window.gapi.client.drive.files.list({
          q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'nextPageToken, files(id, name)',
          orderBy: 'name',
          pageSize: 100,
          pageToken,
        });

        for (const folder of response.result.files || []) {
          folders.push({ id: folder.id, name: folder.name });
        }
        pageToken = response.result.nextPageToken;
      } while (pageToken);

      return folders;
    });
  }

  private isMarkdownDriveFile(file: { name: string; mimeType?: string }): boolean {
    return isMarkdownFile(file.name);
  }

  private applyToken(accessToken: string, expiresInSeconds = 3600): void {
    this.accessToken = accessToken;
    this.tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
    window.gapi.client.setToken({ access_token: this.accessToken });
    this.isAuthenticated = true;
  }

  private isTokenExpiringSoon(): boolean {
    return !this.accessToken || Date.now() >= this.tokenExpiresAt - TOKEN_SKEW_MS;
  }

  private async silentRefreshToken(): Promise<void> {
    if (!this.tokenClient) {
      throw new Error('Not authenticated with Google Drive');
    }

    return new Promise((resolve, reject) => {
      const previousCallback = this.tokenClient.callback;
      this.tokenClient.callback = (tokenResponse: {
        access_token?: string;
        error?: string;
        error_description?: string;
        expires_in?: number;
      }) => {
        this.tokenClient.callback = previousCallback;
        if (tokenResponse.error || !tokenResponse.access_token) {
          reject(
            new Error(
              tokenResponse.error_description ||
                tokenResponse.error ||
                'Google Drive session expired. Please reconnect.'
            )
          );
          return;
        }
        this.applyToken(tokenResponse.access_token, tokenResponse.expires_in || 3600);
        resolve();
      };

      try {
        this.tokenClient.requestAccessToken({ prompt: '' });
      } catch (error) {
        this.tokenClient.callback = previousCallback;
        reject(error);
      }
    });
  }

  async authenticate(): Promise<void> {
    const clientId = OAUTH_CONFIGS.google.clientId;
    if (!clientId) {
      throw new Error(
        'Missing VITE_GOOGLE_CLIENT_ID. Add your Web OAuth Client ID to .env and restart the dev server.'
      );
    }

    await initDriveClient(OAUTH_CONFIGS.google.apiKey || undefined);
    await loadGisClient();

    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services failed to initialize');
    }

    return new Promise((resolve, reject) => {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: OAUTH_CONFIGS.google.scopes.join(' '),
        callback: (tokenResponse: {
          access_token?: string;
          error?: string;
          error_description?: string;
          expires_in?: number;
        }) => {
          if (tokenResponse.error || !tokenResponse.access_token) {
            reject(
              new Error(
                tokenResponse.error_description ||
                  tokenResponse.error ||
                  'Google Drive authorization failed'
              )
            );
            return;
          }

          this.applyToken(tokenResponse.access_token, tokenResponse.expires_in || 3600);
          resolve();
        },
        error_callback: (error: { type?: string; message?: string }) => {
          const isBlocked = error.type === 'popup_blocked_by_browser' || error.message?.includes('popup');
          reject(
            new Error(
              isBlocked
                ? 'Google Drive popup was blocked by Firefox/browser. Please enable popups for this site and try again.'
                : error.message || error.type || 'Google Drive popup was closed or blocked'
            )
          );
        },
      });

      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  private async ensureReadyAsync(): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google Drive');
    }

    if (this.isTokenExpiringSoon()) {
      await this.silentRefreshToken();
    } else {
      window.gapi.client.setToken({ access_token: this.accessToken });
    }
  }

  async listFiles(): Promise<StorageFile[]> {
    await this.ensureReadyAsync();

    try {
      if (this.folderId) {
        return await this.listFilesInFolderRecursive(this.folderId);
      }
      return await this.listAllMarkdownFiles();
    } catch (error) {
      logSecurityEvent('drive.listFiles', error);
      throw new Error(toUserError(error, 'Failed to list Google Drive files'));
    }
  }

  private sanitizeDrivePath(rawPath: string, fileName: string): string {
    if (!rawPath) return fileName;
    const clean = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const segments = clean.split('/');
    const sanitized = segments.filter((seg) => !/^[a-zA-Z0-9_-]{20,}$/.test(seg));
    if (sanitized.length === 0) return fileName;
    if (sanitized[sanitized.length - 1].toLowerCase() === fileName.toLowerCase()) {
      return sanitized.join('/');
    }
    return `${sanitized.join('/')}/${fileName}`;
  }

  private async listAllMarkdownFiles(): Promise<StorageFile[]> {
    const files: StorageFile[] = [];
    let pageToken: string | undefined;

    // Fetch all folders with full pagination to map parent IDs to human-readable names
    const folderMap = new Map<string, string>();
    try {
      let folderPageToken: string | undefined;
      do {
        const foldersResponse = await this.rateLimiter.schedule(async () =>
          window.gapi.client.drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'nextPageToken, files(id, name)',
            pageSize: 100,
            pageToken: folderPageToken,
          })
        );
        for (const f of foldersResponse.result.files || []) {
          folderMap.set(f.id, f.name);
        }
        folderPageToken = foldersResponse.result.nextPageToken;
      } while (folderPageToken);
    } catch {}

    const query =
      "trashed=false and (" +
      "mimeType='text/markdown' or " +
      "mimeType='text/plain' or " +
      "name contains '.md' or " +
      "name contains '.markdown' or " +
      "name contains '.mdown' or " +
      "name contains '.mkd'" +
      ")";

    do {
      const response = await this.rateLimiter.schedule(async () =>
        window.gapi.client.drive.files.list({
          q: query,
          fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents)',
          orderBy: 'modifiedTime desc',
          pageSize: 100,
          pageToken,
          spaces: 'drive',
        })
      );

      for (const file of response.result.files || []) {
        if (this.isMarkdownDriveFile(file)) {
          const parentId = file.parents?.[0];
          const parentName = parentId && folderMap.has(parentId) ? folderMap.get(parentId)! : '';
          const fullPath = this.sanitizeDrivePath(parentName ? `${parentName}/${file.name}` : file.name, file.name);
          files.push(
            this.convertToStorageFile(
              file.id,
              file.name,
              '',
              fullPath,
              new Date(file.modifiedTime),
              parseInt(file.size || '0', 10) || 0
            )
          );
        }
      }
      pageToken = response.result.nextPageToken;
    } while (pageToken);

    return files;
  }

  private async listFilesInFolderRecursive(rootFolderId: string): Promise<StorageFile[]> {
    const files: StorageFile[] = [];
    const folderPathMap = new Map<string, string>();
    folderPathMap.set(rootFolderId, '');

    const folderQueue = [rootFolderId];

    while (folderQueue.length > 0) {
      const currentFolderId = folderQueue.shift()!;
      const currentFolderPath = folderPathMap.get(currentFolderId) || '';
      let pageToken: string | undefined;

      do {
        const response = await this.rateLimiter.schedule(async () =>
          window.gapi.client.drive.files.list({
            q: `'${currentFolderId}' in parents and trashed=false`,
            fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents)',
            orderBy: 'name',
            pageSize: 100,
            pageToken,
          })
        );

        for (const item of response.result.files || []) {
          if (item.mimeType === 'application/vnd.google-apps.folder') {
            const subfolderPath = currentFolderPath ? `${currentFolderPath}/${item.name}` : item.name;
            folderPathMap.set(item.id, subfolderPath);
            folderQueue.push(item.id);
          } else if (this.isMarkdownDriveFile(item)) {
            const fileFullPath = currentFolderPath ? `${currentFolderPath}/${item.name}` : item.name;
            files.push(
              this.convertToStorageFile(
                item.id,
                item.name,
                '',
                fileFullPath,
                new Date(item.modifiedTime),
                parseInt(item.size || '0', 10) || 0
              )
            );
          }
        }
        pageToken = response.result.nextPageToken;
      } while (pageToken);
    }

    return files;
  }

  async readFile(fileId: string): Promise<string> {
    await this.ensureReadyAsync();

    try {
      return await this.rateLimiter.schedule(async () => {
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to read file (${response.status})`);
        }

        return await response.text();
      });
    } catch (error) {
      logSecurityEvent('drive.readFile', error);
      throw new Error(toUserError(error, 'Failed to read Google Drive file'));
    }
  }

  async writeFile(fileId: string, content: string): Promise<void> {
    await this.ensureReadyAsync();

    try {
      await this.rateLimiter.schedule(async () => {
        const response = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'text/markdown; charset=UTF-8',
            },
            body: content,
          }
        );

        if (!response.ok) {
          throw new Error(`Upload failed (${response.status})`);
        }
      });
    } catch (error) {
      logSecurityEvent('drive.writeFile', error);
      throw new Error(toUserError(error, 'Failed to write Google Drive file'));
    }
  }

  async createFile(name: string, content: string, path?: string): Promise<StorageFile> {
    await this.ensureReadyAsync();

    const validation = validateFileName(name);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid file name');
    }

    const fileName = ensureMarkdownFileName(name);

    try {
      return await this.rateLimiter.schedule(async () => {
        let parentFolderId: string | null = this.folderId;

        // If path is specified (e.g. "Projects" or "Work/Q3"), resolve or create subfolders
        if (path) {
          const cleanPath = path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
          const folderParts = cleanPath.split('/').filter((p) => p.toLowerCase() !== fileName.toLowerCase());
          if (folderParts.length > 0) {
            parentFolderId = await this.resolveOrCreateFolderPath(folderParts, this.folderId || 'root');
          }
        }

        const metadata: { name: string; mimeType: string; parents?: string[] } = {
          name: fileName,
          mimeType: 'text/markdown',
        };
        if (parentFolderId && parentFolderId !== 'root') {
          metadata.parents = [parentFolderId];
        }

        const boundary = '-------md_editor_boundary';
        const body =
          `--${boundary}\r\n` +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          `${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\n` +
          'Content-Type: text/markdown; charset=UTF-8\r\n\r\n' +
          `${content}\r\n` +
          `--${boundary}--`;

        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,parents',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body,
          }
        );

        if (!response.ok) {
          throw new Error(`Create failed (${response.status})`);
        }

        const result = await response.json();
        const fullRelPath = path ? `${path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}/${fileName}` : fileName;
        return this.convertToStorageFile(
          result.id,
          result.name || fileName,
          content,
          fullRelPath,
          result.modifiedTime ? new Date(result.modifiedTime) : new Date(),
          Number(result.size) || content.length
        );
      });
    } catch (error) {
      logSecurityEvent('drive.createFile', error);
      throw new Error(toUserError(error, 'Failed to create Google Drive file'));
    }
  }

  private async resolveOrCreateFolderPath(folderParts: string[], rootParentId: string): Promise<string> {
    let currentParentId = rootParentId;

    for (const folderName of folderParts) {
      const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const query = `'${currentParentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${escapedName}' and trashed=false`;
      const response = await window.gapi.client.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        pageSize: 1,
      });

      if (response.result.files && response.result.files.length > 0) {
        currentParentId = response.result.files[0].id;
      } else {
        const createRes = await window.gapi.client.drive.files.create({
          resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: currentParentId !== 'root' ? [currentParentId] : undefined,
          },
          fields: 'id',
        });
        currentParentId = createRes.result.id;
      }
    }

    return currentParentId;
  }

  async moveFile(fileId: string, destinationFolderPath: string): Promise<void> {
    await this.ensureReadyAsync();

    try {
      await this.rateLimiter.schedule(async () => {
        const fileRes = await window.gapi.client.drive.files.get({
          fileId,
          fields: 'parents',
        });
        const currentParents = (fileRes.result.parents || []).join(',');

        let targetParentId = this.folderId || 'root';
        if (destinationFolderPath) {
          const cleanPath = destinationFolderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
          const folderParts = cleanPath.split('/');
          if (folderParts.length > 0) {
            targetParentId = await this.resolveOrCreateFolderPath(folderParts, this.folderId || 'root');
          }
        }

        await window.gapi.client.drive.files.update({
          fileId,
          addParents: targetParentId,
          removeParents: currentParents,
          fields: 'id, parents',
        });
      });
    } catch (error) {
      logSecurityEvent('drive.moveFile', error);
      throw new Error(toUserError(error, 'Failed to move Google Drive file'));
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.ensureReadyAsync();

    try {
      await this.rateLimiter.schedule(async () =>
        window.gapi.client.drive.files.delete({ fileId })
      );
    } catch (error) {
      logSecurityEvent('drive.deleteFile', error);
      throw new Error(toUserError(error, 'Failed to delete Google Drive file'));
    }
  }

  async disconnect(): Promise<void> {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(this.accessToken);
    }
    if (window.gapi?.client) {
      window.gapi.client.setToken(null);
    }
    this.accessToken = '';
    this.tokenExpiresAt = 0;
    this.isAuthenticated = false;
  }
}
