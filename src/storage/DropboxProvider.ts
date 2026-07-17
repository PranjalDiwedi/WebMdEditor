import { StorageProvider } from './StorageProvider';
import type { StorageFile } from '../types/storage';
import { OAUTH_CONFIGS } from '../config/constants';
import { isMarkdownFile } from '../utils/fileValidation';
import { Dropbox } from 'dropbox';

export class DropboxProvider extends StorageProvider {
  name = 'Dropbox';
  type = 'dropbox' as const;
  private dropbox: Dropbox | null = null;

  async authenticate(): Promise<void> {
    // For Dropbox, we need to redirect to their OAuth page
    const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
    authUrl.searchParams.append('client_id', OAUTH_CONFIGS.dropbox.clientId);
    authUrl.searchParams.append('redirect_uri', OAUTH_CONFIGS.dropbox.redirectUri);
    authUrl.searchParams.append('response_type', 'token');
    authUrl.searchParams.append('token_access_type', 'offline');
    authUrl.searchParams.append('scope', OAUTH_CONFIGS.dropbox.scopes.join(' '));

    // Store the state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('dropbox_oauth_state', state);
    authUrl.searchParams.append('state', state);

    window.location.href = authUrl.toString();
    
    // This will never resolve due to redirect, but TypeScript needs a return
    throw new Error('Redirecting to Dropbox OAuth...');
  }

  // Call this after OAuth callback
  async completeAuthentication(accessToken: string): Promise<void> {
    this.dropbox = new Dropbox({ accessToken });
    this.isAuthenticated = true;
  }

  async listFiles(): Promise<StorageFile[]> {
    if (!this.isAuthenticated || !this.dropbox) {
      throw new Error('Not authenticated with Dropbox');
    }

    try {
      const response = await this.dropbox.filesListFolder({ path: '' });
      const files = response.result.entries;

      return files
        .filter((file: any) => file['.tag'] === 'file' && isMarkdownFile(file.name))
        .map((file: any) => this.convertToStorageFile(
          file.id,
          file.name,
          '', // Content loaded on demand
          file.path_lower || '/',
          new Date(file.server_modified),
          file.size || 0
        ));
    } catch (error) {
      throw new Error(`Failed to list Dropbox files: ${error}`);
    }
  }

  async readFile(fileId: string): Promise<string> {
    if (!this.isAuthenticated || !this.dropbox) {
      throw new Error('Not authenticated with Dropbox');
    }

    try {
      const response = await this.dropbox.filesDownload({ path: fileId });
      const fileBlob = (response.result as any).fileBlob;
      return await fileBlob.text();
    } catch (error) {
      throw new Error(`Failed to read Dropbox file: ${error}`);
    }
  }

  async writeFile(fileId: string, content: string): Promise<void> {
    if (!this.isAuthenticated || !this.dropbox) {
      throw new Error('Not authenticated with Dropbox');
    }

    try {
      await this.dropbox.filesUpload({
        path: fileId,
        contents: content,
        mode: { '.tag': 'overwrite' }
      });
    } catch (error) {
      throw new Error(`Failed to write Dropbox file: ${error}`);
    }
  }

  async createFile(name: string, content: string, path?: string): Promise<StorageFile> {
    if (!this.isAuthenticated || !this.dropbox) {
      throw new Error('Not authenticated with Dropbox');
    }

    try {
      const fullPath = path ? `${path}/${name}` : `/${name}`;
      const response = await this.dropbox.filesUpload({
        path: fullPath,
        contents: content,
        mode: { '.tag': 'add' }
      });

      return this.convertToStorageFile(
        response.result.id,
        response.result.name,
        content,
        response.result.path_lower || '/',
        new Date(response.result.server_modified),
        response.result.size || content.length
      );
    } catch (error) {
      throw new Error(`Failed to create Dropbox file: ${error}`);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.isAuthenticated || !this.dropbox) {
      throw new Error('Not authenticated with Dropbox');
    }

    try {
      await this.dropbox.filesDeleteV2({ path: fileId });
    } catch (error) {
      throw new Error(`Failed to delete Dropbox file: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.dropbox = null;
    this.isAuthenticated = false;
  }
}