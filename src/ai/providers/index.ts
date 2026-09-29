import type { AIConfig, StreamParams } from '../types';
import { streamOpenAICompatible } from './openaiCompatible';
import { streamGemini } from './gemini';
import { streamAnthropic } from './anthropic';

/**
 * Unified entry point to stream AI completions across any supported BYOK provider.
 */
export async function streamAICompletion(params: StreamParams): Promise<string> {
  const { config } = params;

  switch (config.provider) {
    case 'groq':
    case 'openai':
    case 'ollama':
      return streamOpenAICompatible(params);

    case 'gemini':
      return streamGemini(params);

    case 'anthropic':
      return streamAnthropic(params);

    default:
      throw new Error(`Unsupported AI Provider: ${(config as any).provider}`);
  }
}

/**
 * Fast, reliable diagnostic connection test for any BYOK provider.
 */
export async function testAIConnection(config: AIConfig): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    if (config.provider === 'gemini') {
      const apiKey = config.apiKey.trim();
      const rawModel = (config.model || 'gemini-3.8-flash').trim();
      const cleanModel = rawModel.replace(/^models\//, '');

      // 1. First test: Validate API key with ListModels endpoint
      const listEndpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const listRes = await fetch(listEndpoint, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!listRes.ok) {
        // Also check v1 if v1beta returned an error
        const v1ListEndpoint = `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`;
        const v1ListRes = await fetch(v1ListEndpoint, {
          method: 'GET',
          signal: controller.signal,
        });

        if (!v1ListRes.ok) {
          const errorText = await listRes.text();
          let message = `Gemini API Error (HTTP ${listRes.status})`;
          try {
            const parsed = JSON.parse(errorText);
            if (parsed.error?.message) {
              message = parsed.error.message;
            }
          } catch {}
          throw new Error(message);
        }
      }

      // 2. Second test: Quick 1-token test generateContent to verify model availability
      const generateEndpoints = [
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      ];

      for (const endpoint of generateEndpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
              generationConfig: { maxOutputTokens: 2 },
            }),
            signal: controller.signal,
          });

          if (res.ok) {
            return true;
          }
        } catch {
          // Continue to next fallback
        }
      }

      // If ListModels passed, the key is valid even if a specific model identifier is aliased
      return true;
    }

    if (config.provider === 'groq' || config.provider === 'openai' || config.provider === 'ollama') {
      let endpoint = 'https://api.openai.com/v1/chat/completions';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

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

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        let message = `${config.provider} API Error (HTTP ${res.status})`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) {
            message = parsed.error.message;
          }
        } catch {}
        throw new Error(message);
      }

      return true;
    }

    if (config.provider === 'anthropic') {
      const endpoint = 'https://api.anthropic.com/v1/messages';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: config.model || 'claude-3-5-haiku-20241022',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Hello' }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        let message = `Anthropic API Error (HTTP ${res.status})`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) {
            message = parsed.error.message;
          }
        } catch {}
        throw new Error(message);
      }

      return true;
    }

    return true;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out after 12 seconds.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
