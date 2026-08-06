import { afterEach, describe, expect, it, vi } from "vitest";
import { IntervalsClient } from "../src/client.js";

const MAX_TIMER_DELAY_MS = 2_147_483_647;

afterEach(() => vi.useRealTimers());

describe("raw abort integration", () => {
  it("removes an aborted limiter waiter without a later fetch", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onError = vi.fn();
    const onRetry = vi.fn();
    const fetch = vi.fn(async () => Response.json({ id: "i1" })) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      fetch,
      rateLimit: { requestsPerSecond: 1, burst: 1 },
      hooks: { onError, onRetry },
    });

    const first = await client.raw.GET("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
    });
    expect(first.data).toMatchObject({ id: "i1" });

    const controller = new AbortController();
    const reason = new Error("stop queued raw request");
    const second = client.raw.GET("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
      signal: controller.signal,
    });
    const rejection = expect(second).rejects.toBe(reason);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    controller.abort(reason);
    await rejection;

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/athlete/{id}",
        error: { kind: "Network", message: "Request aborted" },
      }),
    );
    expect(onRetry).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("aborts a long Retry-After backoff without a later attempt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let observeRetry!: () => void;
    const retryObserved = new Promise<void>((resolve) => {
      observeRetry = resolve;
    });
    const onRetry = vi.fn(() => observeRetry());
    const onError = vi.fn();
    const onResponse = vi.fn();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("wait", {
          status: 503,
          headers: { "retry-after": "2147484" },
        }),
      )
      .mockResolvedValueOnce(Response.json({ id: "i1" })) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "test",
      fetch,
      retry: { maxAttempts: 2, initialDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 },
      hooks: { onRetry, onError, onResponse },
    });
    const controller = new AbortController();
    const reason = new Error("stop raw retry backoff");

    const pending = client.raw.GET("/api/v1/athlete/{id}", {
      params: { path: { id: "i1" } },
      signal: controller.signal,
    });
    const rejection = expect(pending).rejects.toBe(reason);
    await retryObserved;
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    controller.abort(reason);
    await rejection;

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/athlete/{id}",
        error: { kind: "Network", message: "Request aborted" },
      }),
    );
    expect(onResponse).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(MAX_TIMER_DELAY_MS);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
