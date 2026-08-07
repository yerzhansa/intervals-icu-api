import createClient, {
  defaultBodySerializer,
  defaultPathSerializer,
  type PathSerializer,
} from "openapi-fetch";
import type { paths } from "./generated/schema.js";
import { createAuthHeaders, type AuthConfig } from "./auth.js";
import { RateLimiter, type RateLimiterOptions } from "./rate-limiter.js";
import {
  HttpExecutor,
  hasAuthorizationHeader,
  type ResultParseAs,
  type ResultRequestArguments,
  type ResultRequestData,
  type RequestSuccess,
} from "./http.js";
import { type RetryOptions, validateRetryOptions } from "./retry.js";
import type { Hooks } from "./hooks.js";
import type { Result } from "./result.js";
import { AthleteResource } from "./resources/athlete.js";
import { ActivitiesResource } from "./resources/activities.js";
import { WellnessResource } from "./resources/wellness.js";
import { EventsResource } from "./resources/events.js";
import { WorkoutsResource } from "./resources/workouts.js";
import { PowerCurvesResource } from "./resources/power-curves.js";
import { FoldersResource } from "./resources/folders.js";
import { GearResource } from "./resources/gear.js";

const BASE_URL = "https://intervals.icu";
const safeDefaultPathSerializer: PathSerializer = (pathname, pathParams) =>
  defaultPathSerializer(pathname, mapDotPathValues(pathParams));

export interface IntervalsClientOptions {
  apiKey?: string;
  bearerToken?: string;
  athleteId?: string;
  baseUrl?: string;
  rateLimit?: Partial<RateLimiterOptions>;
  retry?: Partial<RetryOptions>;
  hooks?: Hooks;
  fetch?: typeof globalThis.fetch;
  /** Per-attempt request-and-response-body timeout. Disabled when omitted. */
  timeoutMs?: number;
}

export class IntervalsClient {
  readonly athleteId: string;
  readonly athlete: AthleteResource;
  readonly activities: ActivitiesResource;
  readonly wellness: WellnessResource;
  readonly events: EventsResource;
  readonly workouts: WorkoutsResource;
  readonly powerCurves: PowerCurvesResource;
  readonly folders: FoldersResource;
  readonly gear: GearResource;

  private readonly api: ReturnType<typeof createClient<paths>>;
  private readonly rawApi: ReturnType<typeof createClient<paths>>;
  private readonly http: HttpExecutor;

  constructor(options: IntervalsClientOptions) {
    const auth = resolveAuth(options);
    const baseUrl = normalizeBaseUrl(options.baseUrl ?? BASE_URL);
    this.athleteId = options.athleteId ?? "0";

    const http = new HttpExecutor({
      rateLimiter: new RateLimiter(options.rateLimit),
      retryOpts: validateRetryOptions(options.retry),
      hooks: options.hooks ?? {},
      baseUrl,
      auth,
      fetchImpl: options.fetch,
      timeoutMs: options.timeoutMs,
    });
    this.http = http;

    const headers = createAuthHeaders(auth);
    this.api = createClient<paths>({
      baseUrl,
      headers,
      fetch: http.openApiFetch,
      pathSerializer: safeDefaultPathSerializer,
    });
    this.rawApi = wrapRawClient(
      createClient<paths>({
        baseUrl,
        headers,
        fetch: http.rawFetch,
        pathSerializer: safeDefaultPathSerializer,
      }),
      this.api,
      http,
    );

    this.athlete = new AthleteResource(http, this.api, this.athleteId);
    this.activities = new ActivitiesResource(http, this.api, this.athleteId);
    this.wellness = new WellnessResource(http, this.api, this.athleteId);
    this.events = new EventsResource(http, this.api, this.athleteId);
    this.workouts = new WorkoutsResource(http, this.api, this.athleteId);
    this.powerCurves = new PowerCurvesResource(http, this.api, this.athleteId);
    this.folders = new FoldersResource(http, this.api, this.athleteId);
    this.gear = new GearResource(http, this.api, this.athleteId);
  }

  get raw() {
    return this.rawApi;
  }

  /** Result-returning escape hatch for endpoints not yet modeled by a typed resource. */
  request<T = unknown, P extends ResultParseAs = "json">(
    input: string | URL,
    ...args: ResultRequestArguments<T, P>
  ): Promise<Result<RequestSuccess<ResultRequestData<P, T>>>> {
    return this.http.request<T, P>(input, ...args);
  }
}

function mapDotPathValues(pathParams: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(pathParams).map(([name, value]) => [name, mapDotPathValue(value)]),
  );
}

