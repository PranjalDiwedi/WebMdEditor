export interface StorageFile {
  id: string;
  name: string;
  path: string;
  content: string;
  modifiedAt: Date;
  size: number;
  provider: 'google-drive' | 'dropbox' | 'onedrive' | 'local' | 'github';
}

export interface StorageProvider {
  name: string;
  type: 'google-drive' | 'dropbox' | 'onedrive' | 'local' | 'github';
  isAuthenticated: boolean;
  authenticate(config?: unknown): Promise<void>;
  listFiles(): Promise<StorageFile[]>;
  readFile(fileId: string): Promise<string>;
  writeFile(fileId: string, content: string, commitMessage?: string): Promise<void>;
  createFile(name: string, content: string, path?: string, commitMessage?: string): Promise<StorageFile>;
  deleteFile(fileId: string, commitMessage?: string): Promise<void>;
  renameFile?(fileId: string, newName: string): Promise<void>;
  moveFile?(fileId: string, newPath: string, parentFolderId?: string): Promise<void>;
  disconnect(): Promise<void>;
}

export interface FileMetadata {
  id: string;
  name: string;
  path: string;
  modifiedAt: Date;
  size: number;
}