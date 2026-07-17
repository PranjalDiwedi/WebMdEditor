import type { StorageProvider as IStorageProvider, StorageFile } from '../types/storage';

export abstract class StorageProvider implements IStorageProvider {
  abstract name: string;
  abstract type: 'google-drive' | 'dropbox' | 'onedrive' | 'local';
  isAuthenticated: boolean = false;

  abstract authenticate(): Promise<void>;
  abstract listFiles(): Promise<StorageFile[]>;
  abstract readFile(fileId: string): Promise<string>;
  abstract writeFile(fileId: string, content: string): Promise<void>;
  abstract createFile(name: string, content: string, path?: string): Promise<StorageFile>;
  abstract deleteFile(fileId: string): Promise<void>;
  abstract disconnect(): Promise<void>;

  protected convertToStorageFile(
    id: string, 
    name: string, 
    content: string, 
    path: string, 
    modifiedAt: Date, 
    size: number
  ): StorageFile {
    return {
      id,
      name,
      path,
      content,
      modifiedAt,
      size,
      provider: this.type
    };
  }
}