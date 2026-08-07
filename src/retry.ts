export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
  retryableStatuses: number[];
  /** Retry transport failures when the request is idempotent and replayable. */
  retryOnNetworkError?: boolean;
  /** Retry configured per-attempt deadlines when the request is idempotent and replayable. */
  retryOnTimeout?: boolean;
}

export interface ResolvedRetryOptions extends RetryOptions {
  retryOnNetworkError: boolean;
  retryOnTimeout: boolean;
}

export type RequestRetryMode = "auto" | "idempotent" | "never";

export type RetryCause =
  | { kind: "Http"; status: number }
  | { kind: "Network" }
  | { kind: "Timeout" };

export interface RetryDecisionInput {
  method: string;
  mode: RequestRetryMode;
  bodyReplayable: boolean;
  attempt: number;
  cause: RetryCause;
  retryAfterHeader?: string | null;
}

export interface RetryDecision {
  cause: RetryCause;
  delayMs: number;
  reason: string;
}

export const DEFAULT_RETRY: ResolvedRetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.2,
  retryableStatuses: [429, 500, 502, 503, 504],
  retryOnNetworkError: true,
  retryOnTimeout: true,
};

const MAX_SAFE_DELAY_MS = Number.MAX_SAFE_INTEGER;
const AUTO_IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

/** Resolve omitted fields to defaults and reject retry settings that cannot execute safely. */
export function validateRetryOptions(options?: Partial<RetryOptions>): ResolvedRetryOptions {
  if (
    options !== undefined &&
    (options === null || typeof options !== "object" || Array.isArray(options))
  ) {
    throw new Error("retry options must be an object");
  }

  const resolved = {
    maxAttempts:
      options?.maxAttempts === undefined ? DEFAULT_RETRY.maxAttempts : options.maxAttempts,
    initialDelayMs:
      options?.initialDelayMs === undefined ? DEFAULT_RETRY.initialDelayMs : options.initialDelayMs,
    maxDelayMs: options?.maxDelayMs === undefined ? DEFAULT_RETRY.maxDelayMs : options.maxDelayMs,
    jitterFactor:
      options?.jitterFactor === undefined ? DEFAULT_RETRY.jitterFactor : options.jitterFactor,
    retryableStatuses:
      options?.retryableStatuses === undefined
        ? DEFAULT_RETRY.retryableStatuses
        : options.retryableStatuses,
    retryOnNetworkError:
      options?.retryOnNetworkError === undefined
        ? DEFAULT_RETRY.retryOnNetworkError
        : options.retryOnNetworkError,
    retryOnTimeout:
      options?.retryOnTimeout === undefined ? DEFAULT_RETRY.retryOnTimeout : options.retryOnTimeout,
  };

  if (
    !Number.isFinite(resolved.maxAttempts) ||
    !Number.isInteger(resolved.maxAttempts) ||
    resolved.maxAttempts < 1
  ) {
    throw new Error("maxAttempts must be a positive finite integer");
  }
  if (
    !Number.isFinite(resolved.initialDelayMs) ||
    resolved.initialDelayMs < 0 ||
    resolved.initialDelayMs > MAX_SAFE_DELAY_MS
  ) {
    throw new Error(
      `initialDelayMs must be a non-negative finite number no greater than ${MAX_SAFE_DELAY_MS}`,
    );
  }
  if (
    !Number.isFinite(resolved.maxDelayMs) ||
    resolved.maxDelayMs < 0 ||
    resolved.maxDelayMs > MAX_SAFE_DELAY_MS
  ) {
    throw new Error(
      `maxDelayMs must be a non-negative finite number no greater than ${MAX_SAFE_DELAY_MS}`,
    );
  }
  if (
    !Number.isFinite(resolved.jitterFactor) ||
    resolved.jitterFactor < 0 ||
    resolved.jitterFactor > 1
  ) {
    throw new Error("jitterFactor must be a finite number between 0 and 1");
  }
  if (!Array.isArray(resolved.retryableStatuses)) {
    throw new Error("retryableStatuses must be an array of HTTP status codes");
  }
  for (const status of resolved.retryableStatuses) {
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      throw new Error("retryableStatuses must contain only integer HTTP statuses from 100 to 599");
    }
  }
  if (typeof resolved.retryOnNetworkError !== "boolean") {
    throw new Error("retryOnNetworkError must be a boolean");
  }
  if (typeof resolved.retryOnTimeout !== "boolean") {
    throw new Error("retryOnTimeout must be a boolean");
  }

  return {
    ...resolved,
    retryableStatuses: [...resolved.retryableStatuses],
  };
}

export function isRetryable(status: number, opts: RetryOptions): boolean {
  return opts.retryableStatuses.includes(status);
}

/** Decide whether a failed attempt may be repeated without changing request semantics. */
export function decideRetry(
  input: RetryDecisionInput,
  opts: ResolvedRetryOptions,
): RetryDecision | undefined {
  if (
    input.attempt >= opts.maxAttempts ||
    input.mode === "never" ||
    !input.bodyReplayable ||
    (input.mode === "auto" && !AUTO_IDEMPOTENT_METHODS.has(input.method.toUpperCase()))
  ) {
    return undefined;
  }

  if (input.cause.kind === "Http" && !isRetryable(input.cause.status, opts)) {
    return undefined;
  }
  if (input.cause.kind === "Network" && !opts.retryOnNetworkError) return undefined;
  if (input.cause.kind === "Timeout" && !opts.retryOnTimeout) return undefined;

  return {
    cause: input.cause,
    delayMs: calculateDelay(
      input.attempt,
      opts,
      input.cause.kind === "Http" ? input.retryAfterHeader : undefined,
    ),
    reason:
      input.cause.kind === "Http"
        ? `HTTP ${input.cause.status}`
        : input.cause.kind === "Network"
          ? "Network failure"
          : "Request timeout",
  };
}

export function calculateDelay(
  attempt: number,
  opts: RetryOptions,
  retryAfterHeader?: string | null,
  nowMs = Date.now(),
): number {
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader, nowMs);
  if (retryAfterMs !== undefined) return Math.min(retryAfterMs, opts.maxDelayMs);
  if (opts.initialDelayMs === 0 || opts.maxDelayMs === 0) return 0;
  const exponential = opts.initialDelayMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, opts.maxDelayMs);
  return applyJitter(capped, opts.jitterFactor);
}

/** Parse Retry-After as strict integer seconds or an HTTP date. */
export function parseRetryAfterMs(
  retryAfterHeader?: string | null,
  nowMs = Date.now(),
): number | undefined {
  if (retryAfterHeader === undefined || retryAfterHeader === null) return undefined;

  const value = retryAfterHeader.trim();
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    const milliseconds = seconds * 1000;
    return Number.isSafeInteger(milliseconds) ? milliseconds : undefined;
  }

  if (!isHttpDate(value)) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(0, timestamp - nowMs);
}

function isHttpDate(value: string): boolean {
  return (
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
      value,
    ) ||
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{2}-[A-Z][a-z]{2}-\d{2} \d{2}:\d{2}:\d{2} GMT$/.test(
      value,
    ) ||
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) [A-Z][a-z]{2} [ \d]\d \d{2}:\d{2}:\d{2} \d{4}$/.test(value)
  );
}

export function applyJitter(delayMs: number, factor: number): number {
  const min = delayMs * (1 - factor);
  const max = Math.min(MAX_SAFE_DELAY_MS, delayMs * (1 + factor));
  return Math.floor(min + Math.random() * (max - min));
}
