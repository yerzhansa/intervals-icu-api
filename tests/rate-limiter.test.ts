import { afterEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../src/rate-limiter.js";

afterEach(() => vi.useRealTimers());

function trackAcquire(limiter: RateLimiter, id: number, resolved: number[]): Promise<void> {
  return limiter.acquire().then(() => {
    resolved.push(id);
  });
}

describe("RateLimiter", () => {
  it("allows immediate requests within burst limit", async () => {
    const limiter = new RateLimiter({ requestsPerSecond: 10, burst: 5 });
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }
  });

  it("releases concurrent waiters in sequence with one owned timer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const limiter = new RateLimiter({ requestsPerSecond: 100, burst: 1 });
    const resolved: number[] = [];
    const requests = Array.from({ length: 4 }, (_, id) => trackAcquire(limiter, id, resolved));

    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toEqual([0]);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(9);
    expect(resolved).toEqual([0]);

    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toEqual([0, 1]);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toEqual([0, 1, 2]);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(10);
    await Promise.all(requests);
    expect(resolved).toEqual([0, 1, 2, 3]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not let a new arrival bypass an existing waiter at a token boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const limiter = new RateLimiter({ requestsPerSecond: 100, burst: 1 });
    const resolved: number[] = [];
    const first = trackAcquire(limiter, 0, resolved);
    const second = trackAcquire(limiter, 1, resolved);

    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toEqual([0]);

    vi.setSystemTime(10);
    const third = trackAcquire(limiter, 2, resolved);
    await Promise.resolve();
    expect(resolved).toEqual([0]);

    await vi.advanceTimersToNextTimerAsync();
    expect(resolved).toEqual([0, 1]);

    await vi.advanceTimersToNextTimerAsync();
    await Promise.all([first, second, third]);
    expect(resolved).toEqual([0, 1, 2]);
  });

  it("rejects a pre-aborted acquisition with its exact reason without consuming a token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const limiter = new RateLimiter({ requestsPerSecond: 100, burst: 1 });
    const controller = new AbortController();
    const reason = new Error("caller cancelled");
    controller.abort(reason);

    await expect(limiter.acquire(controller.signal)).rejects.toBe(reason);
    await expect(limiter.acquire()).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses an AbortError fallback when an aborted signal has no reason", async () => {
    vi.useFakeTimers();
    const signal = { aborted: true, reason: undefined } as AbortSignal;

    await expect(new RateLimiter().acquire(signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes an aborted queued waiter without consuming the next token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const limiter = new RateLimiter({ requestsPerSecond: 100, burst: 1 });
    const controller = new AbortController();
    const reason = { source: "test cancellation" };
    const removeEventListener = vi.spyOn(controller.signal, "removeEventListener");
    const resolved: number[] = [];
    const first = trackAcquire(limiter, 0, resolved);
    const cancelled = limiter.acquire(controller.signal);
    const cancellation = expect(cancelled).rejects.toBe(reason);
    const third = trackAcquire(limiter, 2, resolved);

    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toEqual([0]);
    expect(vi.getTimerCount()).toBe(1);

    controller.abort(reason);
    await cancellation;
    expect(removeEventListener).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(10);
    await Promise.all([first, third]);
    expect(resolved).toEqual([0, 2]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the owned timer when the final queued waiter aborts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const limiter = new RateLimiter({ requestsPerSecond: 100, burst: 1 });
    const controller = new AbortController();

    await limiter.acquire();
    const queued = limiter.acquire(controller.signal);
    const cancellation = expect(queued).rejects.toBe("stop");
    expect(vi.getTimerCount()).toBe(1);

    controller.abort("stop");
    await cancellation;
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(10);
    await expect(limiter.acquire()).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("supports positive fractional request rates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const limiter = new RateLimiter({ requestsPerSecond: 0.5, burst: 1 });
    const resolved: number[] = [];
    const first = trackAcquire(limiter, 0, resolved);
    const second = trackAcquire(limiter, 1, resolved);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(resolved).toEqual([0]);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.all([first, second]);
    expect(resolved).toEqual([0, 1]);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid requestsPerSecond value %s",
    (requestsPerSecond) => {
      expect(() => new RateLimiter({ requestsPerSecond })).toThrow(
        "requestsPerSecond must be a positive finite number",
      );
    },
  );

  it.each([0, -1, 0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid burst value %s",
    (burst) => {
      expect(() => new RateLimiter({ burst })).toThrow("burst must be a positive integer");
    },
  );

  it("keeps default and partial constructor options valid", () => {
    expect(() => new RateLimiter()).not.toThrow();
    expect(() => new RateLimiter({ requestsPerSecond: 2.5 })).not.toThrow();
    expect(() => new RateLimiter({ burst: 1 })).not.toThrow();
    expect(() => new RateLimiter({ requestsPerSecond: undefined, burst: undefined })).not.toThrow();
  });

  it("rejects null options and null fields instead of coercing them", () => {
    expect(() => new RateLimiter(null as never)).toThrow("rateLimit options must be an object");
    expect(() => new RateLimiter({ requestsPerSecond: null } as never)).toThrow(
      "requestsPerSecond must be a positive finite number",
    );
    expect(() => new RateLimiter({ burst: null } as never)).toThrow(
      "burst must be a positive integer",
    );
  });
});
