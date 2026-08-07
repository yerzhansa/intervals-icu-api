import { describe, expect, it, vi } from "vitest";
import { HttpExecutor } from "../src/http.js";
import { RateLimiter } from "../src/rate-limiter.js";
import { DEFAULT_RETRY } from "../src/retry.js";

describe("binary response timeout ownership", () => {
  it("retains the deadline for a hanging body declared as length zero", async () => {
    const fetch = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        pull: () => new Promise<void>(() => {}),
      });
      return new Response(body, {
        headers: {
          "content-length": "0",
          "content-type": "application/octet-stream",
        },
      });
    }) as typeof globalThis.fetch;
    const http = new HttpExecutor({
      rateLimiter: new RateLimiter({ requestsPerSecond: 1_000, burst: 1_000 }),
      retryOpts: { ...DEFAULT_RETRY, maxAttempts: 1 },
      hooks: {},
      baseUrl: "https://example.test",
      auth: { type: "api-key", apiKey: "test" },
      fetchImpl: fetch,
      timeoutMs: 5,
    });

    let safetyTimer: ReturnType<typeof setTimeout> | undefined;
    const outcome = await Promise.race([
      http.requestBinary("GET", "/hanging-empty", "/hanging-empty"),
      new Promise<"deadline-was-released">((resolve) => {
        safetyTimer = setTimeout(() => resolve("deadline-was-released"), 100);
      }),
    ]);
    if (safetyTimer !== undefined) clearTimeout(safetyTimer);

    expect(outcome).toEqual({
      ok: false,
      error: {
        kind: "Timeout",
        message: "Request exceeded configured timeout of 5 ms",
      },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("maps a SyntaxError raised by a binary body stream to Network", async () => {
    const fetch = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new SyntaxError("binary stream decoding failed"));
        },
      });
      return new Response(body, {
        headers: { "content-type": "application/octet-stream" },
      });
    }) as typeof globalThis.fetch;
    const http = new HttpExecutor({
      rateLimiter: new RateLimiter({ requestsPerSecond: 1_000, burst: 1_000 }),
      retryOpts: { ...DEFAULT_RETRY, maxAttempts: 1 },
      hooks: {},
      baseUrl: "https://example.test",
      auth: { type: "api-key", apiKey: "test" },
      fetchImpl: fetch,
    });

    const result = await http.requestBinary("GET", "/broken-binary", "/broken-binary");

    expect(result).toEqual({
      ok: false,
      error: { kind: "Network", message: "Network request failed" },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
