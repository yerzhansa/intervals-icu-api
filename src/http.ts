import * as v from "valibot";
import { createAuthHeaders, type AuthConfig } from "./auth.js";
import type { BinaryDownload } from "./download.js";
import { RateLimiter } from "./rate-limiter.js";
import { type RetryOptions, isRetryable, calculateDelay, parseRetryAfterMs } from "./retry.js";
import { type Hooks, callHook } from "./hooks.js";
import {
  type Result,
  type ApiError,
  type ValidationIssue,
  ok,
  err,
  toValidationIssues,
} from "./result.js";
import { camelCaseKeys, type CamelCaseKeys } from "./transform.js";

export interface HttpExecutorOptions {
  rateLimiter: RateLimiter;
  retryOpts: RetryOptions;
  hooks: Hooks;
  baseUrl: string;
  auth: AuthConfig;
  fetchImpl?: typeof globalThis.fetch;
  timeoutMs?: number;
}

type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];
const MAX_TIMER_DELAY_MS = 2_147_483_647;

export class HttpExecutor {
  private rateLimiter: RateLimiter;
  private retryOpts: RetryOptions;
  private hooks: Hooks;
  private baseUrl: string;
  private auth: AuthConfig;
  private defaultAuthorization: string;
  private fetchImpl: typeof globalThis.fetch;
  private timeoutMs?: number;

  /** Fetch used by managed resources: per-attempt timeout through response body consumption. */
  readonly fetch: typeof globalThis.fetch;

  /** Managed transport whose empty-body behavior matches openapi-fetch parsing. */
  readonly openApiFetch: typeof globalThis.fetch;

  /** Default transport used by client.raw; the full raw call is managed separately. */
  readonly rawFetch: typeof globalThis.fetch;

  constructor(opts: HttpExecutorOptions) {
    if (
      opts.timeoutMs !== undefined &&
      (!Number.isFinite(opts.timeoutMs) ||
        opts.timeoutMs <= 0 ||
        opts.timeoutMs > MAX_TIMER_DELAY_MS)
    ) {
      throw new Error(
        `timeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`,
      );
    }

    this.rateLimiter = opts.rateLimiter;
    this.retryOpts = opts.retryOpts;
    this.hooks = opts.hooks;
    this.baseUrl = opts.baseUrl;
    this.auth = opts.auth;
    this.defaultAuthorization = createAuthHeaders(opts.auth).Authorization;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs;
    this.fetch = (input, init) => {
      const request = stripCrossOriginDefaultAuthorization(
        new Request(input, init),
        this.baseUrl,
        this.defaultAuthorization,
      );
      return this.fetchWithTimeout(this.fetchImpl, request, undefined, true);
    };
    this.openApiFetch = (input, init) => {
      const request = stripCrossOriginDefaultAuthorization(
        new Request(input, init),
        this.baseUrl,
        this.defaultAuthorization,
      );
      return this.fetchWithTimeout(this.fetchImpl, request, undefined, true, true);
    };
    this.rawFetch = this.createRawFetch(this.fetchImpl);
  }

  /** Apply transport-only timeout and credential-boundary handling to a raw Fetch override. */
  createRawFetch(
    fetchImpl: typeof globalThis.fetch = this.fetchImpl,
    authorizationIsExplicit = false,
  ): typeof globalThis.fetch {
    return (input, init) => {
      const sanitizedRequest = prepareRawRequestForTransport(
        input,
        init,
        this.baseUrl,
        this.defaultAuthorization,
        authorizationIsExplicit,
      );
      return sanitizedRequest ? fetchImpl(sanitizedRequest) : fetchImpl(input, init);
    };
  }

