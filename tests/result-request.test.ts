import { describe, expect, it, vi } from "vitest";
import * as v from "valibot";
import { createAuthHeaders } from "../src/auth.js";
import { IntervalsClient } from "../src/client.js";

const API_ORIGIN = "https://api.example.test";

function createClient(
  fetch: typeof globalThis.fetch,
  options: Partial<ConstructorParameters<typeof IntervalsClient>[0]> = {},
): IntervalsClient {
  return new IntervalsClient({
    apiKey: "test",
    baseUrl: API_ORIGIN,
    fetch,
    retry: {
      maxAttempts: 3,
      initialDelayMs: 0,
      maxDelayMs: 0,
      jitterFactor: 0,
      ...options.retry,
    },
    ...options,
  });
}

describe("IntervalsClient.request", () => {
  it("passes JSON request and response keys through exactly", async () => {
    let observed: Request | undefined;
    const response = Response.json({ wire_key: 2, nested_value: { child_key: 3 } });
    const fetch = vi.fn(async (input) => {
      observed = input as Request;
      return response;
    }) as typeof globalThis.fetch;
    const client = createClient(fetch);

    const result = await client.request("/custom", {
      method: "POST",
      json: { exactRequestKey: 1, nestedObject: { keepThisKey: true } },
      retry: "never",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data).toEqual({ wire_key: 2, nested_value: { child_key: 3 } });
    expect(result.value.response).toBe(response);
    expect(await observed?.json()).toEqual({
      exactRequestKey: 1,
      nestedObject: { keepThisKey: true },
    });
    expect(observed?.headers.get("content-type")).toBe("application/json");
  });

  it("lets a JSON schema validate and transform the wire-shaped response", async () => {
    const fetch = vi.fn(async () => Response.json({ wire_value: 7 })) as typeof globalThis.fetch;
    const client = createClient(fetch);
    const schema = v.pipe(
      v.object({ wire_value: v.number() }),
      v.transform((value) => ({ transformedValue: value.wire_value })),
    );

    const result = await client.request("/custom", { schema });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ data: { transformedValue: 7 } }),
    });
  });

  it.each(["text", "arrayBuffer", "blob", "formData", "none"] as const)(
    "supports the %s response mode",
    async (parseAs) => {
      const fetch = vi.fn(async () => {
        if (parseAs === "formData") {
          return new Response("field=value", {
            headers: { "content-type": "application/x-www-form-urlencoded" },
          });
        }
        return new Response("payload", { headers: { "content-type": "text/plain" } });
      }) as typeof globalThis.fetch;
      const client = createClient(fetch);

      const result = await client.request("/custom", { parseAs });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      switch (parseAs) {
        case "text":
          expect(result.value.data).toBe("payload");
          break;
        case "arrayBuffer":
          expect(new TextDecoder().decode(result.value.data)).toBe("payload");
          break;
        case "blob":
          expect(await result.value.data.text()).toBe("payload");
          break;
        case "formData":
          expect(result.value.data.get("field")).toBe("value");
          break;
        case "none":
          expect(result.value.data).toBeUndefined();
          break;
      }
    },
  );

  it.each(["text/plain", "application/x-www-form-urlencoded-bogus"])(
    "returns Validation without retrying when formData has content type %s",
    async (contentType) => {
      const fetch = vi.fn(
        async () => new Response("not a form", { headers: { "content-type": contentType } }),
      ) as typeof globalThis.fetch;

      const result = await createClient(fetch).request("/plain", { parseAs: "formData" });

      expect(result.ok || result.error.kind).toBe("Validation");
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("normalizes HTTP, malformed JSON, and schema failures", async () => {
    const responses = [
      Response.json({ error_code: "teapot" }, { status: 418, statusText: "Teapot" }),
      new Response("{", { headers: { "content-type": "application/json" } }),
      Response.json({ count: "wrong" }),
    ];
    const fetch = vi.fn(async () => responses.shift()!) as typeof globalThis.fetch;
    const client = createClient(fetch, { retry: { maxAttempts: 1 } });

    const http = await client.request("/http");
    const malformed = await client.request("/malformed");
    const invalid = await client.request("/invalid", {
      schema: v.object({ count: v.number() }),
    });

    expect(http).toEqual({
      ok: false,
      error: {
        kind: "Http",
        status: 418,
        statusText: "Teapot",
        body: { error_code: "teapot" },
      },
    });
    expect(malformed.ok || malformed.error.kind).toBe("Validation");
    expect(invalid.ok || invalid.error.kind).toBe("Validation");
  });

  it("returns undefined JSON data for an empty successful response", async () => {
    const response = new Response(null, { status: 204 });
    const fetch = vi.fn(async () => response) as typeof globalThis.fetch;

    const result = await createClient(fetch).request("/empty");

    expect(result).toEqual({
      ok: true,
      value: { data: undefined, response },
    });
  });

  it("retries idempotent network failures but not unsafe methods without an override", async () => {
    const getFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(Response.json({ ok: true })) as typeof globalThis.fetch;
    const postFetch = vi.fn(async () => {
      throw new TypeError("network down");
    }) as typeof globalThis.fetch;
    const forcedFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(Response.json({ ok: true })) as typeof globalThis.fetch;

    const get = await createClient(getFetch).request("/get");
    const post = await createClient(postFetch).request("/post", { method: "POST", json: {} });
    const forced = await createClient(forcedFetch).request("/post", {
      method: "POST",
      json: {},
      retry: "idempotent",
    });

    expect(get.ok).toBe(true);
    expect(getFetch).toHaveBeenCalledTimes(2);
    expect(post).toEqual({
      ok: false,
      error: { kind: "Network", message: "Network request failed" },
    });
    expect(postFetch).toHaveBeenCalledTimes(1);
    expect(forced.ok).toBe(true);
    expect(forcedFetch).toHaveBeenCalledTimes(2);
  });

  it("honors retry switches and per-call never mode", async () => {
    const disabledFetch = vi.fn(async () => {
      throw new TypeError("network down");
    }) as typeof globalThis.fetch;
    const neverFetch = vi.fn(async () => {
      throw new TypeError("network down");
    }) as typeof globalThis.fetch;

    await createClient(disabledFetch, {
      retry: { retryOnNetworkError: false },
    }).request("/disabled");
    await createClient(neverFetch).request("/never", { retry: "never" });

    expect(disabledFetch).toHaveBeenCalledTimes(1);
    expect(neverFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-replayable stream body", async () => {
    const fetch = vi.fn(async (input) => {
      await (input as Request).text();
      return new Response("retry", { status: 503 });
    }) as typeof globalThis.fetch;
    const client = createClient(fetch);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("one-shot"));
        controller.close();
      },
    });

    const result = await client.request("/upload", {
      method: "PUT",
      body,
      duplex: "half",
    });

    expect(result.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a direct stream without duplex locally", async () => {
    const fetch = vi.fn() as typeof globalThis.fetch;
    const body = new ReadableStream<Uint8Array>();

    const result = await createClient(fetch).request("/upload", {
      method: "PUT",
      body,
    });

    expect(result.ok || result.error.kind).toBe("Validation");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not retry invalid or throwing body factories", async () => {
    const fetch = vi.fn() as typeof globalThis.fetch;
    const onRetry = vi.fn();
    const missingDuplexFactory = vi.fn(() => new ReadableStream<Uint8Array>());
    const thrown = new TypeError("application callback failed");
    const throwingFactory = vi.fn(() => {
      throw thrown;
    });
    const client = createClient(fetch, { hooks: { onRetry } });

    const missingDuplex = await client.request("/stream", {
      method: "PUT",
      bodyFactory: missingDuplexFactory,
    });
    const callbackFailure = await client.request("/throw", {
      method: "PUT",
      duplex: "half",
      bodyFactory: throwingFactory,
    });
    const invalidBody = await client.request("/invalid", {
      method: "PUT",
      bodyFactory: (() => Symbol("invalid-body")) as never,
    });

    expect(missingDuplex.ok || missingDuplex.error.kind).toBe("Validation");
    expect(callbackFailure).toEqual({ ok: false, error: { kind: "Unknown", error: thrown } });
    expect(invalidBody.ok || invalidBody.error.kind).toBe("Validation");
    expect(missingDuplexFactory).toHaveBeenCalledTimes(1);
    expect(throwingFactory).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("stops retrying when bodyFactory reuses a consumed stream", async () => {
    const fetch = vi.fn(async (input) => {
      await (input as Request).text();
      return new Response("retry", { status: 503 });
    }) as typeof globalThis.fetch;
    const onRetry = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("one-shot"));
        controller.close();
      },
    });
    const bodyFactory = vi.fn(() => stream);

    const result = await createClient(fetch, { hooks: { onRetry } }).request("/upload", {
      method: "PUT",
      duplex: "half",
      bodyFactory,
    });

    expect(result.ok || result.error.kind).toBe("Validation");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(bodyFactory).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("uses bodyFactory to build a fresh body for every attempt", async () => {
    const bodies: string[] = [];
    const fetch = vi.fn(async (input) => {
      bodies.push(await (input as Request).text());
      return bodies.length === 1
        ? new Response("retry", { status: 503 })
        : Response.json({ ok: true });
    }) as typeof globalThis.fetch;
    let bodyNumber = 0;
    const client = createClient(fetch);

    const result = await client.request("/upload", {
      method: "PUT",
      duplex: "half",
      bodyFactory: () => {
        bodyNumber += 1;
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`body-${bodyNumber}`));
            controller.close();
          },
        });
      },
    });

    expect(result.ok).toBe(true);
    expect(bodies).toEqual(["body-1", "body-2"]);
  });

  it("retries per-attempt timeouts with a fresh deadline", async () => {
    const onRetry = vi.fn();
    const fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (fetch.mock.calls.length === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        });
      }
      return Promise.resolve(Response.json({ recovered: true }));
    }) as typeof globalThis.fetch;
    const client = createClient(fetch, {
      timeoutMs: 5,
      retry: { maxAttempts: 2 },
      hooks: { onRetry },
    });

    const result = await client.request("/slow");

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ cause: { kind: "Timeout" }, reason: "Request timeout" }),
    );
  });

  it("turns caller abort during backoff into one terminal Result error", async () => {
    const controller = new AbortController();
    const onError = vi.fn();
    const onRetry = vi.fn(() => controller.abort(new Error("stop")));
    const fetch = vi.fn(
      async () => new Response("retry", { status: 503 }),
    ) as typeof globalThis.fetch;
    const client = createClient(fetch, {
      retry: { maxAttempts: 2, maxDelayMs: 30_000 },
      hooks: { onRetry, onError },
    });

    const result = await client.request("/abort", { signal: controller.signal });

    expect(result).toEqual({
      ok: false,
      error: { kind: "Network", message: "Request aborted" },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("does not acquire or fetch for a pre-aborted request", async () => {
    const controller = new AbortController();
    controller.abort(new Error("already stopped"));
    const onRequest = vi.fn();
    const onError = vi.fn();
    const fetch = vi.fn() as typeof globalThis.fetch;
    const client = createClient(fetch, { hooks: { onRequest, onError } });

    const result = await client.request("/aborted", { signal: controller.signal });

    expect(result).toEqual({
      ok: false,
      error: { kind: "Network", message: "Request aborted" },
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("reports one logical hook lifecycle with a structured retry cause", async () => {
    const lifecycle: string[] = [];
    const onRetry = vi.fn((info) => lifecycle.push(`retry:${info.cause.kind}`));
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("retry", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ok: true })) as typeof globalThis.fetch;
    const client = createClient(fetch, {
      hooks: {
        onRequest: () => lifecycle.push("request"),
        onRetry,
        onResponse: () => lifecycle.push("response"),
        onError: () => lifecycle.push("error"),
      },
    });

    const result = await client.request("/hooked", { hookPath: "/safe/{id}" });

    expect(result.ok).toBe(true);
    expect(lifecycle).toEqual(["request", "retry:Http", "response"]);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/safe/{id}",
        cause: { kind: "Http", status: 503 },
        reason: "HTTP 503",
      }),
    );
  });

  it("keeps inherited credentials inside the configured origin", async () => {
    let request: Request | undefined;
    const fetch = vi.fn(async (input) => {
      request = input as Request;
      return Response.json({ ok: true });
    }) as typeof globalThis.fetch;

    await createClient(fetch).request("/same-origin");

    expect(request?.headers.get("authorization")).toBe(
      createAuthHeaders({ type: "api-key", apiKey: "test" }).Authorization,
    );
  });

  it("strips inherited cross-origin credentials and preserves explicit credentials", async () => {
    const requests: Request[] = [];
    const fetch = vi.fn(async (input) => {
      requests.push(input as Request);
      return Response.json({ ok: true });
    }) as typeof globalThis.fetch;
    const client = createClient(fetch);
    const defaultAuthorization = createAuthHeaders({
      type: "api-key",
      apiKey: "test",
    }).Authorization;

    await client.request("https://mirror.example.test/default");
    await client.request("https://mirror.example.test/explicit", {
      headers: { Authorization: "Bearer mirror" },
    });
    await client.request("https://mirror.example.test/equal", {
      headers: { Authorization: defaultAuthorization },
    });
    await client.request("https://mirror.example.test/undefined", {
      headers: { Authorization: undefined },
    });
    await client.request("https://mirror.example.test/tuple", {
      headers: [["Authorization", "Bearer tuple"]],
    });

    expect(requests.map((request) => request.headers.get("authorization"))).toEqual([
      null,
      "Bearer mirror",
      defaultAuthorization,
      null,
      "Bearer tuple",
    ]);
  });

  it("manages a request-local Fetch override through the same auth boundary", async () => {
    let request: Request | undefined;
    const baseFetch = vi.fn(async () => {
      throw new Error("base fetch must not run");
    }) as typeof globalThis.fetch;
    const localFetch = vi.fn(async (input) => {
      request = input as Request;
      return Response.json({ ok: true });
    }) as typeof globalThis.fetch;
    const client = createClient(baseFetch);

    const result = await client.request("https://mirror.example.test/custom", {
      fetch: localFetch,
    });

    expect(result.ok).toBe(true);
    expect(localFetch).toHaveBeenCalledTimes(1);
    expect(baseFetch).not.toHaveBeenCalled();
    expect(request?.headers.get("authorization")).toBeNull();
  });

  it("merges query values and keeps the resolved URL out of default hook paths", async () => {
    let request: Request | undefined;
    const onRequest = vi.fn();
    const fetch = vi.fn(async (input) => {
      request = input as Request;
      return Response.json({ ok: true });
    }) as typeof globalThis.fetch;
    const client = createClient(fetch, { hooks: { onRequest } });

    await client.request("/athlete/private-id/custom?existing=1", {
      query: { fields: ["a", "b"], enabled: true, omitted: undefined },
    });

    expect(request?.url).toBe(
      `${API_ORIGIN}/athlete/private-id/custom?existing=1&fields=a&fields=b&enabled=true`,
    );
    expect(onRequest).toHaveBeenCalledWith({ method: "GET", path: "<arbitrary>" });
  });

  it("rejects invalid body combinations locally without fetching", async () => {
    const fetch = vi.fn() as typeof globalThis.fetch;
    const client = createClient(fetch);

    const result = await client.request("/invalid", {
      method: "GET",
      body: "not allowed",
    } as never);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("Validation");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects JSON values that stringify to no body", async () => {
    const fetch = vi.fn() as typeof globalThis.fetch;

    const result = await createClient(fetch).request("/invalid", {
      method: "POST",
      json: Symbol("not-json"),
    });

    expect(result.ok || result.error.kind).toBe("Validation");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not expose an unserializable JSON body through error hooks", async () => {
    const fetch = vi.fn() as typeof globalThis.fetch;
    const onError = vi.fn();
    const secret = "synthetic-private-request-value";
    const body = {
      secret,
      toJSON() {
        return undefined;
      },
    };

    const result = await createClient(fetch, { hooks: { onError } }).request("/invalid", {
      method: "POST",
      json: body,
    });

    expect(result.ok || result.error.kind).toBe("Validation");
    expect(JSON.stringify(onError.mock.calls[0]?.[0].error)).not.toContain(secret);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects URL credentials without exposing them through error hooks", async () => {
    const fetch = vi.fn() as typeof globalThis.fetch;
    const onError = vi.fn();
    const username = "synthetic-user";
    const password = "synthetic-password";

    const result = await createClient(fetch, { hooks: { onError } }).request(
      `https://${username}:${password}@mirror.example.test/private`,
    );

    const serializedError = JSON.stringify(onError.mock.calls[0]?.[0].error);
    expect(result.ok || result.error.kind).toBe("Validation");
    expect(serializedError).not.toContain(username);
    expect(serializedError).not.toContain(password);
    expect(fetch).not.toHaveBeenCalled();
  });
});
