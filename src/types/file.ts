export interface MarkdownFile {
  id: string;
  name: string;
  content: string;
  path: string;
  provider: 'google-drive' | 'dropbox' | 'onedrive' | 'local';
  modifiedAt: Date;
  createdAt: Date;
  size: number;
  isDirty: boolean;
}

export interface FileState {
  currentFile: MarkdownFile | null;
  recentFiles: MarkdownFile[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
}

export interface FileOperations {
  openFile(fileId: string): Promise<void>;
  saveFile(): Promise<void>;
  createFile(name: string, content: string): Promise<void>;
  deleteFile(fileId: string): Promise<void>;
  renameFile(fileId: string, newName: string): Promise<void>;
}