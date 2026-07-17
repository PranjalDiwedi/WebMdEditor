import { StorageProvider } from './StorageProvider';
import type { StorageFile } from '../types/storage';
import { OAUTH_CONFIGS } from '../config/constants';
import { isMarkdownFile, ensureMarkdownFileName, validateFileName } from '../utils/fileValidation';
import { PublicClientApplication } from '@azure/msal-browser';
import { Client } from '@microsoft/microsoft-graph-client';

export class OneDriveProvider extends StorageProvider {
  name = 'OneDrive';
  type = 'onedrive' as const;
  private msalInstance: PublicClientApplication | null = null;
  private graphClient: Client | null = null;
  private accessToken: string = '';

  async authenticate(): Promise<void> {
    const msalConfig = {
      auth: {
        clientId: OAUTH_CONFIGS.onedrive.clientId,
        redirectUri: OAUTH_CONFIGS.onedrive.redirectUri,
        authority: 'https://login.microsoftonline.com/common'
      }
    };

    this.msalInstance = new PublicClientApplication(msalConfig);
    
    try {
      await this.msalInstance.initialize();
      const loginResponse = await this.msalInstance.loginPopup({
        scopes: OAUTH_CONFIGS.onedrive.scopes
      });

      this.accessToken = loginResponse.accessToken;
      
      // Initialize Graph Client
      this.graphClient = Client.init({
        authProvider: (done) => {
          done(null, this.accessToken);
        }
      });

      this.isAuthenticated = true;
    } catch (error) {
      throw new Error(`OneDrive authentication failed: ${error}`);
    }
  }

  async listFiles(): Promise<StorageFile[]> {
    if (!this.isAuthenticated || !this.graphClient) {
      throw new Error('Not authenticated with OneDrive');
    }

    try {
      const response = await this.graphClient!.api('/me/drive/root/children')
        .filter("file ne null and (file/mimeType eq 'text/markdown' or endswith(name,'.md'))")
        .select('id,name,lastModifiedDateTime,size,parentReference')
        .get();

      const files = response.value || [];
      return files
        .filter((file: any) => isMarkdownFile(file.name))
        .map((file: any) => this.convertToStorageFile(
          file.id,
          file.name,
          '', // Content loaded on demand
          file.parentReference?.path || '/',
          new Date(file.lastModifiedDateTime),
          file.size || 0
        ));
    } catch (error) {
      throw new Error(`Failed to list OneDrive files: ${error}`);
    }
  }

  async readFile(fileId: string): Promise<string> {
    if (!this.isAuthenticated || !this.graphClient) {
      throw new Error('Not authenticated with OneDrive');
    }

    try {
      const response = await this.graphClient!.api(`/me/drive/items/${fileId}/content`)
        .get();
      return response;
    } catch (error) {
      throw new Error(`Failed to read OneDrive file: ${error}`);
    }
  }

  async writeFile(fileId: string, content: string): Promise<void> {
    if (!this.isAuthenticated || !this.graphClient) {
      throw new Error('Not authenticated with OneDrive');
    }

    try {
      await this.graphClient!.api(`/me/drive/items/${fileId}/content`)
        .put(content);
    } catch (error) {
      throw new Error(`Failed to write OneDrive file: ${error}`);
    }
  }

  async createFile(name: string, content: string, path?: string): Promise<StorageFile> {
    if (!this.isAuthenticated || !this.graphClient) {
      throw new Error('Not authenticated with OneDrive');
    }

    const validation = validateFileName(name);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid file name');
    }
    const fileName = ensureMarkdownFileName(name);

    try {
      const item = {
        name: fileName,
        file: {},
        '@microsoft.graph.conflictBehavior': 'rename'
      };

      const parentPath = path ? path : '/me/drive/root';
      const response = await this.graphClient!.api(`${parentPath}:/children`)
        .post(item);

      const fileId = response.id;
      await this.writeFile(fileId, content);

      return this.convertToStorageFile(
        fileId,
        fileName,
        content,
        path || '/',
        new Date(),
        content.length
      );
    } catch (error) {
      throw new Error(`Failed to create OneDrive file: ${error}`);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.isAuthenticated || !this.graphClient) {
      throw new Error('Not authenticated with OneDrive');
    }

    try {
      await this.graphClient!.api(`/me/drive/items/${fileId}`)
        .delete();
    } catch (error) {
      throw new Error(`Failed to delete OneDrive file: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.msalInstance) {
      await this.msalInstance.logoutPopup();
      this.accessToken = '';
      this.graphClient = null;
      this.isAuthenticated = false;
    }
  }
}