/**
 * Simple client-side token bucket for pacing API calls.
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillPerMs: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];

  constructor(maxRequestsPerMinute: number) {
    this.maxTokens = maxRequestsPerMinute;
    this.tokens = maxRequestsPerMinute;
    this.refillPerMs = maxRequestsPerMinute / 60_000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;
  }

  private drainQueue(): void {
    this.refill();
    while (this.queue.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      const next = this.queue.shift();
      next?.();
    }
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
      const waitMs = Math.ceil((1 - this.tokens) / this.refillPerMs);
      setTimeout(() => this.drainQueue(), Math.max(waitMs, 50));
    });
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    return await fn();
  }
}
