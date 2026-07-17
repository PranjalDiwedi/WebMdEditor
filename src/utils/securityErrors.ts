/**
 * Converts unknown errors into safe, user-facing messages.
 * Never exposes raw API payloads, stacks, or token material.
 */
export function toUserError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof Error) {
    const message = error.message || fallback;

    // Strip accidental object dumps
    if (message.includes('[object Object]') || message.length > 280) {
      return fallback;
    }

    // Avoid leaking authorization headers / tokens if ever embedded
    if (/ya29\.|Bearer\s+\S+/i.test(message)) {
      return fallback;
    }

    return message;
  }

  if (typeof error === 'string' && error.length > 0 && error.length < 280) {
    return error;
  }

  console.error('Non-Error thrown:', error);
  return fallback;
}

export function logSecurityEvent(context: string, error: unknown): void {
  console.error(`[security:${context}]`, error);
}
