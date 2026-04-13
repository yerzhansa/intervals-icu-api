export interface RequestInfo {
  method: string;
  path: string;
}

export interface ResponseInfo extends RequestInfo {
  status: number;
  durationMs: number;
}

export interface ErrorInfo extends RequestInfo {
  error: unknown;
  durationMs: number;
}

export interface RetryInfo extends RequestInfo {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  reason: string;
}

export interface Hooks {
  onRequest?: (info: RequestInfo) => void | Promise<void>;
  onResponse?: (info: ResponseInfo) => void | Promise<void>;
  onError?: (info: ErrorInfo) => void | Promise<void>;
  onRetry?: (info: RetryInfo) => void | Promise<void>;
}

export async function callHook<K extends keyof Hooks>(
  hooks: Hooks,
  name: K,
  info: Parameters<NonNullable<Hooks[K]>>[0],
): Promise<void> {
  const fn = hooks[name];
  if (!fn) return;
  try {
    await (fn as (info: any) => void | Promise<void>)(info);
  } catch (e) {
    console.warn(`[intervals-icu-api] Hook "${name}" threw:`, e);
  }
}
