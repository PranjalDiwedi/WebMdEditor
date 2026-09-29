import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { Editor } from '@tiptap/react';
import { useAI } from './useAI';
import { AI_PRESETS, GRAPH_AI_PRESETS } from './constants';
import { streamAICompletion } from './providers';
import type { AIPresetAction, AIPresetDefinition } from './types';
import type { MarkdownFile } from '../types/file';

export interface AIInlineToolbarProps {
  isOpen: boolean;
  onClose: () => void;
  editor?: Editor | null;
  currentFile?: MarkdownFile | null;
  files?: MarkdownFile[];
  viewMode?: 'edit' | 'preview' | 'split' | 'network';
  onCreateNote?: (title: string, content: string) => void;
}

export function AIInlineToolbar({
  isOpen,
  onClose,
  editor,
  currentFile,
  files = [],
  viewMode = 'edit',
  onCreateNote,
}: AIInlineToolbarProps) {
  const { config, isConnected, openAIModal } = useAI();
  const [customPrompt, setCustomPrompt] = useState('');
  const [activeAction, setActiveAction] = useState<AIPresetAction | null>(null);
  const [streamedText, setStreamedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);

  const isNetworkMode = viewMode === 'network';

  // Store selection range at the moment toolbar opened
  const selectionRangeRef = useRef<{ from: number; to: number; text: string }>({
    from: 0,
    to: 0,
    text: '',
  });

  useEffect(() => {
    if (isOpen) {
      setStreamedText('');
      setErrorMessage(null);
      setActiveAction(null);
      setCustomPrompt('');
      setCopied(false);

      if (editor) {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, ' ').trim();
        selectionRangeRef.current = { from, to, text };
      } else {
        selectionRangeRef.current = { from: 0, to: 0, text: '' };
      }

      // Auto-focus prompt input
      setTimeout(() => {
        promptInputRef.current?.focus();
      }, 50);
    } else {
      // Clean up running stream on close
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [isOpen, editor]);

  const handleStopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Compute vault context summary for Graph Mode
  const vaultGraphContext = useMemo(() => {
    if (!files || files.length === 0) return 'Vault is currently empty.';

    const fileSummaries = files.slice(0, 60).map((f) => {
      const links = Array.from(f.content.matchAll(/\[\[(.*?)\]\]/g)).map((m: any) => m[1]);
      const tags = Array.from(f.content.matchAll(/#([a-zA-Z0-9_\-]+)/g)).map((m: any) => m[1]);
      const uniqueLinks = Array.from(new Set(links)).slice(0, 5);
      const uniqueTags = Array.from(new Set(tags)).slice(0, 5);
      const title = f.name.replace(/\.md$/, '');
      const folder = f.path.split('/').slice(0, -1).join('/') || 'root';

      let line = `- Note: "${title}" (Folder: ${folder})`;
      if (uniqueTags.length) line += ` [Tags: #${uniqueTags.join(', #')}]`;
      if (uniqueLinks.length) line += ` [Links: [[${uniqueLinks.join(']], [[')}]]]`;
      return line;
    });

    return `Vault Structure (${files.length} notes):\n` + fileSummaries.join('\n');
  }, [files]);

  const executeAI = useCallback(
    async (prompt: string, systemPrompt?: string, actionId?: AIPresetAction) => {
      if (!config || !isConnected) {
        handleDiscard();
        openAIModal();
        return;
      }

      handleStopStream();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);
      setErrorMessage(null);
      setStreamedText('');
      setCopied(false);
      if (actionId) setActiveAction(actionId);

      // Determine context: selected text, entire note, or full vault graph
      let contextText = '';
      if (isNetworkMode) {
        contextText = vaultGraphContext;
      } else {
        contextText =
          selectionRangeRef.current.text ||
          (editor ? editor.getText() : currentFile ? currentFile.content : '');
      }

      try {
        await streamAICompletion({
          prompt,
          systemPrompt:
            systemPrompt ||
            (isNetworkMode
              ? 'You are a knowledge graph intelligence assistant. Provide insightful, structured markdown outputs.'
              : 'You are an expert markdown co-writer and editor. Provide high-quality, cleanly formatted Markdown output. Output ONLY the resulting markdown without preamble or conversational wrap-up.'),
          contextText: contextText || undefined,
          config,
          signal: controller.signal,
          onChunk: (_chunk, accumulated) => {
            setStreamedText(accumulated);
          },
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setErrorMessage(err instanceof Error ? err.message : 'AI Generation failed.');
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [config, isConnected, editor, currentFile, isNetworkMode, vaultGraphContext, openAIModal, handleStopStream]
  );

  const handlePresetClick = (preset: AIPresetDefinition) => {
    if (isNetworkMode) {
      const builtPrompt = preset.buildPrompt(vaultGraphContext);
      executeAI(builtPrompt, preset.systemPrompt, preset.id);
      return;
    }

    const targetText =
      selectionRangeRef.current.text ||
      (editor ? editor.getText() : currentFile ? currentFile.content : '');

    if (!targetText.trim() && preset.id !== 'continue') {
      setErrorMessage('Please write or select notes first.');
      return;
    }

    const builtPrompt = preset.buildPrompt(targetText);
    executeAI(builtPrompt, preset.systemPrompt, preset.id);
  };

  const handleCustomSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    executeAI(customPrompt.trim(), undefined, 'custom');
  };

  const handleAccept = () => {
    if (!editor || !streamedText) return;

    const { from, to, text } = selectionRangeRef.current;

    if (text && from !== to) {
      // Replace selection with generated text
      (editor.commands as any).insertContentAt({ from, to }, streamedText);
    } else {
      // Insert at current cursor position or append
      editor.commands.insertContent(streamedText);
    }

    onClose();
  };

  const handleCreateNewNote = () => {
    if (!streamedText) return;
    const title =
      activeAction === 'graph_moc'
        ? 'Map of Content'
        : activeAction === 'graph_links'
        ? 'Suggested Connections'
        : activeAction === 'graph_clusters'
        ? 'Graph Syntheses'
        : 'AI Insights';

    if (onCreateNote) {
      onCreateNote(title, streamedText);
    }
    onClose();
  };

  const handleCopyOutput = () => {
    if (!streamedText) return;
    navigator.clipboard.writeText(streamedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDiscard = () => {
    handleStopStream();
    onClose();
  };

  // Keyboard navigation inside toolbar
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleDiscard();
    } else if (e.key === 'Tab' && streamedText && !isStreaming && editor && !isNetworkMode) {
      e.preventDefault();
      handleAccept();
    }
  };

  if (!isOpen) return null;

  const currentPresets = isNetworkMode ? GRAPH_AI_PRESETS : AI_PRESETS;

  return (
    <div
      className="ai-inline-backdrop"
      onClick={handleDiscard}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2400,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
      }}
    >
      <div
        className="ai-inline-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          maxWidth: '720px',
          background: 'var(--bg-surface, #1e1e2e)',
          border: '1px solid var(--border, #313244)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>✦</span>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              {isNetworkMode ? 'Mandrak Knowledge AI (Graph)' : 'Mandrak AI Assistant'}
            </span>

            {isNetworkMode ? (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-sm, 4px)',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent, #6366f1)',
                  fontWeight: 600,
                }}
              >
                🕸️ Vault Graph
              </span>
            ) : null}

            {config ? (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-sm, 4px)',
                  background: 'var(--accent-glow)',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {config.provider} · {config.model.replace(/^models\//, '').split('-').slice(0, 2).join('-')}
              </span>
            ) : (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-sm, 4px)',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--error, #ef4444)',
                  fontWeight: 600,
                }}
              >
                Not Connected
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                handleDiscard();
                openAIModal();
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm, 4px)',
                padding: '0.2rem 0.5rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              ⚙️ Config Key
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.1rem',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.2rem',
              }}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Not Connected State */}
        {!isConnected ? (
          <div style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 500 }}>
              Connect your API key to use AI across notes & knowledge graphs
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Groq (Ultra-Fast), Gemini 3.8, OpenAI, Claude, or Local Ollama. 100% private in-memory execution.
            </p>
            <button
              type="button"
              onClick={() => {
                handleDiscard();
                openAIModal();
              }}
              style={{
                background: 'var(--accent, #6366f1)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md, 6px)',
                padding: '0.55rem 1.25rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              🔑 Configure API Key
            </button>
          </div>
        ) : (
          <>
            {/* Custom Prompt Input */}
            <form onSubmit={handleCustomSubmit} style={{ padding: '0.75rem 1rem 0.5rem 1rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '0.2rem 0.5rem 0.2rem 0.75rem',
                  gap: '0.5rem',
                }}
              >
                <span style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>✨</span>
                <input
                  ref={promptInputRef}
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={
                    isNetworkMode
                      ? `Ask AI about your note graph (${files.length} notes), connections, or research ideas...`
                      : selectionRangeRef.current.text
                      ? `Ask AI to transform selected text (${selectionRangeRef.current.text.length} chars)...`
                      : 'Ask AI to write, brainstorm, outline, or explain...'
                  }
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    padding: '0.45rem 0',
                  }}
                  disabled={isStreaming}
                />
                <button
                  type="submit"
                  disabled={!customPrompt.trim() || isStreaming}
                  style={{
                    background: customPrompt.trim() && !isStreaming ? 'var(--accent)' : 'var(--bg-surface)',
                    color: customPrompt.trim() && !isStreaming ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm, 4px)',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: customPrompt.trim() && !isStreaming ? 'pointer' : 'default',
                  }}
                >
                  Generate ↵
                </button>
              </div>
            </form>

            {/* Quick Action Presets (Context Aware: Document vs Graph) */}
            <div
              style={{
                display: 'flex',
                gap: '0.4rem',
                padding: '0 1rem 0.75rem 1rem',
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              {currentPresets.map((preset) => {
                const isActive = activeAction === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    disabled={isStreaming}
                    title={preset.description}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: 'var(--radius-md, 6px)',
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      background: isActive ? 'var(--accent-glow)' : 'var(--bg-primary)',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: isStreaming ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div
                style={{
                  margin: '0 1rem 0.75rem 1rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-md, 6px)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--error, #ef4444)',
                  fontSize: '0.8rem',
                }}
              >
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Live Streaming Output Window */}
            {(streamedText || isStreaming) && (
              <div
                style={{
                  margin: '0 1rem 1rem 1rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '0.85rem',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.825rem',
                  lineHeight: '1.6',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {streamedText}
                {isStreaming && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '14px',
                      background: 'var(--accent)',
                      marginLeft: '2px',
                      verticalAlign: 'middle',
                      animation: 'pulse 0.8s infinite',
                    }}
                  />
                )}
              </div>
            )}

            {/* Action Buttons Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 1rem',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              <div>
                <span>
                  {isNetworkMode
                    ? `Vault Context: ${files.length} notes indexed`
                    : selectionRangeRef.current.text
                    ? `Selection: ${selectionRangeRef.current.text.length} chars`
                    : currentFile
                    ? `Note: ${currentFile.name}`
                    : 'Editor Canvas'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStopStream}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: 'var(--error, #ef4444)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 'var(--radius-sm, 4px)',
                      padding: '0.35rem 0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ⏹ Stop Generating
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleDiscard}
                      style={{
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm, 4px)',
                        padding: '0.35rem 0.65rem',
                        cursor: 'pointer',
                      }}
                    >
                      Discard (Esc)
                    </button>

                    {streamedText && (
                      <>
                        <button
                          type="button"
                          onClick={handleCopyOutput}
                          style={{
                            background: 'transparent',
                            color: copied ? 'var(--success, #22c55e)' : 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm, 4px)',
                            padding: '0.35rem 0.65rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          {copied ? '✓ Copied!' : '📋 Copy'}
                        </button>

                        {/* If in Network Mode or when Create Note is requested */}
                        {onCreateNote && (
                          <button
                            type="button"
                            onClick={handleCreateNewNote}
                            style={{
                              background: isNetworkMode ? 'var(--accent, #6366f1)' : 'var(--bg-surface)',
                              color: isNetworkMode ? '#fff' : 'var(--text-primary)',
                              border: isNetworkMode ? 'none' : '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm, 4px)',
                              padding: '0.35rem 0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            ✨ Create Note
                          </button>
                        )}

                        {/* If in Editor mode with an active editor */}
                        {!isNetworkMode && editor && (
                          <button
                            type="button"
                            onClick={handleAccept}
                            style={{
                              background: 'var(--accent, #6366f1)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 'var(--radius-sm, 4px)',
                              padding: '0.35rem 0.85rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            ✓ Accept & Insert (Tab)
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
