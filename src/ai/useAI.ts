import { useContext } from 'react';
import { AIContext, type AIContextValue } from './AIContext';

export function useAI(): AIContextValue {
  const ctx = useContext(AIContext);
  if (!ctx) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return ctx;
}