function mapDotPathValue(value: unknown): unknown {
  if (typeof value === "string") {
    const dotTokens = value.match(/(?:\.|%2e)/giu);
    if (dotTokens?.join("").length === value.length) {
      if (dotTokens.length === 1) return "%2E";
      if (dotTokens.length === 2) return "%2E%2E";
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(mapDotPathValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, mapDotPathValue(item)]),
    );
  }
  return value;
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/u, "");
  return normalized.endsWith(":") ? baseUrl : normalized;
}

function wrapRawClient(
  rawApi: ReturnType<typeof createClient<paths>>,
  resourceApi: ReturnType<typeof createClient<paths>>,
  http: HttpExecutor,
): ReturnType<typeof createClient<paths>> {
  const methods = new Set([
    "request",
    "GET",
    "PUT",
    "POST",
    "DELETE",
    "OPTIONS",
    "HEAD",
    "PATCH",
    "TRACE",
  ]);

  const middlewareMethods = new Set(["use", "eject"]);

  return new Proxy(rawApi, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (
        typeof property === "string" &&
        middlewareMethods.has(property) &&
        typeof value === "function"
      ) {
        return (...args: unknown[]) => {
          const resourceValue = Reflect.get(resourceApi, property) as (
            ...values: unknown[]
          ) => void;
          value.apply(target, args);
          resourceValue.apply(resourceApi, args);
        };
      }

      if (typeof property !== "string" || !methods.has(property) || typeof value !== "function") {
        return typeof value === "function" ? value.bind(target) : value;
      }

      return (...args: unknown[]) => {
        const initIndex = property === "request" ? 2 : 1;
        const schemaPathIndex = property === "request" ? 1 : 0;
        const init = args[initIndex];
        const customFetch =
          typeof init === "object" &&
          init !== null &&
          "fetch" in init &&
          typeof (init as { fetch?: unknown }).fetch === "function"
            ? (init as { fetch: typeof globalThis.fetch }).fetch
            : undefined;
        const schemaPath =
          typeof args[schemaPathIndex] === "string" ? args[schemaPathIndex] : undefined;
        const method =
          property === "request" && typeof args[0] === "string" ? args[0].toUpperCase() : property;
        const baseInit = typeof init === "object" && init !== null ? init : {};
        const stableInit = stabilizeDefaultRawBody(baseInit);
        const externalSignal = (baseInit as { signal?: AbortSignal | null }).signal;
        const rawTransport = http.createObservedRawFetch(
          customFetch,
          hasExplicitAuthorization(init),
        );
        return http.requestRaw(
          method,
          schemaPath ?? "",
          externalSignal,
          rawBodyIsReplayable(init),
          (signal) => {
            const attemptArgs = [...args];
            attemptArgs[initIndex] = { ...stableInit, fetch: rawTransport.fetch, signal };
            return value.apply(target, attemptArgs);
          },
          rawTransport.cleanup,
        );
      };
    },
  });
}

function stabilizeDefaultRawBody(init: object): object {
  const options = init as { body?: unknown; bodySerializer?: unknown };
  if (options.body === undefined || typeof options.bodySerializer === "function") return init;

  let serialized = false;
  let cachedBody: unknown;
  const serialize = defaultBodySerializer as unknown as (
    body: unknown,
    headers?: unknown,
  ) => unknown;

  return {
    ...init,
    bodySerializer: (body: unknown, headers?: unknown) => {
      if (!serialized) {
        cachedBody = serialize(body, headers);
        serialized = true;
      }
      return cachedBody;
    },
  };
}

function hasExplicitAuthorization(init: unknown): boolean {
  if (typeof init !== "object" || init === null) return false;

  const options = init as {
    headers?: unknown;
    params?: { header?: unknown };
  };
  return hasAuthorizationHeader(options.headers) || hasAuthorizationHeader(options.params?.header);
}

function rawBodyIsReplayable(init: unknown): boolean {
  if (typeof init !== "object" || init === null) return true;
  const options = init as { body?: unknown; bodySerializer?: unknown };
  if (options.body === undefined) return true;
  if (typeof options.bodySerializer === "function") return false;
  return !(options.body instanceof ReadableStream);
}

function resolveAuth(options: IntervalsClientOptions): AuthConfig {
  if (options.apiKey) return { type: "api-key", apiKey: options.apiKey };
  if (options.bearerToken) return { type: "bearer", token: options.bearerToken };
  throw new Error("Either apiKey or bearerToken must be provided");
}
