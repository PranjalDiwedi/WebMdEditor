import { useMemo, useRef, useState, useEffect } from 'react';
import type { MarkdownFile } from '../types/file';
import { modSymbol } from '../utils/keyboard';

interface EditorTabsProps {
  tabs: MarkdownFile[];
  activeTabId: string | null;
  onSelectTab: (fileId: string) => void;
  onCloseTab: (fileId: string, e?: React.MouseEvent) => void;
  onCloseOtherTabs?: (fileId: string) => void;
  onCloseAllTabs?: () => void;
  onNewTab?: () => void;
  onRenameTab?: (fileId: string) => void;
  onReorderTabs?: (startIndex: number, endIndex: number) => void;
}

export function EditorTabs({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onNewTab,
  onRenameTab,
}: EditorTabsProps) {
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    fileId: string;
    x: number;
    y: number;
  } | null>(null);

  // Detect duplicate filenames across open tabs to display smart parent folder badges
  const duplicateNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tab of tabs) {
      const lower = tab.name.toLowerCase();
      counts.set(lower, (counts.get(lower) || 0) + 1);
    }
    return counts;
  }, [tabs]);

  // Format clean native tooltip for path and status
  const getTabTooltip = (tab: MarkdownFile): string => {
    const rawPath = tab.path && tab.path !== '/' && tab.path !== '.' ? tab.path : '';
    const cleanPath = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const displayPath = cleanPath || tab.name;
    const providerLabel = tab.provider === 'google-drive' ? 'Google Drive' : 'Local Vault';
    const dirtyLabel = tab.isDirty ? ' • Unsaved changes' : '';
    return `${displayPath} (${providerLabel})${dirtyLabel}`;
  };

  // Helper to extract parent folder name for duplicate disambiguation
  const getParentFolderHint = (tab: MarkdownFile): string => {
    const rawPath = tab.path && tab.path !== '/' && tab.path !== '.' ? tab.path : '';
    const cleanPath = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const parts = cleanPath ? cleanPath.split('/') : [];
    if (parts.length > 1) {
      return parts[parts.length - 2];
    }
    return '';
  };

  // Auto-scroll active tab into view when active tab changes
  useEffect(() => {
    if (!activeTabId || !tabsScrollRef.current) return;
    const activeEl = tabsScrollRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId]);

  // Dismiss context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Handle right-click context menu on tab
  const handleContextMenu = (e: React.MouseEvent, fileId: string) => {
    e.preventDefault();
    setContextMenu({
      fileId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="editor-tabs-bar" role="tablist" aria-label="Open documents">
      <div className="editor-tabs-scrollable" ref={tabsScrollRef}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isDuplicate = (duplicateNameCounts.get(tab.name.toLowerCase()) || 0) > 1;
          const parentHint = isDuplicate ? getParentFolderHint(tab) : '';
          const tooltip = getTabTooltip(tab);

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              className={`editor-tab ${isActive ? 'active' : ''} ${tab.isDirty ? 'is-dirty' : ''}`}
              title={tooltip}
              onClick={() => onSelectTab(tab.id)}
              onDoubleClick={() => onRenameTab?.(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectTab(tab.id);
                }
              }}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onAuxClick={(e) => {
                // Middle mouse button click closes tab
                if (e.button === 1) {
                  e.preventDefault();
                  onCloseTab(tab.id, e);
                }
              }}
            >
              <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>

              <span className="tab-title">{tab.name}</span>

              {parentHint && (
                <span className="tab-parent-badge" title={`Folder: ${parentHint}`}>
                  {parentHint}
                </span>
              )}

              {tab.isDirty && (
                <span className="tab-dirty-dot" title="Unsaved changes" />
              )}

              <button
                type="button"
                className="tab-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id, e);
                }}
                title={`Close tab (${modSymbol}W)`}
                aria-label={`Close ${tab.name}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="11" height="11">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <div className="editor-tabs-actions">
        {onNewTab && (
          <button
            type="button"
            className="tab-action-btn tab-new-btn"
            onClick={onNewTab}
            title={`New Note (${modSymbol}N)`}
            aria-label="New note"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        {onCloseAllTabs && tabs.length > 1 && (
          <button
            type="button"
            className="tab-action-btn"
            onClick={onCloseAllTabs}
            title="Close All Tabs"
            aria-label="Close all tabs"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Context Menu on Right Click */}
      {contextMenu && (
        <div
          className="tab-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {onRenameTab && (
            <button
              type="button"
              className="tab-context-item"
              onClick={() => {
                const targetId = contextMenu.fileId;
                setContextMenu(null);
                onRenameTab(targetId);
              }}
            >
              <span>✏️</span> Rename Note
            </button>
          )}

          <button
            type="button"
            className="tab-context-item"
            onClick={() => {
              onCloseTab(contextMenu.fileId);
              setContextMenu(null);
            }}
          >
            <span>✕</span> Close Tab
          </button>

          {onCloseOtherTabs && tabs.length > 1 && (
            <button
              type="button"
              className="tab-context-item"
              onClick={() => {
                onCloseOtherTabs(contextMenu.fileId);
                setContextMenu(null);
              }}
            >
              <span>⇥</span> Close Other Tabs
            </button>
          )}

          {onCloseAllTabs && (
            <button
              type="button"
              className="tab-context-item danger"
              onClick={() => {
                onCloseAllTabs();
                setContextMenu(null);
              }}
            >
              <span>🗑️</span> Close All Tabs
            </button>
          )}
        </div>
      )}
    </div>
  );
}