  /** Execute a complete openapi-fetch call with middleware inside the managed raw pipeline. */
  async requestRaw<T extends ApiCallResult>(
    method: string,
    path: string,
    externalSignal: AbortSignal | null | undefined,
    fn: (signal: AbortSignal | null | undefined) => Promise<T>,
  ): Promise<T> {
    await callHook(this.hooks, "onRequest", { method, path });
    const start = Date.now();

    for (let attempt = 1; attempt <= this.retryOpts.maxAttempts; attempt++) {
      let result: T;
      try {
        await this.rateLimiter.acquire(externalSignal);
        result = await this.executeRawAttempt(externalSignal, fn);
      } catch (cause) {
        return this.failRawRequest(method, path, start, cause, externalSignal);
      }

      const { response } = result;
      if (isRetryable(response.status, this.retryOpts) && attempt < this.retryOpts.maxAttempts) {
        if (externalSignal?.aborted) {
          return this.failRawRequest(
            method,
            path,
            start,
            getAbortReason(externalSignal),
            externalSignal,
          );
        }
        const delayMs = calculateDelay(
          attempt,
          this.retryOpts,
          response.headers.get("retry-after"),
        );
        await callHook(this.hooks, "onRetry", {
          method,
          path,
          attempt,
          maxAttempts: this.retryOpts.maxAttempts,
          delayMs,
          reason: `HTTP ${response.status}`,
        });
        try {
          await sleep(delayMs, externalSignal);
        } catch (cause) {
          return this.failRawRequest(method, path, start, cause, externalSignal);
        }
        continue;
      }

      if (response.ok) {
        await callHook(this.hooks, "onResponse", {
          method,
          path,
          status: response.status,
          durationMs: Date.now() - start,
        });
      } else {
        await callHook(this.hooks, "onError", {
          method,
          path,
          error: mapHttpError(response, undefined),
          durationMs: Date.now() - start,
        });
      }
      return result;
    }

    throw new Error("Max retry attempts reached");
  }

  /** Report a locally detected validation failure through the normal logical-operation hooks. */
  async rejectValidation(
    method: string,
    path: string,
    issues: ValidationIssue[],
  ): Promise<Result<never>> {
    await callHook(this.hooks, "onRequest", { method, path });
    const start = Date.now();
    return this.finishError(method, path, start, { kind: "Validation", issues });
  }

  private async failRawRequest(
    method: string,
    path: string,
    start: number,
    cause: unknown,
    externalSignal: AbortSignal | null | undefined,
  ): Promise<never> {
    const externallyAborted = externalSignal?.aborted === true;
    await callHook(this.hooks, "onError", {
      method,
      path,
      error: mapOperationalError(externallyAborted ? createAbortError() : cause),
      durationMs: Date.now() - start,
    });
    throw externallyAborted ? getAbortReason(externalSignal) : cause;
  }

  private async executeRawAttempt<T extends ApiCallResult>(
    externalSignal: AbortSignal | null | undefined,
    fn: (signal: AbortSignal | null | undefined) => Promise<T>,
  ): Promise<T> {
    if (externalSignal?.aborted) throw createAbortError();
    if (this.timeoutMs === undefined) return fn(externalSignal);

    const controller = new AbortController();
    const deadline = new RequestDeadline(this.timeoutMs, controller, externalSignal);
    try {
      const operation = Promise.resolve().then(() => fn(controller.signal));
      const result = await deadline.race(operation);
      if (result.data instanceof ReadableStream) {
        return {
          ...result,
          data: wrapBodyWithDeadline(result.data, deadline),
        } as T;
      }
      deadline.complete();
      return result;
    } catch (cause) {
      deadline.complete();
      throw cause;
    }
  }

