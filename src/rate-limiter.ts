export interface RateLimiterOptions {
  requestsPerSecond: number;
  burst: number;
}

const DEFAULTS: RateLimiterOptions = {
  requestsPerSecond: 10,
  burst: 30,
};

const MAX_TIMER_DELAY_MS = 2_147_483_647;

interface PendingAcquire {
  resolve: () => void;
  reject: (reason?: unknown) => void;
  signal?: AbortSignal;
  abortListener?: () => void;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private pending: PendingAcquire[] = [];
  private drainTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(options?: Partial<RateLimiterOptions>) {
    if (
      options !== undefined &&
      (options === null || typeof options !== "object" || Array.isArray(options))
    ) {
      throw new Error("rateLimit options must be an object");
    }

    const opts: RateLimiterOptions = {
      requestsPerSecond:
        options?.requestsPerSecond === undefined
          ? DEFAULTS.requestsPerSecond
          : options.requestsPerSecond,
      burst: options?.burst === undefined ? DEFAULTS.burst : options.burst,
    };

    if (!Number.isFinite(opts.requestsPerSecond) || opts.requestsPerSecond <= 0) {
      throw new Error("requestsPerSecond must be a positive finite number");
    }
    if (!Number.isFinite(opts.burst) || !Number.isInteger(opts.burst) || opts.burst < 1) {
      throw new Error("burst must be a positive integer");
    }

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

  async acquire(signal?: AbortSignal | null): Promise<void> {
    if (signal?.aborted) throw abortReason(signal);

    this.refill();
    if (this.pending.length === 0 && this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const waiter: PendingAcquire = { resolve, reject };
      if (signal) {
        waiter.signal = signal;
        waiter.abortListener = () => this.abortPending(waiter);
      }

      this.pending.push(waiter);
      if (waiter.abortListener) {
        signal!.addEventListener("abort", waiter.abortListener, { once: true });
        if (signal!.aborted) {
          this.abortPending(waiter);
          return;
        }
      }

      this.scheduleDrain();
    });
  }

  private drain(): void {
    this.refill();
    while (this.pending.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      const waiter = this.pending.shift()!;
      this.removeAbortListener(waiter);
      waiter.resolve();
    }

    this.scheduleDrain();
  }

  private abortPending(waiter: PendingAcquire): void {
    const index = this.pending.indexOf(waiter);
    if (index === -1) return;

    this.pending.splice(index, 1);
    this.removeAbortListener(waiter);
    waiter.reject(abortReason(waiter.signal!));

    if (this.pending.length === 0 && this.drainTimer !== undefined) {
      clearTimeout(this.drainTimer);
      this.drainTimer = undefined;
    }
  }

  private removeAbortListener(waiter: PendingAcquire): void {
    if (waiter.signal && waiter.abortListener) {
      waiter.signal.removeEventListener("abort", waiter.abortListener);
      waiter.abortListener = undefined;
    }
  }

  private scheduleDrain(): void {
    if (this.pending.length === 0 || this.drainTimer !== undefined) return;

    this.refill();
    if (this.tokens >= 1) {
      this.drain();
      return;
    }

    const waitMs = Math.min(
      MAX_TIMER_DELAY_MS,
      Math.max(1, Math.ceil(((1 - this.tokens) / this.refillRate) * 1000)),
    );
    this.drainTimer = setTimeout(() => {
      this.drainTimer = undefined;
      this.drain();
    }, waitMs);
  }
}

function abortReason(signal: AbortSignal): unknown {
  if (signal.reason !== undefined) return signal.reason;
  if (typeof DOMException !== "undefined") {
    return new DOMException("The operation was aborted", "AbortError");
  }

  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}
