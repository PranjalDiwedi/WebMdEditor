/**
 * Type definitions for BYOK (Bring-Your-Own-Key) LLM Integration in Mandrak.
 */

export type LLMProviderId = 'groq' | 'gemini' | 'openai' | 'anthropic' | 'ollama';

export type KeyStorageMode = 'ephemeral' | 'session';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
}

export interface ProviderDefinition {
  id: LLMProviderId;
  name: string;
  icon: string;
  keyPlaceholder: string;
  keyDocUrl: string;
  defaultModel: string;
  availableModels: ModelOption[];
  requiresApiKey: boolean;
  defaultBaseUrl?: string;
}

export interface AIConfig {
  provider: LLMProviderId;
  apiKey: string;
  model: string;
  storageMode: KeyStorageMode;
  baseUrl?: string;
}

export interface StreamParams {
  prompt: string;
  systemPrompt?: string;
  contextText?: string;
  config: AIConfig;
  signal?: AbortSignal;
  onChunk: (chunk: string, accumulated: string) => void;
}

export type AIPresetAction =
  | 'grammar'
  | 'summarize'
  | 'table'
  | 'continue'
  | 'simplify'
  | 'action_items'
  | 'graph_links'
  | 'graph_clusters'
  | 'graph_gaps'
  | 'graph_moc'
  | 'custom';

export interface AIPresetDefinition {
  id: AIPresetAction;
  label: string;
  icon: string;
  description: string;
  systemPrompt: string;
  buildPrompt: (selection: string) => string;
}