  /** JSON request with Valibot schema validation and camelCase response keys. */
  async requestJson<TWire>(
    method: string,
    path: string,
    fn: (signal: AbortSignal | undefined) => Promise<ApiCallResult>,
    schema: v.GenericSchema<unknown, TWire>,
  ): Promise<Result<CamelCaseKeys<TWire>>>;
  async requestJson<TWire>(
    method: string,
    path: string,
    fn: (signal: AbortSignal | undefined) => Promise<ApiCallResult<TWire>>,
    schema?: undefined,
  ): Promise<Result<CamelCaseKeys<TWire>>>;
  async requestJson<TWire>(
    method: string,
    path: string,
    fn: (signal: AbortSignal | undefined) => Promise<ApiCallResult<TWire>>,
    schema?: v.GenericSchema<unknown, TWire>,
  ): Promise<Result<CamelCaseKeys<TWire>>> {
    return this.executeWithRetry(method, path, async () => {
      const { data, error, response } = await this.executeManagedAttempt(fn);
      if (!response.ok) return { ok: false as const, response, error };

      if (schema) {
        const parsed = v.safeParse(schema, data);
        if (!parsed.success) {
          return {
            ok: false as const,
            validationIssues: toValidationIssues(parsed.issues),
          };
        }
        return {
          ok: true as const,
          value: camelCaseKeys(parsed.output),
          response,
        };
      }

      return {
        ok: true as const,
        value: camelCaseKeys(data as TWire),
        response,
      };
    });
  }

  /** Keep the per-attempt deadline active through middleware and response parsing. */
  private async executeManagedAttempt<T>(
    fn: (signal: AbortSignal | undefined) => Promise<T>,
  ): Promise<T> {
    if (this.timeoutMs === undefined) return fn(undefined);

    const controller = new AbortController();
    const deadline = new RequestDeadline(this.timeoutMs, controller);
    try {
      const operation = Promise.resolve().then(() => fn(controller.signal));
      const result = await deadline.race(operation);
      deadline.complete();
      return result;
    } catch (cause) {
      deadline.complete();
      throw cause;
    }
  }

  /** Binary request (FIT/GPX/ZIP downloads). */
  async requestBinary(method: string, path: string, urlPath: string): Promise<Result<ArrayBuffer>> {
    const result = await this.requestBinaryDownload(method, path, urlPath);
    if (!result.ok) return result;
    return ok(result.value.bytes);
  }

