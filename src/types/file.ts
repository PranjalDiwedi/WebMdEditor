export interface MarkdownFile {
  id: string;
  name: string;
  content: string;
  path: string;
  provider: 'google-drive' | 'dropbox' | 'onedrive' | 'local' | 'github';
  modifiedAt: Date;
  createdAt: Date;
  size: number;
  isDirty: boolean;
  savedContent?: string;
  isPinned?: boolean;
  isMoving?: boolean;
  preview?: string;
}

export interface FileState {
  currentFile: MarkdownFile | null;
  openTabs: MarkdownFile[];
  activeTabId: string | null;
  recentFiles: MarkdownFile[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
}

export interface FileOperations {
  openFile(fileId: string): Promise<void>;
  saveFile(commitMessage?: string): Promise<void>;
  createFile(name: string, content: string, path?: string, commitMessage?: string): Promise<void>;
  deleteFile(fileId: string, commitMessage?: string): Promise<void>;
  renameFile(fileId: string, newName: string): Promise<void>;
  closeTab(fileId: string): void;
  closeOtherTabs(fileId: string): void;
  closeAllTabs(): void;
  setActiveTab(fileId: string): void;
  reorderTabs(startIndex: number, endIndex: number): void;
}