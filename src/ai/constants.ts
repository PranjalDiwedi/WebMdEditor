import type { ProviderDefinition, AIPresetDefinition } from './types';

export const SUPPORTED_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'groq',
    name: 'Groq (Ultra-Fast)',
    icon: '⚡',
    keyPlaceholder: 'gsk_...',
    keyDocUrl: 'https://console.groq.com/keys',
    defaultModel: 'llama-3.3-70b-versatile',
    requiresApiKey: true,
    availableModels: [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B (Versatile)',
        description: 'Blazing fast, exceptional reasoning (300+ tok/s)',
        isDefault: true,
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B (Instant)',
        description: 'Maximum speed, ideal for quick fixes & grammar',
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        description: 'MoE model with 32k context window',
      },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    keyPlaceholder: 'AIzaSy...',
    keyDocUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-3.8-flash',
    requiresApiKey: true,
    availableModels: [
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash (Recommended)',
        description: 'Next-gen flagship speed, intelligence & multi-turn reasoning',
        isDefault: true,
      },
      {
        id: 'gemini-3.8-pro',
        name: 'Gemini 3.8 Pro',
        description: 'Deep complex reasoning and massive context window',
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Fast and efficient everyday generation',
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Lightweight writing and grammar assistant',
      },
      {
        id: 'custom',
        name: 'Custom Gemini Model...',
        description: 'Enter any custom model identifier from AI Studio',
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🧠',
    keyPlaceholder: 'sk-proj-...',
    keyDocUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
    availableModels: [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o mini',
        description: 'Fast, affordable, high quality markdown generation',
        isDefault: true,
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Flagship model for complex text analysis',
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: '🎭',
    keyPlaceholder: 'sk-ant-...',
    keyDocUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-3-5-haiku-20241022',
    requiresApiKey: true,
    availableModels: [
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Ultra-fast writing assistant and summarizer',
        isDefault: true,
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'State-of-the-art prose crafting and nuance',
      },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (Localhost)',
    icon: '🦙',
    keyPlaceholder: 'No API key needed for local Ollama',
    keyDocUrl: 'https://ollama.com',
    defaultModel: 'llama3.2',
    defaultBaseUrl: 'http://localhost:11434',
    requiresApiKey: false,
    availableModels: [
      {
        id: 'llama3.2',
        name: 'Llama 3.2',
        description: 'Local private model running on your machine',
        isDefault: true,
      },
      {
        id: 'mistral',
        name: 'Mistral',
        description: 'Local 7B parameter instruction model',
      },
      {
        id: 'qwen2.5',
        name: 'Qwen 2.5',
        description: 'Local polyglot coding and writing model',
      },
      {
        id: 'custom',
        name: 'Custom local model',
        description: 'Use any model pulled into your Ollama instance',
      },
    ],
  },
];

