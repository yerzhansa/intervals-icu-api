import { describe, expect, it, vi } from "vitest";
import * as v from "valibot";
import type { Middleware } from "openapi-fetch";
import { IntervalsClient } from "../src/client.js";
import { HttpExecutor } from "../src/http.js";
import type { Hooks } from "../src/hooks.js";
import { RateLimiter } from "../src/rate-limiter.js";
import { DEFAULT_RETRY } from "../src/retry.js";

function executor(options?: {
  fetch?: typeof globalThis.fetch;
  hooks?: Hooks;
  timeoutMs?: number;
  maxAttempts?: number;
}) {
  return new HttpExecutor({
    rateLimiter: new RateLimiter({ requestsPerSecond: 1_000, burst: 1_000 }),
    retryOpts: {
      ...DEFAULT_RETRY,
      maxAttempts: options?.maxAttempts ?? 3,
      initialDelayMs: 0,
      maxDelayMs: 0,
      jitterFactor: 0,
    },
    hooks: options?.hooks ?? {},
    baseUrl: "https://example.test",
    auth: { type: "api-key", apiKey: "test" },
    fetchImpl: options?.fetch,
    timeoutMs: options?.timeoutMs,
  });
}

function response(status = 200, body: BodyInit | null = null, statusText?: string) {
  return new Response(body, {
    status,
    statusText,
    headers: body === null ? undefined : { "content-type": "application/json" },
  });
}

