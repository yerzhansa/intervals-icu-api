import * as v from "valibot";
import { createAuthHeaders, type AuthConfig } from "./auth.js";
import type { BinaryDownload } from "./download.js";
import { RateLimiter } from "./rate-limiter.js";
import {
  type RequestRetryMode,
  type ResolvedRetryOptions,
  type RetryCause,
  decideRetry,
  parseRetryAfterMs,
} from "./retry.js";
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
  retryOpts: ResolvedRetryOptions;
  hooks: Hooks;
  baseUrl: string;
  auth: AuthConfig;
  fetchImpl?: typeof globalThis.fetch;
  timeoutMs?: number;
}

type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];
const MAX_TIMER_DELAY_MS = 2_147_483_647;

export type ResultRequestMethod = "GET" | "HEAD" | "OPTIONS" | "PUT" | "POST" | "PATCH" | "DELETE";

export type ResultParseAs = "json" | "text" | "arrayBuffer" | "blob" | "formData" | "none";

export type QueryPrimitive = string | number | boolean | null | undefined;
export type RequestQuery =
  | URLSearchParams
  | Record<string, QueryPrimitive | readonly QueryPrimitive[]>;

export interface RequestSuccess<T> {
  data: T;
  /** The original response. Its body has been consumed or explicitly cancelled. */
  response: Response;
}

export interface ResultRequestCommonOptions extends Omit<
  RequestInit,
  "method" | "headers" | "body" | "signal"
> {
  method?: ResultRequestMethod;
  headers?: HeadersInit | Record<string, string | undefined>;
  query?: RequestQuery;
  signal?: AbortSignal;
  parseAs?: ResultParseAs;
  retry?: RequestRetryMode;
  /** Stable, identifier-free path supplied to lifecycle hooks. */
  hookPath?: string;
  fetch?: typeof globalThis.fetch;
  /** Required by Fetch implementations for a ReadableStream request body. */
  duplex?: "half";
}

export type ResultRequestBody =
  | { json?: unknown; body?: never; bodyFactory?: never }
  | { json?: never; body?: BodyInit | null; bodyFactory?: never }
  | { json?: never; body?: never; bodyFactory: () => BodyInit | null };

export type ResultRequestOptions<
  T = unknown,
  P extends ResultParseAs = ResultParseAs,
> = ResultRequestCommonOptions & ResultRequestBody & ResultRequestParsingOptions<T, P>;

type ResultRequestParsingOptions<T, P extends ResultParseAs> =
  | (ResultRequestParseSelector<P> & { schema?: never })
  | ([Extract<P, "json">] extends [never]
      ? never
      : {
          parseAs?: "json";
          /** The schema receives the exact parsed wire-shaped value. */
          schema: v.GenericSchema<unknown, T>;
        });

type ResultRequestParseSelector<P extends ResultParseAs> = [Extract<P, "json">] extends [never]
  ? { parseAs: P }
  : { parseAs?: P };

export type ResultRequestData<P extends ResultParseAs, T> = P extends "json"
  ? T
  : P extends "text"
    ? string
    : P extends "arrayBuffer"
      ? ArrayBuffer
      : P extends "blob"
        ? Blob
        : P extends "formData"
          ? FormData
          : undefined;

export type ResultRequestArguments<T, P extends ResultParseAs> = [Extract<P, "json">] extends [
  never,
]
  ? [options: ResultRequestOptions<T, P>]
  : [options?: ResultRequestOptions<T, P>];

