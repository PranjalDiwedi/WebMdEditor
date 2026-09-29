import type { ReactNode } from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';
import type { AIConfig } from './types';

const SESSION_STORAGE_KEY = 'mandrak_ai_session_config';

export interface AIContextValue {
  config: AIConfig | null;
  isConnected: boolean;
  isConfigModalOpen: boolean;
  setIsConfigModalOpen: (open: boolean) => void;
  isInlineMenuOpen: boolean;
  setIsInlineMenuOpen: (open: boolean) => void;
  activeSelectionText: string;
  setActiveSelectionText: (text: string) => void;
  setAIConfig: (config: AIConfig) => void;
  disconnectAI: () => void;
  openAIModal: () => void;
}

export const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<AIConfig | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AIConfig;
        if (parsed && parsed.provider) {
          return parsed;
        }
      }
    } catch {
      // Ignore sessionStorage read errors
    }
    return null;
  });

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isInlineMenuOpen, setIsInlineMenuOpen] = useState(false);
  const [activeSelectionText, setActiveSelectionText] = useState('');

  const isConnected = Boolean(
    config && (config.provider === 'ollama' || (config.apiKey && config.apiKey.trim().length > 0))
  );

  // Save or clear session storage based on storageMode
  const setAIConfig = useCallback((newConfig: AIConfig) => {
    setConfigState(newConfig);
    if (newConfig.storageMode === 'session') {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newConfig));
      } catch {}
    } else {
      // Ephemeral mode: strictly in-memory, remove any previous session storage
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {}
    }
  }, []);

  const disconnectAI = useCallback(() => {
    setConfigState(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
  }, []);

  const openAIModal = useCallback(() => {
    setIsConfigModalOpen(true);
  }, []);

  // Reload Guard: protect ephemeral keys from accidental tab refreshes
  useEffect(() => {
    if (!config || !isConnected || config.storageMode !== 'ephemeral') {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [config, isConnected]);

  return (
    <AIContext.Provider
      value={{
        config,
        isConnected,
        isConfigModalOpen,
        setIsConfigModalOpen,
        isInlineMenuOpen,
        setIsInlineMenuOpen,
        activeSelectionText,
        setActiveSelectionText,
        setAIConfig,
        disconnectAI,
        openAIModal,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}
