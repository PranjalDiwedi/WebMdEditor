import type { StreamParams } from '../types';

/**
 * Streams completions directly from Anthropic Claude Messages API.
 */
export async function streamAnthropic({
  prompt,
  systemPrompt,
  contextText,
  config,
  signal,
  onChunk,
}: StreamParams): Promise<string> {
  const endpoint = 'https://api.anthropic.com/v1/messages';
  const apiKey = config.apiKey.trim();

  let userContent = prompt;
  if (contextText) {
    userContent = `[Reference Context]:\n${contextText}\n\n[Task / Instructions]:\n${prompt}`;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: systemPrompt || undefined,
        messages: [{ role: 'user', content: userContent }],
        stream: true,
        temperature: 0.3,
      }),
      signal,
    });
  } catch (fetchErr: any) {
    if (fetchErr.name === 'AbortError') {
      throw fetchErr;
    }
    throw new Error(
      'Network / CORS error: Unable to reach Anthropic Claude API. Check your internet connection or API endpoint.'
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `Anthropic API Error (HTTP ${response.status})`;
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
    throw new Error('Response body is null, cannot stream Anthropic completion.');
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

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6).trim();
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === 'content_block_delta' && data.delta?.text) {
              accumulated += data.delta.text;
              onChunk(data.delta.text, accumulated);
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
