import type { StreamParams } from '../types';

/**
 * Helper to execute a Gemini stream or generate request for a given model.
 */
async function tryGeminiModel(
  model: string,
  fullPrompt: string,
  apiKey: string,
  signal: AbortSignal | undefined,
  onChunk: (chunk: string, accumulated: string) => void
): Promise<{ success: boolean; text?: string; error?: string; suggestedModel?: string }> {
  const cleanModel = model.replace(/^models\//, '').trim();
  const requestBody = {
    contents: [
      {
        parts: [{ text: fullPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
    },
  };

  // 1. Try Streaming SSE on v1beta
  const streamEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cleanModel
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  try {
    const streamRes = await fetch(streamEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (streamRes.ok && streamRes.body) {
      const reader = streamRes.body.getReader();
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
                const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (typeof textPart === 'string') {
                  accumulated += textPart;
                  onChunk(textPart, accumulated);
                }
              } catch {
                // Ignore partial JSON chunks
              }
            }
          }
        }
        if (accumulated.trim().length > 0) {
          return { success: true, text: accumulated };
        }
      } finally {
        reader.releaseLock();
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
  }

  // 2. Direct generateContent fallback on v1beta
  const directEndpointBeta = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cleanModel
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const directResBeta = await fetch(directEndpointBeta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (directResBeta.ok) {
    const directData = await directResBeta.json();
    const outputText = directData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (outputText) {
      onChunk(outputText, outputText);
    }
    return { success: true, text: outputText };
  }

  // 3. Parse error message and check for suggested model updates
  const errText = await directResBeta.text();
  let message = `Gemini API Error (HTTP ${directResBeta.status})`;
  let suggestedModel: string | undefined;

  try {
    const parsed = JSON.parse(errText);
    if (parsed.error?.message) {
      message = parsed.error.message;
      const match = message.match(/models\/([a-zA-Z0-9_.-]+)/i);
      if (match && match[1] && match[1] !== cleanModel) {
        suggestedModel = match[1];
      }
    }
  } catch {}

  return { success: false, error: message, suggestedModel };
}

/**
 * Streams completions directly from Google Gemini REST API with intelligent model upgrade.
 */
export async function streamGemini({
  prompt,
  systemPrompt,
  contextText,
  config,
  signal,
  onChunk,
}: StreamParams): Promise<string> {
  const rawModel = (config.model || 'gemini-3.8-flash').trim();
  const apiKey = config.apiKey.trim();

  let fullPrompt = '';
  if (systemPrompt) {
    fullPrompt += `[System Instructions]:\n${systemPrompt}\n\n`;
  }
  if (contextText) {
    fullPrompt += `[Reference Document Context]:\n${contextText}\n\n`;
  }
  fullPrompt += `[User Request]:\n${prompt}`;

  // 1. Primary execution attempt with configured model
  const primaryResult = await tryGeminiModel(rawModel, fullPrompt, apiKey, signal, onChunk);
  if (primaryResult.success && primaryResult.text !== undefined) {
    return primaryResult.text;
  }

  // 2. Intelligent Auto-Upgrade: if model is deprecated / unavailable (e.g. 2.0-flash -> 3.8-flash)
  const candidateBackup =
    primaryResult.suggestedModel ||
    (rawModel.includes('2.0') || rawModel.includes('1.5') ? 'gemini-3.8-flash' : undefined);

  if (candidateBackup && candidateBackup !== rawModel.replace(/^models\//, '')) {
    const fallbackResult = await tryGeminiModel(candidateBackup, fullPrompt, apiKey, signal, onChunk);
    if (fallbackResult.success && fallbackResult.text !== undefined) {
      return fallbackResult.text;
    }
  }

  throw new Error(primaryResult.error || 'Gemini completion failed.');
}
