import { describe, it, expect, vi } from "vitest";
import { IntervalsClient } from "../src/client.js";

describe("IntervalsClient", () => {
  it("throws if no auth provided", () => {
    expect(() => new IntervalsClient({})).toThrow("Either apiKey or bearerToken must be provided");
  });

  it('defaults athleteId to "0"', () => {
    const client = new IntervalsClient({ apiKey: "test" });
    expect(client.athleteId).toBe("0");
  });

  it("uses provided athleteId", () => {
    const client = new IntervalsClient({ apiKey: "test", athleteId: "i12345" });
    expect(client.athleteId).toBe("i12345");
  });

  it("exposes raw api client", () => {
    const client = new IntervalsClient({ apiKey: "test" });
    expect(client.raw).toBeDefined();
    expect(client.raw.GET).toBeTypeOf("function");
  });

  it("exposes resource groups", () => {
    const client = new IntervalsClient({ apiKey: "test" });
    expect(client.athlete).toBeDefined();
    expect(client.activities).toBeDefined();
    expect(client.wellness).toBeDefined();
    expect(client.events).toBeDefined();
    expect(client.workouts).toBeDefined();
    expect(client.powerCurves).toBeDefined();
    expect(client.folders).toBeDefined();
    expect(client.gear).toBeDefined();
  });

  it("accepts hooks option", () => {
    const client = new IntervalsClient({
      apiKey: "test",
      hooks: {
        onRequest: vi.fn(),
      },
    });
    expect(client).toBeDefined();
  });

  it("accepts retry option", () => {
    const client = new IntervalsClient({
      apiKey: "test",
      retry: { maxAttempts: 5, initialDelayMs: 500 },
    });
    expect(client).toBeDefined();
  });

  it("validates retry options during construction", () => {
    expect(
      () =>
        new IntervalsClient({
          apiKey: "test",
          retry: { maxAttempts: 0 },
        }),
    ).toThrow("maxAttempts must be a positive finite integer");

    expect(
      () =>
        new IntervalsClient({
          apiKey: "test",
          retry: { maxAttempts: undefined },
        }),
    ).not.toThrow();
  });

  it("maps a hanging OpenAPI response body to Timeout after headers arrive", async () => {
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
      athleteId: "i1",
      fetch,
      timeoutMs: 5,
      hooks: { onResponse, onError },
    });

    const result = await client.athlete.get();

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "Timeout",
        message: "Request exceeded configured timeout of 5 ms",
      },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onResponse).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
