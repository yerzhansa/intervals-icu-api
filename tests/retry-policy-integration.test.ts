import { describe, expect, it, vi } from "vitest";
import { IntervalsClient } from "../src/client.js";

function client(fetch: typeof globalThis.fetch): IntervalsClient {
  return new IntervalsClient({
    apiKey: "test",
    athleteId: "i1",
    fetch,
    retry: { maxAttempts: 2, initialDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 },
  });
}

describe("raw method-aware retries", () => {
  it("retries a replayable GET network failure and preserves the raw tuple", async () => {
    const finalResponse = Response.json({ id: "i1", icu_ftp: 250 });
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(finalResponse) as typeof globalThis.fetch;

    const result = await client(fetch).raw.GET("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.data).toMatchObject({ icu_ftp: 250 });
    expect(result.response).toBe(finalResponse);
  });

  it("does not automatically retry an unsafe POST status", async () => {
    const fetch = vi.fn(
      async () => new Response("retry", { status: 503 }),
    ) as typeof globalThis.fetch;

    const result = await client(fetch).raw.POST("/api/v1/athlete/{id}/workouts", {
      params: { path: { id: "i1" } },
      body: {} as never,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.response.status).toBe(503);
  });

  it("serializes a default raw JSON body once across retries", async () => {
    const bodies: string[] = [];
    const finalResponse = Response.json({ id: "i1", icu_ftp: 251 });
    const fetch = vi
      .fn()
      .mockImplementationOnce(async (input: RequestInfo | URL) => {
        bodies.push(await (input as Request).text());
        throw new TypeError("network down");
      })
      .mockImplementationOnce(async (input: RequestInfo | URL) => {
        bodies.push(await (input as Request).text());
        return finalResponse;
      }) as typeof globalThis.fetch;
    let ftp = 250;
    const body = Object.defineProperty({}, "icu_ftp", {
      enumerable: true,
      get: () => ++ftp,
    });

    const result = await client(fetch).raw.PUT("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
      body: body as never,
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(bodies).toEqual(['{"icu_ftp":251}', '{"icu_ftp":251}']);
    expect(result.response).toBe(finalResponse);
  });

  it("retries a raw response body transport failure and preserves final response identity", async () => {
    const bodyFailure = new TypeError("socket closed while reading");
    const brokenResponse = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(bodyFailure);
        },
      }),
      { headers: { "content-type": "application/json" } },
    );
    const finalResponse = Response.json({ id: "i1", icu_ftp: 250 });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(brokenResponse)
      .mockResolvedValueOnce(finalResponse) as typeof globalThis.fetch;

    const result = await client(fetch).raw.GET("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.data).toMatchObject({ icu_ftp: 250 });
    expect(result.response).toBe(finalResponse);
    expect(Object.hasOwn(result.response, "text")).toBe(false);
  });

  it("does not retry a raw form-data parser TypeError", async () => {
    const fetch = vi.fn(
      async () =>
        new Response("not a multipart body", {
          headers: { "content-type": "multipart/form-data; boundary=valid-boundary" },
        }),
    ) as typeof globalThis.fetch;

    await expect(
      client(fetch).raw.GET("/api/v1/athlete/{id}", {
        params: { path: { id: "i1" } },
        parseAs: "formData",
      }),
    ).rejects.toBeInstanceOf(TypeError);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry an idempotent raw method with an unknown body serializer", async () => {
    const fetch = vi.fn(
      async () => new Response("retry", { status: 503 }),
    ) as typeof globalThis.fetch;

    const result = await client(fetch).raw.PUT("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
      body: {} as never,
      bodySerializer: () => "opaque-payload",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.response.status).toBe(503);
  });

  it("never retries a successful raw response even if its status is configured", async () => {
    const fetch = vi.fn(async () => Response.json({ id: "i1" })) as typeof globalThis.fetch;
    const api = new IntervalsClient({
      apiKey: "test",
      athleteId: "i1",
      fetch,
      retry: {
        maxAttempts: 2,
        initialDelayMs: 0,
        maxDelayMs: 0,
        jitterFactor: 0,
        retryableStatuses: [200],
      },
    });

    const result = await api.raw.GET("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
    });

    expect(result.response.status).toBe(200);
    expect(result.data).toMatchObject({ id: "i1" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not classify or retry a middleware TypeError as a network failure", async () => {
    const middlewareError = new TypeError("middleware bug");
    const middlewareRequest = vi.fn(() => {
      throw middlewareError;
    });
    const fetch = vi.fn() as typeof globalThis.fetch;
    const onRetry = vi.fn();
    const onError = vi.fn();
    const api = new IntervalsClient({
      apiKey: "test",
      athleteId: "i1",
      fetch,
      retry: { maxAttempts: 2, initialDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 },
      hooks: { onRetry, onError },
    });
    api.raw.use({ onRequest: middlewareRequest });

    await expect(
      api.raw.GET("/api/v1/athlete/{id}", {
        params: { path: { id: "i1" } },
      }),
    ).rejects.toBe(middlewareError);

    expect(middlewareRequest).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ error: { kind: "Unknown", error: middlewareError } }),
    );
  });

  it("restores raw response readers when onResponse middleware throws", async () => {
    const middlewareError = new TypeError("onResponse middleware bug");
    const heldResponse = Response.json({ id: "i1" });
    const fetch = vi.fn(async () => heldResponse) as typeof globalThis.fetch;
    const onRetry = vi.fn();
    const api = new IntervalsClient({
      apiKey: "test",
      athleteId: "i1",
      fetch,
      retry: { maxAttempts: 2, initialDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 },
      hooks: { onRetry },
    });
    api.raw.use({
      onResponse() {
        throw middlewareError;
      },
    });

    await expect(
      api.raw.GET("/api/v1/athlete/{id}", {
        params: { path: { id: "i1" } },
      }),
    ).rejects.toBe(middlewareError);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
    expect(Object.hasOwn(heldResponse, "text")).toBe(false);
  });

  it("does not retry a raw body serialization TypeError", async () => {
    const fetch = vi.fn() as typeof globalThis.fetch;
    const onRetry = vi.fn();
    const onError = vi.fn();
    const api = new IntervalsClient({
      apiKey: "test",
      athleteId: "i1",
      fetch,
      retry: { maxAttempts: 2, initialDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 },
      hooks: { onRetry, onError },
    });

    await expect(
      api.raw.PUT("/api/v1/athlete/{id}", {
        params: { path: { id: "i1" } },
        body: { non_json_value: 1n } as never,
      }),
    ).rejects.toBeInstanceOf(TypeError);

    expect(fetch).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ kind: "Unknown" }) }),
    );
  });
});
