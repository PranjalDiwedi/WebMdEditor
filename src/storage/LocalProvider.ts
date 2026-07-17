import { StorageProvider } from './StorageProvider';
import type { StorageFile } from '../types/storage';
import { isMarkdownFile, ensureMarkdownFileName } from '../utils/fileValidation';

const MARKDOWN_PICKER_TYPES = [
  {
    description: 'Markdown files',
    accept: {
      'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'],
      'text/plain': ['.md', '.markdown', '.mdown', '.mkd'],
    },
  },
];

export class LocalProvider extends StorageProvider {
  name = 'Local Files';
  type = 'local' as const;
  private fileHandles: Map<string, FileSystemFileHandle> = new Map();
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  async authenticate(): Promise<void> {
    if (!('showOpenFilePicker' in window)) {
      throw new Error(
        'Local file picking is not supported in this browser. Use Chrome or Edge.'
      );
    }

    try {
      const handles: FileSystemFileHandle[] = await (
        window as Window & {
          showOpenFilePicker: (options: unknown) => Promise<FileSystemFileHandle[]>;
        }
      ).showOpenFilePicker({
        multiple: true,
        excludeAcceptAllOption: false,
        types: MARKDOWN_PICKER_TYPES,
      });

      this.fileHandles.clear();
      this.directoryHandle = null;

      for (const handle of handles) {
        if (!isMarkdownFile(handle.name)) {
          continue;
        }
        this.fileHandles.set(this.generateFileId(handle.name), handle);
      }

      if (this.fileHandles.size === 0) {
        throw new Error('Please select one or more markdown (.md) files');
      }

      this.isAuthenticated = true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('File selection cancelled');
      }
      if (error instanceof Error && error.message.startsWith('Please select')) {
        throw error;
      }
      if (error instanceof Error && error.message === 'File selection cancelled') {
        throw error;
      }
      throw new Error(
        `Local file access failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async listFiles(): Promise<StorageFile[]> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with local file system');
    }

    try {
      if (this.directoryHandle) {
        return this.listDirectoryFiles();
      }

      const files: StorageFile[] = [];
      for (const [fileId, handle] of this.fileHandles.entries()) {
        const file = await handle.getFile();
        files.push(
          this.convertToStorageFile(
            fileId,
            handle.name,
            '',
            handle.name,
            new Date(file.lastModified),
            file.size
          )
        );
      }
      return files;
    } catch (error) {
      throw new Error(`Failed to list local files: ${error}`);
    }
  }

  private async listDirectoryFiles(): Promise<StorageFile[]> {
    if (!this.directoryHandle) {
      return [];
    }

    const files: StorageFile[] = [];
    const nextHandles = new Map<string, FileSystemFileHandle>();

    for await (const entry of this.directoryHandle.values()) {
      if (entry.kind === 'file' && isMarkdownFile(entry.name)) {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const fileId = this.generateFileId(entry.name);
        nextHandles.set(fileId, fileHandle);
        files.push(
          this.convertToStorageFile(
            fileId,
            entry.name,
            '',
            entry.name,
            new Date(file.lastModified),
            file.size
          )
        );
      }
    }

    this.fileHandles = nextHandles;
    return files;
  }

  async readFile(fileId: string): Promise<string> {
    const handle = this.fileHandles.get(fileId);
    if (!handle) {
      throw new Error('File handle not found');
    }

    try {
      const file = await handle.getFile();
      return await file.text();
    } catch (error) {
      throw new Error(`Failed to read local file: ${error}`);
    }
  }

  async writeFile(fileId: string, content: string): Promise<void> {
    const handle = this.fileHandles.get(fileId);
    if (!handle) {
      throw new Error('File handle not found');
    }

    try {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (error) {
      throw new Error(`Failed to write local file: ${error}`);
    }
  }

  async createFile(name: string, content: string, path?: string): Promise<StorageFile> {
    const safeName = ensureMarkdownFileName(name);

    try {
      let fileHandle: FileSystemFileHandle;

      if (this.directoryHandle) {
        fileHandle = await this.directoryHandle.getFileHandle(safeName, { create: true });
      } else if ('showSaveFilePicker' in window) {
        fileHandle = await (
          window as Window & {
            showSaveFilePicker: (options: unknown) => Promise<FileSystemFileHandle>;
          }
        ).showSaveFilePicker({
          suggestedName: safeName,
          types: MARKDOWN_PICKER_TYPES,
        });

        // User may rename in the dialog — force a markdown extension
        if (!isMarkdownFile(fileHandle.name)) {
          throw new Error('Please save the file with a .md extension');
        }
      } else {
        throw new Error('Creating files is not supported in this browser');
      }

      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      const fileId = this.generateFileId(fileHandle.name);
      this.fileHandles.set(fileId, fileHandle);

      const file = await fileHandle.getFile();
      return this.convertToStorageFile(
        fileId,
        fileHandle.name,
        content,
        path || fileHandle.name,
        new Date(file.lastModified),
        file.size
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Save cancelled');
      }
      if (error instanceof Error && error.message.includes('.md extension')) {
        throw error;
      }
      throw new Error(`Failed to create local file: ${error}`);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    const handle = this.fileHandles.get(fileId);
    if (!handle) {
      throw new Error('File handle not found');
    }

    try {
      if (this.directoryHandle) {
        await this.directoryHandle.removeEntry(handle.name);
      }
      this.fileHandles.delete(fileId);
    } catch (error) {
      throw new Error(`Failed to delete local file: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.fileHandles.clear();
    this.directoryHandle = null;
    this.isAuthenticated = false;
  }

  private generateFileId(fileName: string): string {
    return `local_${fileName}`;
  }
}
