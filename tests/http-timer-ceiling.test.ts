import { describe, expect, it, vi } from "vitest";
import { HttpExecutor } from "../src/http.js";
import { RateLimiter } from "../src/rate-limiter.js";
import { DEFAULT_RETRY } from "../src/retry.js";

const MAX_TIMER_DELAY_MS = 2_147_483_647;

function executor(timeoutMs?: number) {
  return new HttpExecutor({
    rateLimiter: new RateLimiter({ requestsPerSecond: 1_000, burst: 1_000 }),
    retryOpts: {
      ...DEFAULT_RETRY,
      maxAttempts: 2,
      initialDelayMs: 0,
      maxDelayMs: 0,
      jitterFactor: 0,
    },
    hooks: {},
    baseUrl: "https://example.test",
    auth: { type: "api-key", apiKey: "test" },
    timeoutMs,
  });
}

describe("HTTP timer ceilings", () => {
  it("rejects timeout values that the runtime timer would truncate", () => {
    expect(() => executor(MAX_TIMER_DELAY_MS)).not.toThrow();
    expect(() => executor(MAX_TIMER_DELAY_MS + 1)).toThrow(
      `timeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`,
    );
  });

  it("chunks a Retry-After delay larger than the runtime timer ceiling", async () => {
    vi.useFakeTimers();
    try {
      const http = executor();
      let calls = 0;
      const pending = http.requestJson<{ ready: boolean }>("GET", "/long-retry", async () => {
        calls += 1;
        if (calls === 1) {
          return {
            error: "wait",
            response: new Response("wait", {
              status: 429,
              headers: { "retry-after": "2147484" },
            }),
          };
        }
        return {
          data: { ready: true },
          response: Response.json({ ready: true }),
        };
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(calls).toBe(1);
      await vi.advanceTimersByTimeAsync(MAX_TIMER_DELAY_MS);
      expect(calls).toBe(1);
      await vi.advanceTimersByTimeAsync(352);
      expect(calls).toBe(1);
      await vi.advanceTimersByTimeAsync(1);

      await expect(pending).resolves.toEqual({ ok: true, value: { ready: true } });
      expect(calls).toBe(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
