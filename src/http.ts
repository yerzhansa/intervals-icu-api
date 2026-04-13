import * as v from "valibot";
import { createAuthHeaders, type AuthConfig } from "./auth.js";
import { RateLimiter } from "./rate-limiter.js";
import { type RetryOptions, isRetryable, calculateDelay } from "./retry.js";
import { type Hooks, callHook } from "./hooks.js";
import { type Result, type ApiError, ok, err, toValidationIssues } from "./result.js";
import { camelCaseKeys } from "./transform.js";

export interface HttpExecutorOptions {
  rateLimiter: RateLimiter;
  retryOpts: RetryOptions;
  hooks: Hooks;
  baseUrl: string;
  auth: AuthConfig;
  fetchImpl?: typeof globalThis.fetch;
}

export class HttpExecutor {
  private rateLimiter: RateLimiter;
  private retryOpts: RetryOptions;
  private hooks: Hooks;
  private baseUrl: string;
  private auth: AuthConfig;
  private fetchImpl: typeof globalThis.fetch;

  constructor(opts: HttpExecutorOptions) {
    this.rateLimiter = opts.rateLimiter;
    this.retryOpts = opts.retryOpts;
    this.hooks = opts.hooks;
    this.baseUrl = opts.baseUrl;
    this.auth = opts.auth;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  }

  /** JSON request with optional Valibot schema validation + camelCase transform */
  async requestJson<T>(
    method: string,
    path: string,
    fn: () => Promise<{ data?: unknown; error?: unknown; response: Response }>,
    schema?: v.GenericSchema<unknown, T>,
  ): Promise<Result<T>> {
    return this.executeWithRetry(method, path, async () => {
      const { data, error, response } = await fn();
      if (!response.ok) return { ok: false as const, response, error };

      const raw = data;
      if (schema) {
        const parsed = v.safeParse(schema, raw);
        if (!parsed.success) {
          return { ok: false as const, validationIssues: toValidationIssues(parsed.issues) };
        }
        return { ok: true as const, value: camelCaseKeys(parsed.output) as T, response };
      }
      return { ok: true as const, value: camelCaseKeys(raw) as T, response };
    });
  }

  /** Binary request (FIT/GPX/ZIP downloads) */
  async requestBinary(
    method: string,
    path: string,
    urlPath: string,
  ): Promise<Result<ArrayBuffer>> {
    return this.executeWithRetry(method, path, async () => {
      const url = `${this.baseUrl}${urlPath}`;
      const headers = createAuthHeaders(this.auth);
      const response = await this.fetchImpl(url, { headers });
      if (!response.ok) return { ok: false as const, response, error: await response.text().catch(() => null) };
      return { ok: true as const, value: await response.arrayBuffer(), response };
    });
  }

  private async executeWithRetry<T>(
    method: string,
    path: string,
    fn: () => Promise<ExecuteResult<T>>,
  ): Promise<Result<T>> {
    await callHook(this.hooks, "onRequest", { method, path });
    const start = Date.now();

    for (let attempt = 1; attempt <= this.retryOpts.maxAttempts; attempt++) {
      await this.rateLimiter.acquire();
      const result = await fn();

      if ("validationIssues" in result) {
        return err({ kind: "Validation", issues: result.validationIssues });
      }

      const durationMs = Date.now() - start;

      if (result.ok) {
        await callHook(this.hooks, "onResponse", { method, path, status: result.response.status, durationMs });
        return ok(result.value);
      }

      const status = result.response.status;
      if (isRetryable(status, this.retryOpts) && attempt < this.retryOpts.maxAttempts) {
        const retryAfter = result.response.headers.get("retry-after");
        const delayMs = calculateDelay(attempt, this.retryOpts, retryAfter);
        await callHook(this.hooks, "onRetry", {
          method, path, attempt,
          maxAttempts: this.retryOpts.maxAttempts,
          delayMs,
          reason: `HTTP ${status}`,
        });
        await sleep(delayMs);
        continue;
      }

      const apiErr = mapHttpError(status, result.error);
      await callHook(this.hooks, "onError", { method, path, error: apiErr, durationMs });
      return err(apiErr);
    }

    return err({ kind: "Unknown", error: "Max retry attempts reached" });
  }
}

type ExecuteResult<T> =
  | { ok: true; value: T; response: Response }
  | { ok: false; response: Response; error: unknown }
  | { ok: false; validationIssues: import("./result.js").ValidationIssue[] };

function mapHttpError(status: number, body: unknown): ApiError {
  switch (status) {
    case 401: return { kind: "Unauthorized", status: 401, body };
    case 403: return { kind: "Forbidden", status: 403, body };
    case 404: return { kind: "NotFound", status: 404, body };
    case 429: return { kind: "RateLimit", status: 429, retryAfterMs: 1000, body };
    default: return { kind: "Http", status, statusText: `HTTP ${status}`, body };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