describe("managed HTTP error contract", () => {
  it("retries a Fetch network rejection and calls onError only when exhausted", async () => {
    const onError = vi.fn();
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as typeof globalThis.fetch;
    const http = executor({ fetch, hooks: { onError }, maxAttempts: 3 });
    const request = vi.fn(async () => {
      const networkResponse = await http.fetch("https://example.test/network");
      return { data: {}, response: networkResponse };
    });

    const result = await http.requestJson("GET", "/test", request);

    expect(result).toEqual({
      ok: false,
      error: { kind: "Network", message: "Network request failed" },
    });
    expect(request).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("maps the configured per-attempt deadline to Timeout", async () => {
    const onError = vi.fn();
    const fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    ) as typeof globalThis.fetch;
    const http = executor({ fetch, hooks: { onError }, timeoutMs: 5 });

    const result = await http.requestJson("GET", "/slow", async () => {
      const networkResponse = await http.fetch("https://example.test/slow");
      return { data: {}, response: networkResponse };
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        kind: "Timeout",
        message: "Request exceeded configured timeout of 5 ms",
      });
    }
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("keeps the deadline active while reading a delayed binary response body", async () => {
    const onResponse = vi.fn();
    const onError = vi.fn();
    const fetch = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          await new Promise((resolve) => setTimeout(resolve, 30));
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });
      return new Response(body, { headers: { "content-type": "application/octet-stream" } });
    }) as typeof globalThis.fetch;
    const http = executor({ fetch, hooks: { onResponse, onError }, timeoutMs: 5 });

    const result = await http.requestBinary("GET", "/slow-body", "/slow-body");

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "Timeout",
        message: "Request exceeded configured timeout of 5 ms",
      },
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(onResponse).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("releases the managed deadline when openapi-fetch will skip a declared empty body", async () => {
    vi.useFakeTimers();
    try {
      const emptyResponse = new Response("", {
        headers: {
          "content-length": "0",
          "content-type": "application/json",
        },
      });
      expect(emptyResponse.body).not.toBeNull();
      const fetch = vi.fn(async () => emptyResponse) as typeof globalThis.fetch;
      const http = executor({ fetch, timeoutMs: 60_000 });

      const result = await http.requestJson<undefined>("GET", "/empty", async () => ({
        data: undefined,
        response: await http.openApiFetch("https://example.test/empty"),
      }));

      expect(result).toEqual({ ok: true, value: undefined });
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("releases the managed deadline for HEAD even when a mock supplies a body", async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(async () => new Response("ignored")) as typeof globalThis.fetch;
      const http = executor({ fetch, timeoutMs: 60_000 });

      const networkResponse = await http.openApiFetch("https://example.test/head", {
        method: "HEAD",
      });

      expect(networkResponse.body).not.toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps a plain response body stream failure to Network", async () => {
    const onResponse = vi.fn();
    const onError = vi.fn();
    const fetch = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error("socket closed while reading"));
        },
      });
      return new Response(body, { headers: { "content-type": "application/octet-stream" } });
    }) as typeof globalThis.fetch;
    const http = executor({ fetch, hooks: { onResponse, onError } });

    const result = await http.requestBinary("GET", "/broken-body", "/broken-body");

    expect(result).toEqual({
      ok: false,
      error: { kind: "Network", message: "Network request failed" },
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(onResponse).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("maps and retries a managed OpenAPI response body failure as Network", async () => {
    const fetch = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new TypeError("connection dropped while reading JSON"));
        },
      });
      return new Response(body, { headers: { "content-type": "application/json" } });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      athleteId: "i1",
      fetch,
      retry: { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 },
    });

    const result = await client.athlete.get();

    expect(result).toEqual({
      ok: false,
      error: { kind: "Network", message: "Network request failed" },
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("maps an HTTP error-body stream failure to Network", async () => {
    const onError = vi.fn();
    const fetch = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error("socket closed while reading error response"));
        },
      });
      return new Response(body, { status: 502 });
    }) as typeof globalThis.fetch;
    const http = executor({ fetch, hooks: { onError }, maxAttempts: 1 });

    const result = await http.requestBinary("GET", "/broken-error-body", "/broken-error-body");

    expect(result).toEqual({
      ok: false,
      error: { kind: "Network", message: "Network request failed" },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("maps an external abort to Network", async () => {
    const error = new Error("aborted by caller");
    error.name = "AbortError";
    const http = executor();

    const result = await http.requestJson("GET", "/aborted", async () => {
      throw error;
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: "Network", message: "Request aborted" },
    });
  });

  it("maps malformed success JSON to a synthetic Validation issue", async () => {
    const onError = vi.fn();
    const http = executor({ hooks: { onError } });

    const result = await http.requestJson("GET", "/malformed", async () => {
      throw new SyntaxError("Unexpected token");
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        kind: "Validation",
        issues: [
          {
            path: "",
            message: "Response body was not valid JSON",
            expected: "valid JSON",
            received: undefined,
          },
        ],
      });
    }
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("accepts a 204 response when no response schema is supplied", async () => {
    const onResponse = vi.fn();
    const http = executor({ hooks: { onResponse } });

    const result = await http.requestJson<undefined>("DELETE", "/empty", async () => ({
      data: undefined,
      response: response(204),
    }));

    expect(result).toEqual({ ok: true, value: undefined });
    expect(onResponse).toHaveBeenCalledTimes(1);
  });

  it("maps a schema-backed 204 response to Validation and calls onError", async () => {
    const onResponse = vi.fn();
    const onError = vi.fn();
    const http = executor({ hooks: { onResponse, onError } });

    const result = await http.requestJson(
      "GET",
      "/empty-object",
      async () => ({ data: undefined, response: response(204) }),
      v.object({ id: v.string() }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("Validation");
    expect(onResponse).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("calls onError once for schema validation failures", async () => {
    const onError = vi.fn();
    const http = executor({ hooks: { onError } });

    const result = await http.requestJson(
      "GET",
      "/invalid",
      async () => ({ data: { count: "not-a-number" }, response: response() }),
      v.object({ count: v.number() }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("Validation");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("uses the response statusText and final Retry-After value", async () => {
    const http = executor({ maxAttempts: 1 });
    const teapot = await http.requestJson("GET", "/teapot", async () => ({
      error: "no",
      response: response(418, "no", "I'm a teapot"),
    }));
    const limited = await http.requestJson("GET", "/limited", async () => ({
      error: "slow down",
      response: new Response("slow down", {
        status: 429,
        headers: { "retry-after": "7" },
      }),
    }));

    expect(teapot).toEqual({
      ok: false,
      error: { kind: "Http", status: 418, statusText: "I'm a teapot", body: "no" },
    });
    expect(limited).toEqual({
      ok: false,
      error: { kind: "RateLimit", status: 429, retryAfterMs: 7_000, body: "slow down" },
    });
  });

  it("preserves a non-JSON HTTP error body", async () => {
    const http = executor({ maxAttempts: 1 });
    const result = await http.requestJson("GET", "/gateway", async () => ({
      error: "upstream unavailable",
      response: new Response("upstream unavailable", {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "content-type": "text/plain" },
      }),
    }));

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "Http",
        status: 503,
        statusText: "Service Unavailable",
        body: "upstream unavailable",
      },
    });
  });

  it("falls back to Unknown for an unclassified exception", async () => {
    const cause = { reason: "unexpected" };
    const http = executor();
    const result = await http.requestJson("GET", "/unknown", async () => {
      throw cause;
    });

    expect(result).toEqual({ ok: false, error: { kind: "Unknown", error: cause } });
  });

  it("rejects invalid timeout configuration as a programmer error", () => {
    expect(() => executor({ timeoutMs: 0 })).toThrow("timeoutMs must be a positive finite number");
  });
});

describe("raw HTTP pipeline", () => {
  it("preserves wire data and result shape while applying status retries and hooks", async () => {
    const onRequest = vi.fn();
    const onRetry = vi.fn();
    const onResponse = vi.fn();
    const onError = vi.fn();
    const successResponse = new Response(JSON.stringify({ id: "i1", icu_ftp: 250 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("temporarily unavailable", {
          status: 503,
          headers: { "retry-after": "0" },
        }),
      )
      .mockResolvedValueOnce(successResponse) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      athleteId: "i1",
      fetch,
      timeoutMs: 1_000,
      retry: { maxAttempts: 2, initialDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 },
      hooks: { onRequest, onRetry, onResponse, onError },
    });

    const result = await client.raw.GET("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
    });

    expect(result.data).toMatchObject({ id: "i1", icu_ftp: 250 });
    expect(result.response).toBeInstanceOf(Response);
    // The outer request deadline covers openapi-fetch parsing without replacing the Response.
    expect(result.response).toBe(successResponse);
    expect(result.response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onResponse).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", path: "/api/v1/athlete/{id}" }),
    );
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", path: "/api/v1/athlete/{id}" }),
    );
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", path: "/api/v1/athlete/{id}" }),
    );
  });

  it("preserves raw malformed-JSON rejection and response-hook timing", async () => {
    const onResponse = vi.fn();
    const onError = vi.fn();
    const fetch = vi.fn(async () => response(200, "{", "OK")) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      fetch,
      timeoutMs: 1_000,
      hooks: { onResponse, onError },
    });

    await expect(
      client.raw.GET("/api/v1/athlete/{id}", {
        params: { path: { id: "i1" } },
      }),
    ).rejects.toBeInstanceOf(SyntaxError);

    expect(onResponse).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/athlete/{id}",
        error: expect.objectContaining({ kind: "Validation" }),
      }),
    );
  });

  it("keeps the raw deadline active while openapi-fetch consumes the response body", async () => {
    const onResponse = vi.fn();
    const onError = vi.fn();
    const fetch = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        pull: () => new Promise<void>(() => {}),
      });
      return new Response(body, { headers: { "content-type": "application/json" } });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      fetch,
      timeoutMs: 5,
      hooks: { onResponse, onError },
    });

    await expect(
      client.raw.GET("/api/v1/athlete/{id}", {
        params: { path: { id: "i1" } },
      }),
    ).rejects.toThrow("Request exceeded configured timeout of 5 ms");

    expect(onResponse).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/athlete/{id}",
        error: {
          kind: "Timeout",
          message: "Request exceeded configured timeout of 5 ms",
        },
      }),
    );
  });

  it("keeps the raw deadline attached to an explicitly streamed response", async () => {
    const onResponse = vi.fn();
    const fetch = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        pull: () => new Promise<void>(() => {}),
      });
      return new Response(body, { headers: { "content-type": "application/octet-stream" } });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      fetch,
      timeoutMs: 5,
      hooks: { onResponse },
    });

    const result = await client.raw.GET("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
      parseAs: "stream",
    });
    expect(result.data).toBeInstanceOf(ReadableStream);
    if (!(result.data instanceof ReadableStream)) throw new Error("Expected stream data");

    await expect(new Response(result.data).arrayBuffer()).rejects.toThrow(
      "Request exceeded configured timeout of 5 ms",
    );
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/api/v1/athlete/{id}", status: 200 }),
    );
  });

  it("releases the raw deadline when openapi-fetch skips a declared empty body", async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(async () => {
        const emptyResponse = new Response("", {
          headers: {
            "content-length": "0",
            "content-type": "application/json",
          },
        });
        expect(emptyResponse.body).not.toBeNull();
        return emptyResponse;
      }) as typeof globalThis.fetch;
      const client = new IntervalsClient({ apiKey: "test", fetch, timeoutMs: 60_000 });

      const result = await client.raw.GET("/api/v1/athlete/{id}", {
        params: { path: { id: "i1" } },
      });

      expect(result.data).toBeUndefined();
      expect(result.error).toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not clone and pre-buffer a final raw error body for hooks", async () => {
    const onError = vi.fn();
    const errorResponse = new Response("upstream unavailable", {
      status: 502,
      statusText: "Bad Gateway",
    });
    const clone = vi.spyOn(errorResponse, "clone");
    const fetch = vi.fn(async () => errorResponse) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      fetch,
      retry: { maxAttempts: 1 },
      hooks: { onError },
    });

    const result = await client.raw.GET("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
    });

    expect(result.error).toBe("upstream unavailable");
    expect(clone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/athlete/{id}",
        error: expect.objectContaining({ kind: "Http", body: undefined }),
      }),
    );
  });

  it("also manages request-local Fetch overrides", async () => {
    const onRequest = vi.fn();
    const onResponse = vi.fn();
    const baseFetch = vi.fn(async () => {
      throw new Error("base Fetch should not run");
    }) as typeof globalThis.fetch;
    const localFetch = vi.fn(async () =>
      Response.json({ id: "i1", icu_ftp: 250 }),
    ) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      fetch: baseFetch,
      hooks: { onRequest, onResponse },
    });

    const result = await client.raw.GET("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
      fetch: localFetch,
    });

    expect(result.data).toMatchObject({ icu_ftp: 250 });
    expect(localFetch).toHaveBeenCalledTimes(1);
    expect(baseFetch).not.toHaveBeenCalled();
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onResponse).toHaveBeenCalledTimes(1);
    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", path: "/api/v1/athlete/{id}" }),
    );
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", path: "/api/v1/athlete/{id}" }),
    );
  });

  it("keeps raw use and eject middleware connected to convenience resources", async () => {
    const middlewareRequest = vi.fn();
    const middleware: Middleware = {
      onRequest(context) {
        middlewareRequest(context.schemaPath);
      },
    };
    const fetch = vi.fn(async () => Response.json({ id: "i1" })) as typeof globalThis.fetch;
    const client = new IntervalsClient({ apiKey: "test", athleteId: "i1", fetch });

    client.raw.use(middleware);
    const withMiddleware = await client.athlete.get();
    client.raw.eject(middleware);
    const afterEject = await client.athlete.get();

    expect(withMiddleware.ok).toBe(true);
    expect(afterEject.ok).toBe(true);
    expect(middlewareRequest).toHaveBeenCalledTimes(1);
    expect(middlewareRequest).toHaveBeenCalledWith("/api/v1/athlete/{id}");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries a status returned directly by raw onRequest middleware", async () => {
    const packageOnRequest = vi.fn();
    const onRetry = vi.fn();
    const onResponse = vi.fn();
    const onError = vi.fn();
    const middlewareOnRequest = vi.fn();
    const middleware: Middleware = {
      onRequest() {
        middlewareOnRequest();
        if (middlewareOnRequest.mock.calls.length === 1) {
          return new Response("synthetic outage", { status: 503 });
        }
      },
    };
    const fetch = vi.fn(async () =>
      Response.json({ id: "i1", icu_ftp: 250 }),
    ) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      fetch,
      retry: { maxAttempts: 2, initialDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 },
      hooks: { onRequest: packageOnRequest, onRetry, onResponse, onError },
    });
    client.raw.use(middleware);

    const result = await client.raw.GET("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
    });

    expect(result.data).toMatchObject({ icu_ftp: 250 });
    expect(middlewareOnRequest).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(packageOnRequest).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/api/v1/athlete/{id}", reason: "HTTP 503" }),
    );
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/api/v1/athlete/{id}", status: 200 }),
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it("observes the final response after raw onResponse middleware recovery", async () => {
    vi.useFakeTimers();
    try {
      const onRetry = vi.fn();
      const onResponse = vi.fn();
      const onError = vi.fn();
      const middlewareOnResponse = vi.fn();
      const middleware: Middleware = {
        onResponse({ response: networkResponse }) {
          middlewareOnResponse(networkResponse.status);
          if (networkResponse.status === 503) {
            return Response.json({ id: "i1", icu_ftp: 250 });
          }
        },
      };
      const fetch = vi.fn(
        async () => new Response("outage", { status: 503 }),
      ) as typeof globalThis.fetch;
      const client = new IntervalsClient({
        apiKey: "test",
        fetch,
        timeoutMs: 60_000,
        retry: { maxAttempts: 2, initialDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 },
        hooks: { onRetry, onResponse, onError },
      });
      client.raw.use(middleware);

      const result = await client.raw.GET("/api/v1/athlete/{id}", {
        params: { path: { id: "i1" } },
      });

      expect(result.data).toMatchObject({ icu_ftp: 250 });
      expect(result.response.status).toBe(200);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(middlewareOnResponse).toHaveBeenCalledWith(503);
      expect(onRetry).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(onResponse).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/api/v1/athlete/{id}", status: 200 }),
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps mirrored middleware redirects from leaking the default credential", async () => {
    const requests: Request[] = [];
    const fetch = vi.fn(async (input) => {
      requests.push(new Request(input));
      return Response.json({ id: "i1" });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({ apiKey: "test", athleteId: "i1", fetch });
    const redirect = (authorization?: string): Middleware => ({
      onRequest({ request }) {
        const headers = new Headers(request.headers);
        if (authorization) headers.set("authorization", authorization);
        return new Request(`https://mirror.example.test${new URL(request.url).pathname}`, {
          method: request.method,
          headers,
        });
      },
    });
    const defaultCredential = redirect();
    const alternateCredential = redirect("Bearer test-mirror-token");

    client.raw.use(defaultCredential);
    await client.athlete.get();
    client.raw.eject(defaultCredential);
    client.raw.use(alternateCredential);
    await client.athlete.get();
    client.raw.eject(alternateCredential);

    expect(requests).toHaveLength(2);
    expect(requests[0]?.headers.get("authorization")).toBeNull();
    expect(requests[1]?.headers.get("authorization")).toBe("Bearer test-mirror-token");
  });

  it("does not forward client credentials to a request-local cross-origin base URL", async () => {
    let request: Request | undefined;
    const fetch = vi.fn(async (input) => {
      request = new Request(input);
      return Response.json({ id: "i1", icu_ftp: 250 });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({ apiKey: "test", fetch });

    const result = await client.raw.GET("/api/v1/athlete/{id}", {
      baseUrl: "https://mirror.example.test",
      params: { path: { id: "i1" } },
    });

    expect(result.data).toMatchObject({ icu_ftp: 250 });
    expect(request?.url).toBe("https://mirror.example.test/api/v1/athlete/i1");
    expect(request?.headers.get("authorization")).toBeNull();
  });

  it("preserves an explicit request-local credential for a cross-origin raw call", async () => {
    let request: Request | undefined;
    const fetch = vi.fn(async (input) => {
      request = new Request(input);
      return Response.json({ id: "i1", icu_ftp: 250 });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({ apiKey: "test", fetch });

    const result = await client.raw.GET("/api/v1/athlete/{id}", {
      baseUrl: "https://mirror.example.test",
      headers: { Authorization: "Bearer test-mirror-token" },
      params: { path: { id: "i1" } },
    });

    expect(result.data).toMatchObject({ icu_ftp: 250 });
    expect(request?.headers.get("authorization")).toBe("Bearer test-mirror-token");
  });

  it("preserves raw transport rejection while invoking onError once", async () => {
    const onError = vi.fn();
    const middlewareOnError = vi.fn();
    const transportError = new TypeError("fetch failed");
    const fetch = vi.fn(async () => {
      throw transportError;
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      fetch,
      retry: { maxAttempts: 1 },
      hooks: { onError },
    });
    client.raw.use({
      onError({ error }) {
        middlewareOnError(error);
      },
    });

    await expect(
      client.raw.GET("/api/v1/athlete/{id}", {
        params: { path: { id: "i1" } },
      }),
    ).rejects.toBe(transportError);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(middlewareOnError).toHaveBeenCalledWith(transportError);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].error).toEqual({
      kind: "Network",
      message: "Network request failed",
    });
    expect(onError.mock.calls[0][0].path).toBe("/api/v1/athlete/{id}");
  });
});