  /** Binary request including safe response metadata. */
  async requestBinaryDownload(
    method: string,
    path: string,
    urlPath: string,
  ): Promise<Result<BinaryDownload>> {
    return this.executeWithRetry(method, path, async () => {
      const url = `${this.baseUrl}${urlPath}`;
      const headers = createAuthHeaders(this.auth);
      const response = await this.fetch(url, { method, headers });
      if (!response.ok) {
        return {
          ok: false as const,
          response,
          error: await response.text(),
        };
      }
      return {
        ok: true as const,
        value: {
          bytes: await response.arrayBuffer(),
          filename: parseDownloadFilename(response.headers.get("content-disposition")),
          contentType: response.headers.get("content-type"),
          contentLength: parseContentLength(response.headers.get("content-length")),
          contentEncoding: response.headers.get("content-encoding"),
        },
        response,
      };
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
      let result: ExecuteResult<T>;
      try {
        await this.rateLimiter.acquire();
        result = await fn();
      } catch (cause) {
        return this.finishError(method, path, start, mapOperationalError(cause));
      }

      if ("validationIssues" in result) {
        return this.finishError(method, path, start, {
          kind: "Validation",
          issues: result.validationIssues,
        });
      }

      if (result.ok) {
        await callHook(this.hooks, "onResponse", {
          method,
          path,
          status: result.response.status,
          durationMs: Date.now() - start,
        });
        return ok(result.value);
      }

      const status = result.response.status;
      if (isRetryable(status, this.retryOpts) && attempt < this.retryOpts.maxAttempts) {
        const retryAfter = result.response.headers.get("retry-after");
        const delayMs = calculateDelay(attempt, this.retryOpts, retryAfter);
        await callHook(this.hooks, "onRetry", {
          method,
          path,
          attempt,
          maxAttempts: this.retryOpts.maxAttempts,
          delayMs,
          reason: `HTTP ${status}`,
        });
        await sleep(delayMs);
        continue;
      }

      return this.finishError(method, path, start, mapHttpError(result.response, result.error));
    }

    return this.finishError(method, path, start, {
      kind: "Unknown",
      error: "Max retry attempts reached",
    });
  }

  private async finishError<T>(
    method: string,
    path: string,
    start: number,
    error: ApiError,
  ): Promise<Result<T>> {
    await callHook(this.hooks, "onError", {
      method,
      path,
      error,
      durationMs: Date.now() - start,
    });
    return err(error);
  }

  private async fetchWithTimeout(
    fetchImpl: typeof globalThis.fetch,
    input: FetchInput,
    init?: FetchInit,
    includeResponseBody = false,
    releaseOnOpenApiEmptyBody = false,
  ): Promise<Response> {
    const requestMethod = getFetchMethod(input, init);

    if (this.timeoutMs === undefined) {
      const response = await fetchImpl(input, init);
      return includeResponseBody &&
        response.body !== null &&
        !(releaseOnOpenApiEmptyBody && openApiFetchTreatsResponseAsEmpty(response, requestMethod))
        ? wrapManagedResponse(response)
        : response;
    }

    const controller = new AbortController();
    const externalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (externalSignal?.aborted) throw createAbortError();

    const deadline = new RequestDeadline(this.timeoutMs, controller, externalSignal);

    try {
      const response = await deadline.race(
        fetchImpl(input, { ...init, signal: controller.signal }),
      );
      if (
        !includeResponseBody ||
        response.body === null ||
        (releaseOnOpenApiEmptyBody && openApiFetchTreatsResponseAsEmpty(response, requestMethod))
      ) {
        deadline.complete();
        return response;
      }
      return wrapManagedResponse(response, deadline);
    } catch (cause) {
      deadline.complete();
      throw cause;
    }
  }
}

type ApiCallResult<T = unknown> = {
  data?: T;
  error?: unknown;
  response: Response;
};

type ExecuteResult<T> =
  | { ok: true; value: T; response: Response }
  | { ok: false; response: Response; error: unknown }
  | { ok: false; validationIssues: ValidationIssue[] };

class RequestTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Request exceeded configured timeout of ${timeoutMs} ms`);
    this.name = "RequestTimeoutError";
  }
}

class ResponseBodyReadError extends Error {
  constructor(readonly cause: unknown) {
    super("Response body read failed");
    this.name = "ResponseBodyReadError";
  }
}

class RequestDeadline {
  private readonly timeoutPromise: Promise<never>;
  private readonly timer: ReturnType<typeof setTimeout>;
  private removeExternalListener: () => void = () => {};
  private failure?: Error;
  private completed = false;

  constructor(
    timeoutMs: number,
    private readonly controller: AbortController,
    externalSignal?: AbortSignal | null,
  ) {
    let rejectTimeout!: (error: Error) => void;
    this.timeoutPromise = new Promise<never>((_resolve, reject) => {
      rejectTimeout = reject;
    });
    // A response may intentionally be returned as a stream and consumed later.
    // Mark the deadline rejection handled even while no read is currently awaiting it.
    void this.timeoutPromise.catch(() => undefined);

    this.timer = setTimeout(() => {
      this.abort(new RequestTimeoutError(timeoutMs), rejectTimeout);
    }, timeoutMs);

    if (externalSignal) {
      const onAbort = () => {
        this.controller.abort(externalSignal.reason);
        this.abort(createAbortError(), rejectTimeout);
      };
      externalSignal.addEventListener("abort", onAbort, { once: true });
      this.removeExternalListener = () => externalSignal.removeEventListener("abort", onAbort);
    }
  }

  async race<T>(operation: Promise<T>): Promise<T> {
    if (this.failure) throw this.failure;
    if (this.completed) return operation;

    try {
      return await Promise.race([operation, this.timeoutPromise]);
    } catch (cause) {
      throw this.failure ?? cause;
    }
  }

  complete(): void {
    if (this.completed) return;
    this.completed = true;
    clearTimeout(this.timer);
    this.removeExternalListener();
  }

  private abort(error: Error, rejectTimeout: (error: Error) => void): void {
    if (this.completed || this.failure) return;
    this.failure = error;
    this.controller.abort(error);
    clearTimeout(this.timer);
    this.removeExternalListener();
    rejectTimeout(error);
  }
}

const RESPONSE_BODY_METHODS = new Set<PropertyKey>([
  "arrayBuffer",
  "blob",
  "formData",
  "json",
  "text",
]);

function wrapManagedResponse(response: Response, deadline?: RequestDeadline): Response {
  let wrappedBody: ReadableStream<Uint8Array> | undefined;

  return new Proxy(response, {
    get(target, property) {
      if (property === "body") {
        if (wrappedBody === undefined && target.bodyUsed) return target.body;
        wrappedBody ??= wrapBodyWithDeadline(target.body!, deadline);
        return wrappedBody;
      }

      if (property === "clone") {
        return () => wrapManagedResponse(target.clone(), deadline);
      }

      if (RESPONSE_BODY_METHODS.has(property)) {
        const method = Reflect.get(target, property, target) as (
          ...args: unknown[]
        ) => Promise<unknown>;
        return (...args: unknown[]) =>
          consumeResponseBody(deadline, () => method.apply(target, args), property === "json");
      }

      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function consumeResponseBody<T>(
  deadline: RequestDeadline | undefined,
  consume: () => Promise<T>,
  preserveMalformedJson = false,
): Promise<T> {
  try {
    const operation = Promise.resolve().then(consume);
    return await (deadline ? deadline.race(operation) : operation);
  } catch (cause) {
    throw normalizeResponseBodyError(cause, preserveMalformedJson);
  } finally {
    deadline?.complete();
  }
}

function wrapBodyWithDeadline(
  body: ReadableStream<Uint8Array>,
  deadline?: RequestDeadline,
): ReadableStream<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const getReader = () => (reader ??= body.getReader());

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const read = getReader().read();
        const result = await (deadline ? deadline.race(read) : read);
        if (result.done) {
          deadline?.complete();
          controller.close();
          return;
        }
        controller.enqueue(result.value);
      } catch (cause) {
        void reader?.cancel(cause).catch(() => undefined);
        deadline?.complete();
        controller.error(normalizeResponseBodyError(cause));
      }
    },
    async cancel(reason) {
      try {
        await getReader().cancel(reason);
      } finally {
        deadline?.complete();
      }
    },
  });
}

function normalizeResponseBodyError(error: unknown, preserveMalformedJson = false): unknown {
  if (
    error instanceof RequestTimeoutError ||
    error instanceof ResponseBodyReadError ||
    isAbortError(error) ||
    (preserveMalformedJson && isMalformedJsonError(error))
  ) {
    return error;
  }
  return new ResponseBodyReadError(error);
}

function mapHttpError(response: Response, body: unknown): ApiError {
  switch (response.status) {
    case 401:
      return { kind: "Unauthorized", status: 401, body };
    case 403:
      return { kind: "Forbidden", status: 403, body };
    case 404:
      return { kind: "NotFound", status: 404, body };
    case 429:
      return {
        kind: "RateLimit",
        status: 429,
        retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")) ?? 0,
        body,
      };
    default:
      return {
        kind: "Http",
        status: response.status,
        statusText: response.statusText,
        body,
      };
  }
}

function mapOperationalError(error: unknown): ApiError {
  if (error instanceof RequestTimeoutError) {
    return { kind: "Timeout", message: error.message };
  }

  if (error instanceof ResponseBodyReadError) {
    return { kind: "Network", message: "Network request failed" };
  }

  if (isAbortError(error)) {
    return { kind: "Network", message: "Request aborted" };
  }

  if (isMalformedJsonError(error)) {
    return {
      kind: "Validation",
      issues: [
        {
          path: "",
          message: "Response body was not valid JSON",
          expected: "valid JSON",
          received: undefined,
        },
      ],
    };
  }

  if (isNetworkError(error)) {
    return { kind: "Network", message: "Network request failed" };
  }

  return { kind: "Unknown", error };
}

function isMalformedJsonError(error: unknown): boolean {
  return error instanceof SyntaxError;
}

function isAbortError(error: unknown): boolean {
  const name = getErrorName(error);
  return name === "AbortError" || name === "TimeoutError";
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (getErrorName(error) === "FetchError") return true;

  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? (error as { cause?: unknown }).cause
      : undefined;
  const code =
    typeof cause === "object" && cause !== null && "code" in cause
      ? String((cause as { code?: unknown }).code)
      : "";
  return ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(code);
}

function getErrorName(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "name" in error
    ? String((error as { name?: unknown }).name)
    : undefined;
}

function createAbortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function getFetchMethod(input: FetchInput, init?: FetchInit): string {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
}

/** Keep deadline ownership aligned with openapi-fetch's empty-response fast path. */
function openApiFetchTreatsResponseAsEmpty(response: Response, requestMethod: string): boolean {
  const contentLength = response.headers.get("content-length");
  return (
    response.status === 204 ||
    requestMethod === "HEAD" ||
    (contentLength === "0" && !response.headers.get("transfer-encoding")?.includes("chunked"))
  );
}

/**
 * Preserve custom Request instances unless enforcing the cross-origin credential boundary
 * requires materializing an effective Request with the inherited credential removed.
 */
function prepareRawRequestForTransport(
  input: FetchInput,
  init: FetchInit,
  trustedBaseUrl: string,
  defaultAuthorization: string,
  authorizationIsExplicit: boolean,
): Request | undefined {
  if (authorizationIsExplicit || isTrustedFetchOrigin(input, trustedBaseUrl)) return undefined;

  const inputHeaders = input instanceof Request ? input.headers : undefined;
  const inputAuthorization = inputHeaders?.get("authorization") ?? null;
  const headersAreOverridden = init?.headers !== undefined;
  const effectiveHeaders = new Headers(headersAreOverridden ? init.headers : inputHeaders);
  const effectiveAuthorization = effectiveHeaders.get("authorization");
  const removesInheritedDefault =
    inputAuthorization === defaultAuthorization && headersAreOverridden;

  if (effectiveAuthorization !== defaultAuthorization && !removesInheritedDefault) {
    return undefined;
  }

  if (effectiveAuthorization === defaultAuthorization) {
    effectiveHeaders.delete("authorization");
  }
  return new Request(input, { ...init, headers: effectiveHeaders });
}

function isTrustedFetchOrigin(input: FetchInput, trustedBaseUrl: string): boolean {
  try {
    const inputUrl =
      input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    return new URL(inputUrl).origin === new URL(trustedBaseUrl).origin;
  } catch {
    return false;
  }
}

function stripCrossOriginDefaultAuthorization(
  request: Request,
  trustedBaseUrl: string,
  defaultAuthorization: string,
): Request {
  let trustedOrigin: string | undefined;
  try {
    trustedOrigin = new URL(trustedBaseUrl).origin;
  } catch {
    // An unresolvable trust boundary must fail closed.
  }

  if (trustedOrigin !== undefined && new URL(request.url).origin === trustedOrigin) return request;

  if (request.headers.get("authorization") !== defaultAuthorization) return request;

  const headers = new Headers(request.headers);
  headers.delete("authorization");
  return new Request(request, { headers });
}

function parseContentLength(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const MAX_FILENAME_UTF8_BYTES = 255;
const MAX_FILENAME_UTF16_UNITS = 255;
const MAX_PRESERVED_EXTENSION_BYTES = 32;
const MAX_PRESERVED_EXTENSION_UNITS = 32;
const filenameEncoder = new TextEncoder();

function parseDownloadFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;

  const extended = contentDisposition.match(/(?:^|;)\s*filename\*\s*=\s*([^;]+)/i)?.[1];
  const basic = contentDisposition.match(/(?:^|;)\s*filename\s*=\s*("[^"]*"|[^;]+)/i)?.[1];
  let candidate = extended ?? basic;
  if (!candidate) return null;

  candidate = candidate.trim().replace(/^"|"$/g, "");
  if (extended) {
    candidate = candidate.replace(/^[^']*'[^']*'/, "");
    try {
      candidate = decodeURIComponent(candidate);
    } catch {
      return null;
    }
  }

  const basename = candidate.replace(/\\/g, "/").split("/").pop() ?? "";
  let sanitized = stripUnsafeFilenameCharacters(basename)
    .replace(/[<>:"|?*]/gu, "_")
    .trim()
    .replace(/[. ]+$/gu, "");
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  sanitized = truncateFilenameForFilesystems(sanitized).replace(/[. ]+$/gu, "");
  return sanitized && sanitized !== "." && sanitized !== ".." ? sanitized : null;
}

function truncateFilenameForFilesystems(value: string): string {
  if (filenameFitsFilesystemLimits(value)) return value;

  const extensionIndex = value.lastIndexOf(".");
  if (extensionIndex > 0) {
    const extension = value.slice(extensionIndex);
    const extensionBytes = filenameUtf8Bytes(extension);
    if (
      extension.length <= MAX_PRESERVED_EXTENSION_UNITS &&
      extensionBytes <= MAX_PRESERVED_EXTENSION_BYTES
    ) {
      const stem = takeFilenamePrefix(value.slice(0, extensionIndex), extension);
      if (stem) return `${stem}${extension}`;
    }
  }

  return takeFilenamePrefix(value);
}

function filenameFitsFilesystemLimits(value: string): boolean {
  return (
    value.length <= MAX_FILENAME_UTF16_UNITS && filenameUtf8Bytes(value) <= MAX_FILENAME_UTF8_BYTES
  );
}

function takeFilenamePrefix(value: string, reservedSuffix = ""): string {
  let utf16Units = reservedSuffix.length;
  let utf8Bytes = filenameUtf8Bytes(reservedSuffix);
  let result = "";

  for (const character of value) {
    const characterBytes = filenameUtf8Bytes(character);
    if (
      utf16Units + character.length > MAX_FILENAME_UTF16_UNITS ||
      utf8Bytes + characterBytes > MAX_FILENAME_UTF8_BYTES
    ) {
      break;
    }
    result += character;
    utf16Units += character.length;
    utf8Bytes += characterBytes;
  }

  return result;
}

function filenameUtf8Bytes(value: string): number {
  return filenameEncoder.encode(value).byteLength;
}

function stripUnsafeFilenameCharacters(value: string): string {
  return [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      const isControl = codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
      const isBidirectionalOverride =
        (codePoint >= 0x202a && codePoint <= 0x202e) ||
        (codePoint >= 0x2066 && codePoint <= 0x2069);
      return !isControl && !isBidirectionalOverride;
    })
    .join("");
}

async function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (!Number.isFinite(ms)) throw new Error("Retry delay must be finite");
  if (signal?.aborted) throw getAbortReason(signal);

  let remainingMs = Math.max(0, ms);
  while (remainingMs > MAX_TIMER_DELAY_MS) {
    await sleepChunk(MAX_TIMER_DELAY_MS, signal);
    remainingMs -= MAX_TIMER_DELAY_MS;
  }
  await sleepChunk(remainingMs, signal);
}

function sleepChunk(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, ms));
  if (signal.aborted) return Promise.reject(getAbortReason(signal));

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(getAbortReason(signal));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function getAbortReason(signal: AbortSignal): unknown {
  return signal.reason === undefined ? createAbortError() : signal.reason;
}
