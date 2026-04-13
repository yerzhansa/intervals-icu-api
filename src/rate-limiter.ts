export interface RateLimiterOptions {
  requestsPerSecond: number;
  burst: number;
}

const DEFAULTS: RateLimiterOptions = {
  requestsPerSecond: 10,
  burst: 30,
};

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private pending: (() => void)[] = [];

  constructor(options?: Partial<RateLimiterOptions>) {
    const opts = { ...DEFAULTS, ...options };
    this.maxTokens = opts.burst;
    this.refillRate = opts.requestsPerSecond;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Queue concurrent requests to prevent race conditions
    return new Promise<void>((resolve) => {
      this.pending.push(resolve);
      const waitMs = ((1 - this.tokens) / this.refillRate) * 1000;
      setTimeout(() => this.drain(), waitMs);
    });
  }

  private drain(): void {
    this.refill();
    while (this.pending.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      const resolve = this.pending.shift()!;
      resolve();
    }
  }
}
