import { StorageProvider } from './StorageProvider';
import type { StorageFile } from '../types/storage';
import { OAUTH_CONFIGS } from '../config/constants';
import { isMarkdownFile, ensureMarkdownFileName } from '../utils/fileValidation';
import { initDriveClient, loadGisClient } from '../utils/googleScripts';

function formatGoogleError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const err = error as {
      result?: { error?: { message?: string } };
      error?: { message?: string } | string;
      message?: string;
      status?: number;
      statusText?: string;
    };
    return (
      err.result?.error?.message ||
      (typeof err.error === 'object' ? err.error.message : err.error) ||
      err.message ||
      (err.status ? `HTTP ${err.status} ${err.statusText || ''}`.trim() : '') ||
      JSON.stringify(error)
    );
  }
  return String(error);
}

export class GoogleDriveProvider extends StorageProvider {
  name = 'Google Drive';
  type = 'google-drive' as const;
  private tokenClient: any = null;
  private accessToken: string = '';
  private folderId: string | null = null;
  private folderName = 'All Google Drive';

  setTargetFolder(folderId: string | null, folderName: string): void {
    this.folderId = folderId;
    this.folderName = folderName;
  }

  getTargetFolder(): { id: string | null; name: string } {
    return { id: this.folderId, name: this.folderName };
  }

  async listChildFolders(parentId: string = 'root'): Promise<Array<{ id: string; name: string }>> {
    this.ensureReady();

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
  }

  private isMarkdownDriveFile(file: { name: string; mimeType?: string }): boolean {
    return isMarkdownFile(file.name);
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

          this.accessToken = tokenResponse.access_token;
          window.gapi.client.setToken({ access_token: this.accessToken });
          this.isAuthenticated = true;
          resolve();
        },
        error_callback: (error: { type?: string; message?: string }) => {
          reject(
            new Error(
              error.message ||
                error.type ||
                'Google Drive popup was blocked or closed'
            )
          );
        },
      });

      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  private ensureReady(): void {
    if (!this.isAuthenticated || !this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }
    window.gapi.client.setToken({ access_token: this.accessToken });
  }

  async listFiles(): Promise<StorageFile[]> {
    this.ensureReady();

    try {
      if (this.folderId) {
        return this.listFilesInFolderRecursive(this.folderId);
      }
      return this.listAllMarkdownFiles();
    } catch (error) {
      throw new Error(`Failed to list Google Drive files: ${formatGoogleError(error)}`);
    }
  }

  private async listAllMarkdownFiles(): Promise<StorageFile[]> {
    const files: StorageFile[] = [];
    let pageToken: string | undefined;

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
      const response = await window.gapi.client.drive.files.list({
        q: query,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents)',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
        pageToken,
        spaces: 'drive',
      });

      for (const file of response.result.files || []) {
        if (this.isMarkdownDriveFile(file)) {
          files.push(
            this.convertToStorageFile(
              file.id,
              file.name,
              '',
              file.parents?.[0] || '/',
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

  private async listFilesInFolderRecursive(folderId: string): Promise<StorageFile[]> {
    const files: StorageFile[] = [];
    const folderQueue = [folderId];

    while (folderQueue.length > 0) {
      const currentFolderId = folderQueue.shift()!;
      let pageToken: string | undefined;

      do {
        const response = await window.gapi.client.drive.files.list({
          q: `'${currentFolderId}' in parents and trashed=false`,
          fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents)',
          orderBy: 'name',
          pageSize: 100,
          pageToken,
        });

        for (const file of response.result.files || []) {
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            folderQueue.push(file.id);
          } else if (this.isMarkdownDriveFile(file)) {
            files.push(
              this.convertToStorageFile(
                file.id,
                file.name,
                '',
                file.parents?.[0] || currentFolderId,
                new Date(file.modifiedTime),
                parseInt(file.size || '0', 10) || 0
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
    this.ensureReady();

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(
          details?.error?.message || `Failed to read file (${response.status})`
        );
      }

      return await response.text();
    } catch (error) {
      throw new Error(`Failed to read Google Drive file: ${formatGoogleError(error)}`);
    }
  }

  async writeFile(fileId: string, content: string): Promise<void> {
    this.ensureReady();

    try {
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
        const details = await response.json().catch(() => null);
        throw new Error(
          details?.error?.message || `Upload failed (${response.status})`
        );
      }
    } catch (error) {
      throw new Error(`Failed to write Google Drive file: ${formatGoogleError(error)}`);
    }
  }

  async createFile(name: string, content: string, path?: string): Promise<StorageFile> {
    this.ensureReady();

    const fileName = ensureMarkdownFileName(name);

    try {
      const metadata: { name: string; mimeType: string; parents?: string[] } = {
        name: fileName,
        mimeType: 'text/markdown',
      };
      const parentId = path || this.folderId;
      if (parentId) {
        metadata.parents = [parentId];
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
        const details = await response.json().catch(() => null);
        throw new Error(
          details?.error?.message || `Create failed (${response.status})`
        );
      }

      const result = await response.json();
      return this.convertToStorageFile(
        result.id,
        result.name || fileName,
        content,
        path || this.folderId || '/',
        result.modifiedTime ? new Date(result.modifiedTime) : new Date(),
        Number(result.size) || content.length
      );
    } catch (error) {
      throw new Error(`Failed to create Google Drive file: ${formatGoogleError(error)}`);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    this.ensureReady();

    try {
      await window.gapi.client.drive.files.delete({ fileId });
    } catch (error) {
      throw new Error(`Failed to delete Google Drive file: ${formatGoogleError(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.tokenClient) {
      window.google.accounts.oauth2.revoke(this.accessToken);
    }
    if (window.gapi?.client) {
      window.gapi.client.setToken(null);
    }
    this.accessToken = '';
    this.isAuthenticated = false;
  }
}