export const AI_PRESETS: AIPresetDefinition[] = [
  {
    id: 'grammar',
    label: 'Fix Grammar & Polish',
    icon: '⚡',
    description: 'Fix typos, grammar, and improve sentence flow without altering meaning.',
    systemPrompt:
      'You are an expert editor. Polish grammar, spelling, punctuation, and flow while preserving markdown formatting and original intent. Output ONLY the improved markdown text without commentary.',
    buildPrompt: (text) => `Improve and fix grammar for the following text:\n\n${text}`,
  },
  {
    id: 'summarize',
    label: 'Summarize into Bullets',
    icon: '📋',
    description: 'Condense the text into 3-5 high-impact bullet points.',
    systemPrompt:
      'You are a concise executive assistant. Summarize the provided text into clear, high-signal Markdown bullet points. Output ONLY the markdown bullet list.',
    buildPrompt: (text) => `Summarize the following text into key bullet points:\n\n${text}`,
  },
  {
    id: 'table',
    label: 'Convert to Markdown Table',
    icon: '📊',
    description: 'Structure text, lists, or data into a clean Markdown table.',
    systemPrompt:
      'You are a structured data specialist. Convert the given information into a clean, properly aligned GitHub-Flavored Markdown table with appropriate column headers. Output ONLY the markdown table.',
    buildPrompt: (text) => `Convert the following data/text into a GitHub-flavored Markdown table:\n\n${text}`,
  },
  {
    id: 'continue',
    label: 'Continue Writing',
    icon: '📝',
    description: 'Continue writing and expand thoughts naturally in the same style.',
    systemPrompt:
      'You are a thoughtful co-writer. Continue drafting the document in the same tone, voice, and markdown formatting. Output ONLY the continuation text.',
    buildPrompt: (text) => `Continue writing naturally from where this left off:\n\n${text}`,
  },
  {
    id: 'simplify',
    label: 'Simplify & Clarify',
    icon: '💡',
    description: 'Make complex explanations easy to understand.',
    systemPrompt:
      'You are a clear communicator. Simplify the following text, removing jargon and making it concise and easy to read. Output ONLY the simplified markdown text.',
    buildPrompt: (text) => `Simplify and clarify the following text:\n\n${text}`,
  },
  {
    id: 'action_items',
    label: 'Extract Action Items',
    icon: '✅',
    description: 'Extract actionable to-do items as a markdown task list.',
    systemPrompt:
      'You are an actionable project manager. Extract all tasks, next steps, and action items from the text into a GitHub Markdown checklist format (- [ ] Task). Output ONLY the checklist.',
    buildPrompt: (text) => `Extract action items from the following text as a checklist:\n\n${text}`,
  },
];

export const GRAPH_AI_PRESETS: AIPresetDefinition[] = [
  {
    id: 'graph_links',
    label: 'Find Missing Links',
    icon: '🕸️',
    description: 'Suggest new bidirectional [[wiki-links]] between conceptually related notes in your vault.',
    systemPrompt:
      'You are a knowledge graph architect. Analyze the provided list of vault notes, tags, and structure to suggest high-value bidirectional [[wiki-links]] between notes. Group suggestions clearly by theme and provide a 1-sentence rationale for each connection. Output ONLY clean Markdown.',
    buildPrompt: (vaultContext) =>
      `Analyze our vault's notes and suggest high-value missing [[wiki-links]] between them:\n\n${vaultContext}`,
  },
  {
    id: 'graph_clusters',
    label: 'Synthesize Clusters',
    icon: '🧠',
    description: 'Identify overarching themes and summarize the central hubs forming in the vault.',
    systemPrompt:
      'You are a research synthesizer. Examine the user\'s vault notes and knowledge graph structure. Synthesize 3-5 major overarching themes, identify central hub notes, and explain how the concepts interconnect in clean Markdown.',
    buildPrompt: (vaultContext) =>
      `Synthesize the major themes and knowledge clusters across this note graph:\n\n${vaultContext}`,
  },
  {
    id: 'graph_gaps',
    label: 'Brainstorm Gaps',
    icon: '💡',
    description: 'Find missing topics, blind spots, and suggest 4-6 new notes to create.',
    systemPrompt:
      'You are a creative thought partner. Analyze the current note graph to identify blind spots, unanswered questions, and suggest 4-6 specific new note ideas to write (with proposed [[Note Title]] and a short 2-sentence synopsis). Output ONLY clean Markdown.',
    buildPrompt: (vaultContext) =>
      `Identify knowledge gaps and suggest 4-6 new notes to create based on this vault structure:\n\n${vaultContext}`,
  },
  {
    id: 'graph_moc',
    label: 'Generate MOC (Index)',
    icon: '📑',
    description: 'Draft a structured Map of Content (MOC) index note linking all key topics.',
    systemPrompt:
      'You are a Personal Knowledge Management (PKM) specialist. Create a beautifully structured Map of Content (MOC) index note with categorized sections, bullet points, and [[wiki-links]] for each note in the vault. Output ONLY the MOC markdown note.',
    buildPrompt: (vaultContext) =>
      `Create a comprehensive Map of Content (MOC) index note for the following vault notes:\n\n${vaultContext}`,
  },
];
