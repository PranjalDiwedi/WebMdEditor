import type { StreamParams } from '../types';

/**
 * Parses and streams Server-Sent Events from OpenAI-compatible APIs (Groq, OpenAI, Ollama).
 */
export async function streamOpenAICompatible({
  prompt,
  systemPrompt,
  contextText,
  config,
  signal,
  onChunk,
}: StreamParams): Promise<string> {
  let endpoint = 'https://api.openai.com/v1/chat/completions';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.provider === 'groq') {
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  } else if (config.provider === 'openai') {
    endpoint = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  } else if (config.provider === 'ollama') {
    const base = (config.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    endpoint = `${base}/v1/chat/completions`;
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    }
  }

  const messages: Array<{ role: string; content: string }> = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  if (contextText) {
    messages.push({
      role: 'user',
      content: `[Reference Document Context]:\n${contextText}\n\n[Task / Input]:\n${prompt}`,
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        temperature: 0.3,
      }),
      signal,
    });
  } catch (fetchErr: any) {
    if (fetchErr.name === 'AbortError') {
      throw fetchErr;
    }
    if (config.provider === 'ollama') {
      throw new Error(
        `Unable to reach Ollama at ${config.baseUrl || 'http://localhost:11434'}. Please ensure Ollama is running and CORS is permitted.`
      );
    }
    throw new Error(
      `Network / CORS error: Unable to reach ${config.provider} API. Please check your internet connection or API endpoint.`
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error?.message) {
        errorMessage = parsed.error.message;
      }
    } catch {
      if (errorBody) {
        errorMessage = errorBody.slice(0, 300);
      }
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error('Response body is null, cannot stream completion.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6).trim();
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta?.content;
            if (typeof delta === 'string') {
              accumulated += delta;
              onChunk(delta, accumulated);
            }
          } catch {
            // Ignore malformed chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated;
}
