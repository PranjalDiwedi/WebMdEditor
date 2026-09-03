import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { MarkdownFile } from '../types/file';
import { formatFileSize } from '../utils/fileValidation';
import { stripMarkdown } from '../utils/markdownParser';

export type NavMode = 'folders' | 'timeline';
export type ViewDensity = 'cards' | 'compact';
export type FilterTab = 'all' | 'pinned' | 'recent';
export type SortOption = 'modified-desc' | 'modified-asc' | 'title-asc' | 'title-desc' | 'size-desc';

interface FileBrowserProps {
  files: MarkdownFile[];
  currentFile: MarkdownFile | null;
  onFileSelect: (fileId: string) => void;
  onCreateFile: (folderPath?: string) => void;
  onCreateFolder?: (parentPath?: string) => void;
  onDuplicateFile?: (fileId: string) => void;
  onTogglePin?: (fileId: string) => void;
  onMoveFile?: (fileId: string, destinationFolderPath: string) => void;
  onMoveFolder?: (sourceFolderPath: string, destinationFolderPath: string) => void;
  onOpenMoveModal?: (file: MarkdownFile) => void;
  onDeleteFile?: (fileId: string, fileName: string, e: React.MouseEvent) => void;
  onToggleSidebar?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  storageName?: string;
  customFolders?: string[];
  isLoading?: boolean;
}

// Tree node definition
interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  file?: MarkdownFile;
  children: TreeNode[];
  itemCount: number;
}

function formatRelativeTime(dateInput: Date | string | number | undefined | null): string {
  if (!dateInput) return 'Recently';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0 || diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Builds hierarchical tree from flat file list and custom folders
function buildFileTree(files: MarkdownFile[], customFolders: string[] = []): TreeNode[] {
  const rootNodes: TreeNode[] = [];
  const folderMap = new Map<string, TreeNode>();

  function getOrCreateFolder(parts: string[]): TreeNode {
    const fullPath = parts.join('/');
    if (folderMap.has(fullPath)) {
      return folderMap.get(fullPath)!;
    }

    const folderName = parts[parts.length - 1];
    const newNode: TreeNode = {
      id: `folder:${fullPath}`,
      name: folderName,
      path: fullPath,
      type: 'folder',
      children: [],
      itemCount: 0,
    };
    folderMap.set(fullPath, newNode);

    if (parts.length === 1) {
      rootNodes.push(newNode);
    } else {
      const parentFolder = getOrCreateFolder(parts.slice(0, -1));
      if (!parentFolder.children.some((c) => c.id === newNode.id)) {
        parentFolder.children.push(newNode);
      }
    }

    return newNode;
  }

  // 1. Process custom / empty folders first
  for (const folder of customFolders) {
    const cleanFolder = folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!cleanFolder) continue;
    getOrCreateFolder(cleanFolder.split('/'));
  }

  // 2. Process all files
  for (const file of files) {
    const rawPath = file.path && file.path !== '/' && file.path !== '.' ? file.path : '';
    const cleanPath = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const parts = cleanPath ? cleanPath.split('/') : [];

    const folderParts = parts.length > 0 && parts[parts.length - 1].toLowerCase() === file.name.toLowerCase()
      ? parts.slice(0, -1)
      : parts;

    const fileNode: TreeNode = {
      id: file.id,
      name: file.name,
      path: file.path || file.name,
      type: 'file',
      file,
      children: [],
      itemCount: 1,
    };

    if (folderParts.length === 0) {
      rootNodes.push(fileNode);
    } else {
      const parent = getOrCreateFolder(folderParts);
      parent.children.push(fileNode);
    }
  }

  // Recursive item counter and sorter
  function processNode(node: TreeNode): number {
    if (node.type === 'file') return 1;
    let count = 0;
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      count += processNode(child);
    }
    node.itemCount = count;
    return count;
  }

  rootNodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const root of rootNodes) {
    processNode(root);
  }

  return rootNodes;
}

