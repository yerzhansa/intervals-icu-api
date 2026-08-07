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
