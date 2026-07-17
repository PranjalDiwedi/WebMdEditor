export interface StorageFile {
  id: string;
  name: string;
  path: string;
  content: string;
  modifiedAt: Date;
  size: number;
  provider: 'google-drive' | 'dropbox' | 'onedrive' | 'local';
}

export interface StorageProvider {
  name: string;
  type: 'google-drive' | 'dropbox' | 'onedrive' | 'local';
  isAuthenticated: boolean;
  authenticate(): Promise<void>;
  listFiles(): Promise<StorageFile[]>;
  readFile(fileId: string): Promise<string>;
  writeFile(fileId: string, content: string): Promise<void>;
  createFile(name: string, content: string, path?: string): Promise<StorageFile>;
  deleteFile(fileId: string): Promise<void>;
  disconnect(): Promise<void>;
}

export interface FileMetadata {
  id: string;
  name: string;
  path: string;
  modifiedAt: Date;
  size: number;
}