export class HttpExecutor {
  private rateLimiter: RateLimiter;
  private retryOpts: ResolvedRetryOptions;
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
    this.openApiFetch = this.createManagedOpenApiFetch(this.fetchImpl);
    this.rawFetch = this.createRawFetch(this.fetchImpl);
  }

  /** Apply transport-only timeout and credential-boundary handling to a raw Fetch override. */
  createRawFetch(
    fetchImpl: typeof globalThis.fetch = this.fetchImpl,
    authorizationIsExplicit = false,
  ): typeof globalThis.fetch {
    return (input, init) => {
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      if (signal?.aborted) return Promise.reject(getAbortReason(signal));
      const sanitizedRequest = prepareRawRequestForTransport(
        input,
        init,
        this.baseUrl,
        this.defaultAuthorization,
        authorizationIsExplicit,
      );
      return sanitizedRequest
        ? fetchAtTransportBoundary(fetchImpl, sanitizedRequest)
        : fetchAtTransportBoundary(fetchImpl, input, init);
    };
  }

  /** Observe raw body-reader failures and restore the original response after every attempt. */
  createObservedRawFetch(
    fetchImpl: typeof globalThis.fetch = this.fetchImpl,
    authorizationIsExplicit = false,
  ): { fetch: typeof globalThis.fetch; cleanup: () => void } {
    const transport = this.createRawFetch(fetchImpl, authorizationIsExplicit);
    const observers = new Set<() => void>();
    return {
      fetch: async (input, init) =>
        observeRawResponseBodyFailures(await transport(input, init), observers),
      cleanup: () => {
        for (const restore of observers) restore();
      },
    };
  }

  /** Preserve managed body-read classification without changing the raw response contract. */
  private createManagedOpenApiFetch(fetchImpl: typeof globalThis.fetch): typeof globalThis.fetch {
    const transport = this.createRawFetch(fetchImpl);
    return async (input, init) => {
      const response = await transport(input, init);
      return response.body === null ? response : wrapManagedResponse(response);
    };
  }

  /** Execute a complete openapi-fetch call with middleware inside the managed raw pipeline. */
  async requestRaw<T extends ApiCallResult>(
    method: string,
    path: string,
    externalSignal: AbortSignal | null | undefined,
    bodyReplayable: boolean,
    fn: (signal: AbortSignal | null | undefined) => Promise<T>,
    cleanupAttempt?: () => void,
  ): Promise<T> {
    await callHook(this.hooks, "onRequest", { method, path });
    const start = Date.now();

    for (let attempt = 1; attempt <= this.retryOpts.maxAttempts; attempt++) {
      let result: T;
      try {
        await this.rateLimiter.acquire(externalSignal);
        try {
          result = await this.executeRawAttempt(externalSignal, fn);
        } finally {
          cleanupAttempt?.();
        }
      } catch (cause) {
        if (externalSignal?.aborted) {
          return this.failRawRequest(method, path, start, cause, externalSignal);
        }

        const mapped = mapOperationalError(cause);
        const retryCause = retryCauseForError(mapped);
        const decision = retryCause
          ? decideRetry(
              {
                method,
                mode: "auto",
                bodyReplayable,
                attempt,
                cause: retryCause,
              },
              this.retryOpts,
            )
          : undefined;
        if (!decision) return this.failRawRequest(method, path, start, cause, externalSignal);

        try {
          await this.waitForRetry(method, path, attempt, decision, externalSignal);
        } catch (retryCause) {
          return this.failRawRequest(method, path, start, retryCause, externalSignal);
        }
        continue;
      }

      const { response } = result;
      const decision = response.ok
        ? undefined
        : decideRetry(
            {
              method,
              mode: "auto",
              bodyReplayable,
              attempt,
              cause: { kind: "Http", status: response.status },
              retryAfterHeader: response.headers.get("retry-after"),
            },
            this.retryOpts,
          );
      if (decision) {
        try {
          await this.waitForRetry(method, path, attempt, decision, externalSignal);
        } catch (cause) {
          return this.failRawRequest(method, path, start, cause, externalSignal);
        }
        continue;
      }

      if (externalSignal?.aborted) {
        return this.failRawRequest(
          method,
          path,
          start,
          getAbortReason(externalSignal),
          externalSignal,
        );
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

  private async waitForRetry(
    method: string,
    path: string,
    attempt: number,
    decision: { cause: RetryCause; delayMs: number; reason: string },
    signal?: AbortSignal | null,
  ): Promise<void> {
    if (signal?.aborted) throw getAbortReason(signal);
    await callHook(this.hooks, "onRetry", {
      method,
      path,
      attempt,
      maxAttempts: this.retryOpts.maxAttempts,
      delayMs: decision.delayMs,
      reason: decision.reason,
      cause: decision.cause,
    });
    await sleep(decision.delayMs, signal);
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

  /** Fetch an arbitrary endpoint while preserving Result/error, retry, hook, and auth contracts. */
  async request<T = unknown, P extends ResultParseAs = "json">(
    input: string | URL,
    ...args: ResultRequestArguments<T, P>
  ): Promise<Result<RequestSuccess<ResultRequestData<P, T>>>> {
    const options = (args[0] ?? {}) as ResultRequestOptions<T, P>;
    const internal = options as ResultRequestCommonOptions & {
      json?: unknown;
      body?: BodyInit | null;
      bodyFactory?: () => BodyInit | null;
      schema?: v.GenericSchema<unknown, T>;
    };
    const method = (internal.method ?? "GET").toUpperCase();
    const path = internal.hookPath ?? "<arbitrary>";
    const parseAs = (internal.parseAs ?? "json") as ResultParseAs;

    const preparation = prepareArbitraryRequest(input, internal, this.baseUrl, method, parseAs);
    if (!preparation.ok) return this.rejectValidation(method, path, preparation.issues);

    const authorizationIsExplicit = hasAuthorizationHeader(internal.headers);
    const transport = this.createRawFetch(internal.fetch, authorizationIsExplicit);
    const factoryStreams = new WeakSet<ReadableStream>();
    const response = await this.executeWithRetry(
      method,
      path,
      () =>
        this.executeManagedAttempt(async (signal) => {
          const attempt = prepareArbitraryAttempt(
            preparation,
            internal,
            this.auth,
            method,
            signal,
            factoryStreams,
          );
          if (!attempt.ok) return { ok: false as const, localError: attempt.error };

          const networkResponse = await transport(attempt.request);
          if (!networkResponse.ok) {
            return {
              ok: false as const,
              response: networkResponse,
              error: await readHttpErrorBody(networkResponse),
            };
          }

          const parsed = await parseArbitraryResponse(networkResponse, parseAs);
          if (internal.schema) {
            const validated = v.safeParse(internal.schema, parsed);
            if (!validated.success) {
              return {
                ok: false as const,
                validationIssues: toValidationIssues(validated.issues),
              };
            }
            return {
              ok: true as const,
              value: { data: validated.output, response: networkResponse },
              response: networkResponse,
            };
          }

          return {
            ok: true as const,
            value: { data: parsed, response: networkResponse },
            response: networkResponse,
          };
        }, internal.signal),
      {
        signal: internal.signal,
        retryMode: internal.retry ?? "auto",
        bodyReplayable: preparation.bodyReplayable,
      },
    );

    return response as Result<RequestSuccess<ResultRequestData<P, T>>>;
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
    externalSignal?: AbortSignal | null,
  ): Promise<T> {
    if (externalSignal?.aborted) throw getAbortReason(externalSignal);
    if (this.timeoutMs === undefined) return fn(externalSignal ?? undefined);

    const controller = new AbortController();
    const deadline = new RequestDeadline(this.timeoutMs, controller, externalSignal);
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
    options: {
      signal?: AbortSignal | null;
      retryMode?: RequestRetryMode;
      bodyReplayable?: boolean;
    } = {},
  ): Promise<Result<T>> {
    await callHook(this.hooks, "onRequest", { method, path });
    const start = Date.now();
    const signal = options.signal;
    const retryMode = options.retryMode ?? "auto";
    const bodyReplayable = options.bodyReplayable ?? true;

    for (let attempt = 1; attempt <= this.retryOpts.maxAttempts; attempt++) {
      let result: ExecuteResult<T>;
      try {
        await this.rateLimiter.acquire(signal);
        result = await fn();
      } catch (cause) {
        const mapped = mapOperationalError(signal?.aborted ? createAbortError() : cause);
        const retryCause = signal?.aborted ? undefined : retryCauseForError(mapped);
        const decision = retryCause
          ? decideRetry(
              {
                method,
                mode: retryMode,
                bodyReplayable,
                attempt,
                cause: retryCause,
              },
              this.retryOpts,
            )
          : undefined;
        if (!decision) return this.finishError(method, path, start, mapped);

        try {
          await this.waitForRetry(method, path, attempt, decision, signal);
        } catch {
          return this.finishError(method, path, start, {
            kind: "Network",
            message: "Request aborted",
          });
        }
        continue;
      }

      if ("localError" in result) {
        return this.finishError(method, path, start, result.localError);
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
      const decision = decideRetry(
        {
          method,
          mode: retryMode,
          bodyReplayable,
          attempt,
          cause: { kind: "Http", status },
          retryAfterHeader: result.response.headers.get("retry-after"),
        },
        this.retryOpts,
      );
      if (decision) {
        try {
          await this.waitForRetry(method, path, attempt, decision, signal);
        } catch {
          return this.finishError(method, path, start, {
            kind: "Network",
            message: "Request aborted",
          });
        }
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
  ): Promise<Response> {
    if (this.timeoutMs === undefined) {
      const response = await fetchAtTransportBoundary(fetchImpl, input, init);
      return includeResponseBody && response.body !== null
        ? wrapManagedResponse(response)
        : response;
    }

    const controller = new AbortController();
    const externalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (externalSignal?.aborted) throw createAbortError();

    const deadline = new RequestDeadline(this.timeoutMs, controller, externalSignal);

    try {
      const response = await deadline.race(
        fetchAtTransportBoundary(fetchImpl, input, { ...init, signal: controller.signal }),
      );
      if (!includeResponseBody || response.body === null) {
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
  | { ok: false; localError: ApiError }
  | { ok: false; validationIssues: ValidationIssue[] };

type ArbitraryInternalOptions<T> = ResultRequestCommonOptions & {
  json?: unknown;
  body?: BodyInit | null;
  bodyFactory?: () => BodyInit | null;
  schema?: v.GenericSchema<unknown, T>;
};

type ArbitraryPreparation =
  | {
      ok: true;
      url: string;
      requestInit: RequestInit & { duplex?: "half" };
      hasJson: boolean;
      jsonBody?: string;
      bodyReplayable: boolean;
    }
  | { ok: false; issues: ValidationIssue[] };

const RESULT_REQUEST_METHODS = new Set<ResultRequestMethod>([
  "GET",
  "HEAD",
  "OPTIONS",
  "PUT",
  "POST",
  "PATCH",
  "DELETE",
]);
const RESULT_PARSE_MODES = new Set<ResultParseAs>([
  "json",
  "text",
  "arrayBuffer",
  "blob",
  "formData",
  "none",
]);
const REQUEST_RETRY_MODES = new Set<RequestRetryMode>(["auto", "idempotent", "never"]);

function prepareArbitraryRequest<T>(
  input: string | URL,
  options: ArbitraryInternalOptions<T>,
  baseUrl: string,
  method: string,
  parseAs: ResultParseAs,
): ArbitraryPreparation {
  const issue = (message: string, expected: string, received: unknown): ArbitraryPreparation => ({
    ok: false,
    issues: [{ path: "", message, expected, received }],
  });

  if (!RESULT_REQUEST_METHODS.has(method as ResultRequestMethod)) {
    return issue(
      "Unsupported request method",
      "GET, HEAD, OPTIONS, PUT, POST, PATCH, or DELETE",
      method,
    );
  }
  if (!RESULT_PARSE_MODES.has(parseAs)) {
    return issue("Unsupported response parser", "a supported parseAs value", parseAs);
  }
  if (options.retry !== undefined && !REQUEST_RETRY_MODES.has(options.retry)) {
    return issue("Unsupported retry mode", "auto, idempotent, or never", options.retry);
  }
  if (options.schema !== undefined && parseAs !== "json") {
    return issue("Response schemas require JSON parsing", 'parseAs: "json"', parseAs);
  }
  if (options.duplex !== undefined && options.duplex !== "half") {
    return issue("Unsupported duplex mode", 'duplex: "half"', options.duplex);
  }

  const bodyFields = [
    options.json !== undefined,
    options.body !== undefined && options.body !== null,
    options.bodyFactory !== undefined,
  ].filter(Boolean).length;
  if (bodyFields > 1) {
    return issue(
      "Request body options are mutually exclusive",
      "one of json, body, or bodyFactory",
      undefined,
    );
  }
  if (options.bodyFactory !== undefined && typeof options.bodyFactory !== "function") {
    return issue(
      "bodyFactory must be a function",
      "a function returning a fresh BodyInit",
      typeof options.bodyFactory,
    );
  }
  if ((method === "GET" || method === "HEAD") && bodyFields > 0) {
    return issue(`${method} requests cannot include a body`, "no request body", undefined);
  }
  if (isReadableStreamBody(options.body) && options.duplex !== "half") {
    return issue(
      "ReadableStream request bodies require duplex half",
      'duplex: "half"',
      options.duplex,
    );
  }

  let url: URL;
  try {
    url = new URL(input, `${baseUrl}/`);
    applyRequestQuery(url, options.query);
  } catch {
    return issue(
      "Request URL or query is invalid",
      "a valid URL and serializable query",
      undefined,
    );
  }
  if (url.username !== "" || url.password !== "") {
    return issue(
      "Request URL must not contain embedded credentials",
      "a URL without username or password data",
      "credentials present",
    );
  }

  let jsonBody: string | undefined;
  if (options.json !== undefined) {
    try {
      jsonBody = JSON.stringify(options.json);
    } catch {
      return issue("JSON request body is not serializable", "a JSON-serializable value", undefined);
    }
    if (jsonBody === undefined) {
      return issue(
        "JSON request body is not serializable",
        "a JSON value",
        `non-serializable ${typeof options.json}`,
      );
    }
  }

  const {
    method: _method,
    headers: _headers,
    query: _query,
    signal: _signal,
    parseAs: _parseAs,
    retry: _retry,
    hookPath: _hookPath,
    fetch: _fetch,
    duplex,
    json: _json,
    body: _body,
    bodyFactory: _bodyFactory,
    schema: _schema,
    ...requestInit
  } = options;
  if (duplex !== undefined) (requestInit as RequestInit & { duplex?: "half" }).duplex = duplex;

  return {
    ok: true,
    url: url.href,
    requestInit: requestInit as RequestInit & { duplex?: "half" },
    hasJson: options.json !== undefined,
    jsonBody,
    bodyReplayable:
      options.bodyFactory !== undefined ||
      options.json !== undefined ||
      isReplayableRequestBody(options.body),
  };
}

function applyRequestQuery(url: URL, query?: RequestQuery): void {
  if (query === undefined) return;
  if (query instanceof URLSearchParams) {
    for (const [name, value] of query) url.searchParams.append(name, value);
    return;
  }

  for (const [name, raw] of Object.entries(query)) {
    if (raw === undefined) continue;
    url.searchParams.delete(name);
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (value !== undefined) url.searchParams.append(name, value === null ? "" : String(value));
    }
  }
}

function isReplayableRequestBody(body: BodyInit | null | undefined): boolean {
  return (
    body === undefined ||
    body === null ||
    typeof body === "string" ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  );
}

function createArbitraryBody<T>(
  options: ArbitraryInternalOptions<T>,
  jsonBody?: string,
): BodyInit | null | undefined {
  if (options.bodyFactory !== undefined) return options.bodyFactory();
  if (options.json !== undefined) return jsonBody;
  return options.body;
}

type ArbitraryAttemptPreparation = { ok: true; request: Request } | { ok: false; error: ApiError };

function prepareArbitraryAttempt<T>(
  preparation: Extract<ArbitraryPreparation, { ok: true }>,
  options: ArbitraryInternalOptions<T>,
  auth: AuthConfig,
  method: string,
  signal: AbortSignal | undefined,
  factoryStreams: WeakSet<ReadableStream>,
): ArbitraryAttemptPreparation {
  let body: BodyInit | null | undefined;
  try {
    body = createArbitraryBody(options, preparation.jsonBody);
  } catch (error) {
    return { ok: false, error: { kind: "Unknown", error } };
  }

  if (isReadableStreamBody(body)) {
    if (options.duplex !== "half") {
      return {
        ok: false,
        error: validationError(
          "body",
          "ReadableStream request bodies require duplex half",
          'duplex: "half"',
          options.duplex,
        ),
      };
    }
    if (options.bodyFactory !== undefined) {
      if (factoryStreams.has(body)) {
        return {
          ok: false,
          error: validationError(
            "bodyFactory",
            "bodyFactory returned a previously used ReadableStream",
            "a fresh request body for every attempt",
            "reused ReadableStream",
          ),
        };
      }
      factoryStreams.add(body);
    }
  }

  try {
    const headers = mergeArbitraryHeaders(auth, options.headers);
    if (preparation.hasJson && !headers.has("content-type") && body !== undefined) {
      headers.set("content-type", "application/json");
    }
    return {
      ok: true,
      request: new Request(preparation.url, {
        ...preparation.requestInit,
        method,
        headers,
        body,
        signal,
      } as RequestInit),
    };
  } catch (error) {
    return {
      ok: false,
      error: validationError(
        "request",
        "Request options could not be constructed",
        "valid Fetch request options and body",
        error instanceof Error ? error.name : typeof error,
      ),
    };
  }
}

function validationError(
  path: string,
  message: string,
  expected: string,
  received: unknown,
): ApiError {
  return { kind: "Validation", issues: [{ path, message, expected, received }] };
}

function isReadableStreamBody(value: unknown): value is ReadableStream {
  return typeof ReadableStream !== "undefined" && value instanceof ReadableStream;
}

function mergeArbitraryHeaders(auth: AuthConfig, source: unknown): Headers {
  const headers = new Headers(createAuthHeaders(auth));
  if (source === undefined || source === null) return headers;

  if (source instanceof Headers) {
    source.forEach((value, name) => headers.set(name, value));
    return headers;
  }
  if (Array.isArray(source)) {
    for (const entry of source) {
      if (!Array.isArray(entry) || typeof entry[0] !== "string" || entry[1] === undefined) continue;
      // User-provided tuple headers replace inherited defaults. Appending Authorization here
      // would combine the package credential with an explicit cross-origin credential.
      headers.set(entry[0], String(entry[1]));
    }
    return headers;
  }
  if (typeof source === "object") {
    for (const [name, value] of Object.entries(source)) {
      if (value === undefined) continue;
      if (value === null) headers.delete(name);
      else headers.set(name, String(value));
    }
  }
  return headers;
}

export function hasAuthorizationHeader(value: unknown): boolean {
  if (value instanceof Headers) return value.has("authorization");
  if (Array.isArray(value)) {
    return value.some(
      (entry) =>
        Array.isArray(entry) &&
        typeof entry[0] === "string" &&
        entry[0].toLowerCase() === "authorization" &&
        entry[1] !== undefined,
    );
  }
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(
    ([name, headerValue]) => name.toLowerCase() === "authorization" && headerValue !== undefined,
  );
}

async function parseArbitraryResponse(
  response: Response,
  parseAs: ResultParseAs,
): Promise<unknown> {
  try {
    switch (parseAs) {
      case "json": {
        const text = await response.text();
        return text ? JSON.parse(text) : undefined;
      }
      case "text":
        return await response.text();
      case "arrayBuffer":
        return await response.arrayBuffer();
      case "blob":
        return await response.blob();
      case "formData": {
        const contentType = response.headers.get("content-type");
        if (!isFormDataContentType(contentType)) {
          throw new ResponseParseValidationError(
            "Response cannot be parsed as form data",
            "multipart/form-data with a boundary or application/x-www-form-urlencoded",
            contentType,
          );
        }
        const bytes = await response.arrayBuffer();
        try {
          const ResponseConstructor = response.constructor as typeof Response;
          return await new ResponseConstructor(bytes, {
            headers: { "content-type": contentType ?? "" },
          }).formData();
        } catch {
          throw new ResponseParseValidationError(
            "Response body was not valid form data",
            "form data matching the declared content type",
            undefined,
          );
        }
      }
      case "none":
        await response.body?.cancel();
        return undefined;
    }
  } catch (cause) {
    throw normalizeResponseBodyError(cause, parseAs === "json");
  }
}

async function readHttpErrorBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (cause) {
    throw normalizeResponseBodyError(cause);
  }
}

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

class ResponseParseValidationError extends Error {
  constructor(
    message: string,
    readonly expected: string,
    readonly received: unknown,
  ) {
    super(message);
    this.name = "ResponseParseValidationError";
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
    error instanceof ResponseParseValidationError ||
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

  if (error instanceof ResponseParseValidationError) {
    return {
      kind: "Validation",
      issues: [
        {
          path: "response",
          message: error.message,
          expected: error.expected,
          received: error.received,
        },
      ],
    };
  }

  if (isMarkedNetworkTransportFailure(error)) {
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

  return { kind: "Unknown", error };
}

function fetchAtTransportBoundary(
  fetchImpl: typeof globalThis.fetch,
  input: FetchInput,
  init?: FetchInit,
): Promise<Response> {
  try {
    return Promise.resolve(fetchImpl(input, init)).catch((cause: unknown) => {
      throw markNetworkTransportFailure(cause);
    });
  } catch (cause) {
    return Promise.reject(markNetworkTransportFailure(cause));
  }
}

const NETWORK_TRANSPORT_FAILURES = new WeakSet<object>();

const RAW_RESPONSE_BODY_OBSERVERS = new WeakMap<Response, () => void>();

function observeRawResponseBodyFailures(response: Response, observers: Set<() => void>): Response {
  if (RAW_RESPONSE_BODY_OBSERVERS.has(response)) return response;

  const descriptors = new Map<PropertyKey, PropertyDescriptor | undefined>();
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    for (const [property, descriptor] of descriptors) {
      if (descriptor === undefined) Reflect.deleteProperty(response, property);
      else Object.defineProperty(response, property, descriptor);
    }
    RAW_RESPONSE_BODY_OBSERVERS.delete(response);
    observers.delete(restore);
  };

  try {
    for (const property of RESPONSE_BODY_METHODS) {
      // FormData readers combine transport consumption and MIME parsing in one call. A
      // TypeError from that method alone cannot safely be classified as a network failure.
      if (property === "formData") continue;
      const method = Reflect.get(response, property, response) as (
        ...args: unknown[]
      ) => Promise<unknown>;
      if (typeof method !== "function") continue;
      descriptors.set(property, Object.getOwnPropertyDescriptor(response, property));
      Object.defineProperty(response, property, {
        configurable: true,
        value: (...args: unknown[]) => {
          restore();
          try {
            return Promise.resolve(method.apply(response, args)).catch((cause: unknown) => {
              throw markNetworkTransportFailure(cause);
            });
          } catch (cause) {
            throw markNetworkTransportFailure(cause);
          }
        },
        writable: true,
      });
    }
    RAW_RESPONSE_BODY_OBSERVERS.set(response, restore);
    observers.add(restore);
  } catch {
    restore();
  }

  return response;
}

function markNetworkTransportFailure(cause: unknown): unknown {
  if (isNetworkError(cause) && typeof cause === "object" && cause !== null) {
    NETWORK_TRANSPORT_FAILURES.add(cause);
  }
  return cause;
}

function isMarkedNetworkTransportFailure(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && NETWORK_TRANSPORT_FAILURES.has(cause);
}

function retryCauseForError(error: ApiError): RetryCause | undefined {
  if (error.kind === "Network" && error.message !== "Request aborted") {
    return { kind: "Network" };
  }
  if (error.kind === "Timeout") return { kind: "Timeout" };
  return undefined;
}

function isMalformedJsonError(error: unknown): boolean {
  return error instanceof SyntaxError;
}

function isFormDataContentType(contentType: string | null): boolean {
  if (contentType === null) return false;
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType === "application/x-www-form-urlencoded") return true;
  return (
    mediaType === "multipart/form-data" && /;\s*boundary=(?:"[^"]+"|[^;\s]+)/iu.test(contentType)
  );
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