export function FileBrowser({
  files,
  currentFile,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onDuplicateFile,
  onTogglePin,
  onMoveFile,
  onMoveFolder,
  onOpenMoveModal,
  onDeleteFile,
  onToggleSidebar,
  searchQuery,
  onSearchChange,
  storageName,
  customFolders = [],
  isLoading = false,
}: FileBrowserProps) {
  const [navMode, setNavMode] = useState<NavMode>(() => {
    return (localStorage.getItem('mandrak_nav_mode') as NavMode) || 'folders';
  });
  const [density, setDensity] = useState<ViewDensity>(() => {
    return (localStorage.getItem('mandrak_nav_density') as ViewDensity) || 'cards';
  });
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [sortOption, setSortOption] = useState<SortOption>('modified-desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('mandrak_expanded_folders');
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Drag & Drop State
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [draggingItem, setDraggingItem] = useState<{ type: 'file' | 'folder'; id?: string; path: string } | null>(null);

  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('mandrak_nav_mode', navMode);
  }, [navMode]);

  useEffect(() => {
    localStorage.setItem('mandrak_nav_density', density);
  }, [density]);

  useEffect(() => {
    try {
      localStorage.setItem('mandrak_expanded_folders', JSON.stringify(Array.from(expandedFolders)));
    } catch {}
  }, [expandedFolders]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    if (showSortMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSortMenu]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const expandAllFolders = () => {
    const allPaths = new Set<string>();
    const collect = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          allPaths.add(n.path);
          collect(n.children);
        }
      }
    };
    collect(treeData);
    setExpandedFolders(allPaths);
  };

  const collapseAllFolders = () => {
    setExpandedFolders(new Set());
  };

  const filteredAndSortedFiles = useMemo(() => {
    let list = [...files];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter((file) => {
        const nameMatch = file.name.toLowerCase().includes(query);
        const contentMatch = stripMarkdown(file.content).toLowerCase().includes(query);
        const pathMatch = file.path?.toLowerCase().includes(query);
        return nameMatch || contentMatch || pathMatch;
      });
    }

    if (filterTab === 'pinned') {
      list = list.filter((f) => f.isPinned);
    } else if (filterTab === 'recent') {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      list = list.filter((f) => new Date(f.modifiedAt).getTime() >= sevenDaysAgo);
    }

    list.sort((a, b) => {
      if (a.isPinned !== b.isPinned && filterTab === 'all') {
        return a.isPinned ? -1 : 1;
      }

      switch (sortOption) {
        case 'modified-desc':
          return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
        case 'modified-asc':
          return new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
        case 'title-asc':
          return a.name.localeCompare(b.name, undefined, { numeric: true });
        case 'title-desc':
          return b.name.localeCompare(a.name, undefined, { numeric: true });
        case 'size-desc':
          return (b.size || 0) - (a.size || 0);
        default:
          return 0;
      }
    });

    return list;
  }, [files, searchQuery, filterTab, sortOption]);

  const treeData = useMemo(() => {
    return buildFileTree(filteredAndSortedFiles, customFolders);
  }, [filteredAndSortedFiles, customFolders]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const pathsToOpen = new Set<string>();
      const searchExpand = (nodes: TreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'folder') {
            pathsToOpen.add(node.path);
            searchExpand(node.children);
          }
        }
      };
      searchExpand(treeData);
      setExpandedFolders(pathsToOpen);
    }
  }, [searchQuery, treeData]);

  const timelineGroups = useMemo(() => {
    const pinned: MarkdownFile[] = [];
    const today: MarkdownFile[] = [];
    const last7Days: MarkdownFile[] = [];
    const last30Days: MarkdownFile[] = [];
    const older: MarkdownFile[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = todayStart - 6 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = todayStart - 29 * 24 * 60 * 60 * 1000;

    for (const file of filteredAndSortedFiles) {
      if (file.isPinned && filterTab === 'all') {
        pinned.push(file);
        continue;
      }

      const modTime = new Date(file.modifiedAt).getTime();
      if (modTime >= todayStart) {
        today.push(file);
      } else if (modTime >= sevenDaysAgo) {
        last7Days.push(file);
      } else if (modTime >= thirtyDaysAgo) {
        last30Days.push(file);
      } else {
        older.push(file);
      }
    }

    return [
      { id: 'pinned', title: 'Pinned 📌', files: pinned },
      { id: 'today', title: 'Today', files: today },
      { id: 'last7', title: 'Previous 7 Days', files: last7Days },
      { id: 'last30', title: 'Previous 30 Days', files: last30Days },
      { id: 'older', title: 'Older', files: older },
    ].filter((group) => group.files.length > 0);
  }, [filteredAndSortedFiles, filterTab]);

  // Drag handlers for files
  const handleFileDragStart = (e: React.DragEvent, file: MarkdownFile) => {
    e.stopPropagation();
    setDraggingItem({ type: 'file', id: file.id, path: file.path });
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ type: 'file', id: file.id, name: file.name, path: file.path })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingItem(null);
    setDragOverTarget(null);
  };

  // Render a Single Note Card / Compact Row
  const renderNoteItem = (file: MarkdownFile, isInsideTree = false) => {
    const isActive = currentFile?.id === file.id;
    const isDragging = draggingItem?.id === file.id;
    const previewText = stripMarkdown(file.content) || 'Empty note...';
    const displayName = file.name.replace(/\.md$/i, '');

    if (density === 'compact') {
      return (
        <div
          key={file.id}
          draggable
          onDragStart={(e) => handleFileDragStart(e, file)}
          onDragEnd={handleDragEnd}
          className={`compact-file-row ${isActive ? 'active' : ''} ${isInsideTree ? 'tree-nested-item' : ''} ${isDragging ? 'dragging-item' : ''}`}
          onClick={() => onFileSelect(file.id)}
          title={`${file.name} (Drag to move)`}
        >
          <div className="compact-file-left">
            <svg className="compact-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="compact-file-title">{displayName}</span>
            {file.isMoving && <span className="file-moving-badge" title="Moving to new folder...">Moving...</span>}
            {file.isDirty && <span className="unsaved-dot" title="Unsaved changes" />}
          </div>

          <div className="compact-file-right">
            <span className="compact-file-time">{formatRelativeTime(file.modifiedAt)}</span>
            <div className="file-row-actions" onClick={(e) => e.stopPropagation()}>
              {onTogglePin && (
                <button
                  type="button"
                  className={`row-action-btn ${file.isPinned ? 'pinned' : ''}`}
                  onClick={() => onTogglePin(file.id)}
                  title={file.isPinned ? 'Unpin note' : 'Pin note to top'}
                >
                  📌
                </button>
              )}
              {onOpenMoveModal && (
                <button
                  type="button"
                  className="row-action-btn"
                  onClick={() => onOpenMoveModal(file)}
                  title="Move note to folder..."
                  aria-label="Move note to folder"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </button>
              )}
              {onDuplicateFile && (
                <button
                  type="button"
                  className="row-action-btn"
                  onClick={() => onDuplicateFile(file.id)}
                  title="Duplicate note"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              )}
              {onDeleteFile && (
                <button
                  type="button"
                  className="row-action-btn delete"
                  onClick={(e) => onDeleteFile(file.id, file.name, e)}
                  title="Delete note"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={file.id}
        draggable
        onDragStart={(e) => handleFileDragStart(e, file)}
        onDragEnd={handleDragEnd}
        className={`file-item-card ${isActive ? 'active' : ''} ${isInsideTree ? 'tree-card' : ''} ${isDragging ? 'dragging-item' : ''}`}
        onClick={() => onFileSelect(file.id)}
      >
        <div className="file-card-header">
          <div className="file-card-title-group">
            {file.isPinned && <span className="pin-badge" title="Pinned Note">📌</span>}
            <span className="file-card-title">{displayName}</span>
            {file.isMoving && <span className="file-moving-badge" title="Moving to new folder...">Moving...</span>}
          </div>
          <span className="file-card-time">{formatRelativeTime(file.modifiedAt)}</span>
        </div>

        <div className="file-card-preview">{previewText}</div>

        <div className="file-card-footer">
          <span className="file-card-size">{formatFileSize(file.size)}</span>

          <div className="file-card-actions" onClick={(e) => e.stopPropagation()}>
            {file.isDirty && (
              <span className="unsaved-dot" title="Unsaved changes" />
            )}
            {onTogglePin && (
              <button
                type="button"
                className={`card-action-btn ${file.isPinned ? 'active' : ''}`}
                onClick={() => onTogglePin(file.id)}
                title={file.isPinned ? 'Unpin note' : 'Pin note to top'}
              >
                📌
              </button>
            )}
            {onOpenMoveModal && (
              <button
                type="button"
                className="card-action-btn"
                onClick={() => onOpenMoveModal(file)}
                title="Move note to folder..."
                aria-label="Move note to folder"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>
            )}
            {onDuplicateFile && (
              <button
                type="button"
                className="card-action-btn"
                onClick={() => onDuplicateFile(file.id)}
                title="Duplicate note"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            {onDeleteFile && (
              <button
                type="button"
                className="card-action-btn delete"
                title={`Delete "${file.name}"`}
                aria-label={`Delete ${file.name}`}
                onClick={(e) => onDeleteFile(file.id, file.name, e)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: TreeNode, depth = 0) => {
    if (node.type === 'file' && node.file) {
      return (
        <div key={node.id} style={{ paddingLeft: `${depth * 14}px` }}>
          {renderNoteItem(node.file, true)}
        </div>
      );
    }

    const isExpanded = expandedFolders.has(node.path);
    const isTargetActive = dragOverTarget === node.path;
    const isDraggingFolder = draggingItem?.type === 'folder' && draggingItem.path === node.path;

    const handleFolderDragStart = (e: React.DragEvent) => {
      e.stopPropagation();
      setDraggingItem({ type: 'folder', path: node.path });
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({ type: 'folder', path: node.path, name: node.name })
      );
      e.dataTransfer.effectAllowed = 'move';
    };

    const handleFolderDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Block cycle drops (dropping parent into own child)
      if (
        draggingItem?.type === 'folder' &&
        (draggingItem.path === node.path || node.path.startsWith(`${draggingItem.path}/`))
      ) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }
      e.dataTransfer.dropEffect = 'move';
    };

    const handleFolderDragEnter = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (
        draggingItem?.type === 'folder' &&
        (draggingItem.path === node.path || node.path.startsWith(`${draggingItem.path}/`))
      ) {
        return;
      }
      setDragOverTarget(node.path);
    };

    const handleFolderDragLeave = (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      if (dragOverTarget === node.path) {
        setDragOverTarget(null);
      }
    };

    const handleFolderDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverTarget(null);
      setDraggingItem(null);

      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json') || '{}');
        if (data.type === 'file' && onMoveFile) {
          onMoveFile(data.id, node.path);
        } else if (data.type === 'folder' && onMoveFolder) {
          if (data.path !== node.path && !node.path.startsWith(`${data.path}/`)) {
            onMoveFolder(data.path, node.path);
          }
        }
      } catch {}
    };

    return (
      <div key={node.id} className="tree-folder-group">
        <div
          draggable
          onDragStart={handleFolderDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleFolderDragOver}
          onDragEnter={handleFolderDragEnter}
          onDragLeave={handleFolderDragLeave}
          onDrop={handleFolderDrop}
          className={`tree-folder-row ${isExpanded ? 'expanded' : ''} ${isTargetActive ? 'drop-target-active' : ''} ${isDraggingFolder ? 'dragging-item' : ''}`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => toggleFolder(node.path)}
        >
          <div className="tree-folder-left">
            <span className={`folder-chevron ${isExpanded ? 'open' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </span>
            <span className="folder-icon">{isExpanded ? '📂' : '📁'}</span>
            <span className="folder-name">{node.name}</span>
            <span className="folder-count-badge">{node.itemCount}</span>
          </div>

          <div className="tree-folder-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="tree-action-btn"
              onClick={() => onCreateFile(node.path)}
              title={`New Note in "${node.name}"`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            {onCreateFolder && (
              <button
                type="button"
                className="tree-action-btn"
                onClick={() => onCreateFolder(node.path)}
                title={`New Subfolder in "${node.name}"`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="tree-folder-children">
            {node.children.length === 0 ? (
              <div
                className="tree-empty-folder-hint"
                onClick={() => onCreateFile(node.path)}
                title="Click to create a note here, or drag and drop a note here"
              >
                <span>+ Create first note (or drop here)</span>
              </div>
            ) : (
              node.children.map((child) => renderTreeNode(child, depth + 1))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`file-browser density-${density} mode-${navMode}`}>
      {/* 1. Header Toolbar */}
      <div className="sidebar-header">
        <div className="sidebar-title-group">
          <span>{storageName || 'Notes'}</span>
          <span className="sidebar-count-badge">{files.length}</span>
        </div>

        <div className="sidebar-header-actions">
          <button
            type="button"
            className="sidebar-header-action-btn"
            onClick={() => onCreateFile()}
            title="New Note in Root (⌘N)"
            aria-label="New Note in Root"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          {onCreateFolder && (
            <button
              type="button"
              className="sidebar-header-action-btn"
              onClick={() => onCreateFolder()}
              title="New Folder in Root"
              aria-label="New Folder in Root"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </button>
          )}

          {onToggleSidebar && (
            <button
              type="button"
              className="sidebar-header-action-btn sidebar-collapse-btn"
              onClick={onToggleSidebar}
              title="Collapse sidebar (⌘B)"
              aria-label="Collapse sidebar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation Mode Switcher: Folders vs Timeline */}
      <div className="sidebar-mode-switcher-bar">
        <div className="sidebar-mode-segmented">
          <button
            type="button"
            className={`mode-tab-btn ${navMode === 'folders' ? 'active' : ''}`}
            onClick={() => setNavMode('folders')}
            title="Folder Tree View"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>Folders</span>
          </button>
          <button
            type="button"
            className={`mode-tab-btn ${navMode === 'timeline' ? 'active' : ''}`}
            onClick={() => setNavMode('timeline')}
            title="Timeline Recents Feed"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Timeline</span>
          </button>
        </div>

        {/* View Density & Quick Actions */}
        <div className="sidebar-aux-tools">
          {navMode === 'folders' ? (
            <button
              type="button"
              className="aux-icon-btn"
              onClick={expandedFolders.size > 0 ? collapseAllFolders : expandAllFolders}
              title={expandedFolders.size > 0 ? 'Collapse all folders' : 'Expand all folders'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </button>
          ) : (
            <div className="sort-menu-container" ref={sortMenuRef}>
              <button
                type="button"
                className="aux-icon-btn"
                onClick={() => setShowSortMenu(!showSortMenu)}
                title="Sort notes"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              </button>

              {showSortMenu && (
                <div className="sort-dropdown-menu">
                  <button
                    type="button"
                    className={`sort-menu-item ${sortOption === 'modified-desc' ? 'active' : ''}`}
                    onClick={() => { setSortOption('modified-desc'); setShowSortMenu(false); }}
                  >
                    <span>Date Modified (Newest)</span>
                  </button>
                  <button
                    type="button"
                    className={`sort-menu-item ${sortOption === 'modified-asc' ? 'active' : ''}`}
                    onClick={() => { setSortOption('modified-asc'); setShowSortMenu(false); }}
                  >
                    <span>Date Modified (Oldest)</span>
                  </button>
                  <button
                    type="button"
                    className={`sort-menu-item ${sortOption === 'title-asc' ? 'active' : ''}`}
                    onClick={() => { setSortOption('title-asc'); setShowSortMenu(false); }}
                  >
                    <span>Title (A → Z)</span>
                  </button>
                  <button
                    type="button"
                    className={`sort-menu-item ${sortOption === 'title-desc' ? 'active' : ''}`}
                    onClick={() => { setSortOption('title-desc'); setShowSortMenu(false); }}
                  >
                    <span>Title (Z → A)</span>
                  </button>
                  <button
                    type="button"
                    className={`sort-menu-item ${sortOption === 'size-desc' ? 'active' : ''}`}
                    onClick={() => { setSortOption('size-desc'); setShowSortMenu(false); }}
                  >
                    <span>File Size</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="aux-icon-btn"
            onClick={() => setDensity(density === 'cards' ? 'compact' : 'cards')}
            title={`Switch to ${density === 'cards' ? 'Compact List' : 'Detailed Cards'} view`}
          >
            {density === 'cards' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h14a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 3. Search Bar */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder={navMode === 'folders' ? 'Search files & folders...' : 'Search notes...'}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery ? (
            <button
              className="search-clear-btn"
              onClick={() => onSearchChange('')}
              title="Clear search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <span className="search-shortcut-badge">⌘K</span>
          )}
        </div>
      </div>

      {/* 4. Quick Filter Chips (All, Pinned, Recent) */}
      <div className="sidebar-filter-pills">
        <button
          type="button"
          className={`filter-pill ${filterTab === 'all' ? 'active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          All ({files.length})
        </button>
        <button
          type="button"
          className={`filter-pill ${filterTab === 'pinned' ? 'active' : ''}`}
          onClick={() => setFilterTab('pinned')}
        >
          📌 Pinned ({files.filter((f) => f.isPinned).length})
        </button>
        <button
          type="button"
          className={`filter-pill ${filterTab === 'recent' ? 'active' : ''}`}
          onClick={() => setFilterTab('recent')}
        >
          ⚡ Recent
        </button>
      </div>

      {/* 5. Main Content Area: Folders vs Timeline */}
      <div className="file-list-scrollable">
        {isLoading && filteredAndSortedFiles.length === 0 && customFolders.length === 0 ? (
          <div className="sidebar-skeleton-container" aria-busy="true" aria-label="Loading workspace notes">
            {/* Shimmering Root Header */}
            <div className="skeleton-item skeleton-root-banner">
              <div className="skeleton-box skeleton-icon" />
              <div className="skeleton-box skeleton-text" style={{ width: '55%' }} />
            </div>

            {/* Shimmering Folder Row 1 */}
            <div className="skeleton-item skeleton-folder-row">
              <div className="skeleton-box skeleton-chevron" />
              <div className="skeleton-box skeleton-icon" />
              <div className="skeleton-box skeleton-text" style={{ width: '45%' }} />
              <div className="skeleton-box skeleton-badge" />
            </div>

            {/* Shimmering Nested Items */}
            <div className="skeleton-nested-group">
              <div className="skeleton-item skeleton-card">
                <div className="skeleton-card-header">
                  <div className="skeleton-box skeleton-text" style={{ width: '70%' }} />
                  <div className="skeleton-box skeleton-text" style={{ width: '22%' }} />
                </div>
                <div className="skeleton-box skeleton-text skeleton-preview" />
              </div>

              <div className="skeleton-item skeleton-card">
                <div className="skeleton-card-header">
                  <div className="skeleton-box skeleton-text" style={{ width: '55%' }} />
                  <div className="skeleton-box skeleton-text" style={{ width: '20%' }} />
                </div>
                <div className="skeleton-box skeleton-text skeleton-preview" />
              </div>
            </div>

            {/* Shimmering Folder Row 2 */}
            <div className="skeleton-item skeleton-folder-row">
              <div className="skeleton-box skeleton-chevron" />
              <div className="skeleton-box skeleton-icon" />
              <div className="skeleton-box skeleton-text" style={{ width: '50%' }} />
              <div className="skeleton-box skeleton-badge" />
            </div>

            {/* Standalone Cards */}
            <div className="skeleton-item skeleton-card">
              <div className="skeleton-card-header">
                <div className="skeleton-box skeleton-text" style={{ width: '65%' }} />
                <div className="skeleton-box skeleton-text" style={{ width: '25%' }} />
              </div>
              <div className="skeleton-box skeleton-text skeleton-preview" />
            </div>

            <div className="skeleton-item skeleton-card">
              <div className="skeleton-card-header">
                <div className="skeleton-box skeleton-text" style={{ width: '48%' }} />
                <div className="skeleton-box skeleton-text" style={{ width: '18%' }} />
              </div>
              <div className="skeleton-box skeleton-text skeleton-preview" />
            </div>
          </div>
        ) : filteredAndSortedFiles.length === 0 && customFolders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p>{searchQuery ? 'No matching notes found' : 'No markdown notes in this root vault'}</p>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
              <button onClick={() => onCreateFile()} className="btn-new-file">
                New Note in Root
              </button>
              {onCreateFolder && (
                <button onClick={() => onCreateFolder()} className="filter-pill" style={{ padding: '0.4rem 0.7rem' }}>
                  + New Folder
                </button>
              )}
            </div>
          </div>
        ) : navMode === 'folders' ? (
          <div className="tree-explorer-view">
            {/* Top Root Vault Banner - Also acts as drop target for root */}
            <div
              className={`tree-root-header ${dragOverTarget === '__root__' ? 'drop-target-active' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOverTarget('__root__');
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverTarget === '__root__') {
                  setDragOverTarget(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverTarget(null);
                setDraggingItem(null);
                try {
                  const data = JSON.parse(e.dataTransfer.getData('application/json') || '{}');
                  if (data.type === 'file' && onMoveFile) {
                    onMoveFile(data.id, '');
                  } else if (data.type === 'folder' && onMoveFolder) {
                    onMoveFolder(data.path, '');
                  }
                } catch {}
              }}
              title="Root Vault (Drop notes or folders here to move to Root)"
            >
              <div className="tree-root-info">
                <span className="tree-root-icon">📁</span>
                <span className="tree-root-name">{storageName || 'Root Vault'}</span>
              </div>
              <div className="tree-root-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="tree-action-btn"
                  onClick={() => onCreateFile()}
                  title="Create Note in Root (/)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                {onCreateFolder && (
                  <button
                    type="button"
                    className="tree-action-btn"
                    onClick={() => onCreateFolder()}
                    title="Create Folder in Root (/)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {treeData.map((node) => renderTreeNode(node, 0))}
          </div>
        ) : (
          <div className="timeline-view">
            {timelineGroups.map((group) => (
              <div key={group.id} className="timeline-section">
                <div className="timeline-section-header">
                  <span className="timeline-section-title">{group.title}</span>
                  <span className="timeline-section-badge">{group.files.length}</span>
                </div>
                <div className="timeline-section-items">
                  {group.files.map((file) => renderNoteItem(file))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}