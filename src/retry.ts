export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
  retryableStatuses: number[];
}

export const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.2,
  retryableStatuses: [429, 500, 502, 503, 504],
};

export function isRetryable(status: number, opts: RetryOptions): boolean {
  return opts.retryableStatuses.includes(status);
}

export function calculateDelay(
  attempt: number,
  opts: RetryOptions,
  retryAfterHeader?: string | null,
): number {
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) return seconds * 1000;
  }
  const exponential = opts.initialDelayMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, opts.maxDelayMs);
  return applyJitter(capped, opts.jitterFactor);
}

export function applyJitter(delayMs: number, factor: number): number {
  const min = delayMs * (1 - factor);
  const max = delayMs * (1 + factor);
  return Math.floor(min + Math.random() * (max - min));
}
