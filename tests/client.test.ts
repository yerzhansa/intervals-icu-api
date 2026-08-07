import { describe, it, expect, vi } from "vitest";
import type { Middleware } from "openapi-fetch";
import { IntervalsClient } from "../src/client.js";

function hangingJsonResponse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => {}),
    }),
    { headers: { "content-type": "application/json" } },
  );
}

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
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(onResponse).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("applies the managed deadline while shared request middleware is pending", async () => {
    let releaseMiddleware!: () => void;
    const middlewarePending = new Promise<void>((resolve) => {
      releaseMiddleware = resolve;
    });
    const middleware: Middleware = {
      async onRequest() {
        await middlewarePending;
      },
    };
    const fetch = vi.fn(async () => Response.json({ id: "i1" })) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      athleteId: "i1",
      fetch,
      timeoutMs: 5,
    });
    client.raw.use(middleware);

    const result = await client.athlete.get();

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "Timeout",
        message: "Request exceeded configured timeout of 5 ms",
      },
    });
    expect(fetch).not.toHaveBeenCalled();

    releaseMiddleware();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("applies the managed deadline to a response replaced by middleware", async () => {
    const middleware: Middleware = {
      onResponse() {
        return hangingJsonResponse();
      },
    };
    const fetch = vi.fn(async () => Response.json({ id: "i1" })) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      athleteId: "i1",
      fetch,
      timeoutMs: 5,
    });
    client.raw.use(middleware);

    const result = await client.athlete.get();

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "Timeout",
        message: "Request exceeded configured timeout of 5 ms",
      },
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("applies the managed deadline to middleware recovery responses", async () => {
    const middleware: Middleware = {
      onError() {
        return hangingJsonResponse();
      },
    };
    const fetch = vi.fn(async () => {
      throw new TypeError("synthetic transport failure");
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      athleteId: "i1",
      fetch,
      timeoutMs: 5,
    });
    client.raw.use(middleware);

    const result = await client.athlete.get();

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "Timeout",
        message: "Request exceeded configured timeout of 5 ms",
      },
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
