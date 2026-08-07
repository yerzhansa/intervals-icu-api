import { describe, it, expect } from "vitest";
import {
  calculateDelay,
  applyJitter,
  isRetryable,
  parseRetryAfterMs,
  DEFAULT_RETRY,
  decideRetry,
  validateRetryOptions,
} from "../src/retry.js";

describe("validateRetryOptions", () => {
  it("returns defaults for omitted and explicitly undefined fields", () => {
    const defaults = validateRetryOptions();
    const explicitUndefined = validateRetryOptions({
      maxAttempts: undefined,
      initialDelayMs: undefined,
      maxDelayMs: undefined,
      jitterFactor: undefined,
      retryableStatuses: undefined,
    });

    expect(defaults).toEqual(DEFAULT_RETRY);
    expect(explicitUndefined).toEqual(DEFAULT_RETRY);
    expect(defaults).not.toBe(DEFAULT_RETRY);
    expect(defaults.retryableStatuses).not.toBe(DEFAULT_RETRY.retryableStatuses);
  });

  it("accepts fractional delays, an initial delay above the cap, boundary jitter, and no statuses", () => {
    expect(
      validateRetryOptions({
        maxAttempts: 1,
        initialDelayMs: 10.5,
        maxDelayMs: 0,
        jitterFactor: 1,
        retryableStatuses: [],
      }),
    ).toEqual({
      maxAttempts: 1,
      initialDelayMs: 10.5,
      maxDelayMs: 0,
      jitterFactor: 1,
      retryableStatuses: [],
      retryOnNetworkError: true,
      retryOnTimeout: true,
    });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, null])(
    "rejects invalid maxAttempts value %s",
    (maxAttempts) => {
      expect(() => validateRetryOptions({ maxAttempts } as never)).toThrow(
        "maxAttempts must be a positive finite integer",
      );
    },
  );

  it.each(["initialDelayMs", "maxDelayMs"] as const)("rejects invalid %s values", (field) => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE, null]) {
      expect(() => validateRetryOptions({ [field]: value } as never)).toThrow(
        `${field} must be a non-negative finite number no greater than ${Number.MAX_SAFE_INTEGER}`,
      );
    }
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, null])(
    "rejects invalid jitterFactor value %s",
    (jitterFactor) => {
      expect(() => validateRetryOptions({ jitterFactor } as never)).toThrow(
        "jitterFactor must be a finite number between 0 and 1",
      );
    },
  );

  it.each([[99], [600], [429.5], [Number.NaN], [429, null], null, "429"])(
    "rejects invalid retryableStatuses value %j",
    (retryableStatuses) => {
      expect(() => validateRetryOptions({ retryableStatuses } as never)).toThrow(
        /retryableStatuses must/,
      );
    },
  );

  it("rejects null options", () => {
    expect(() => validateRetryOptions(null as never)).toThrow("retry options must be an object");
  });

  it.each(["retryOnNetworkError", "retryOnTimeout"] as const)(
    "rejects non-boolean %s values",
    (field) => {
      expect(() => validateRetryOptions({ [field]: "yes" } as never)).toThrow(
        `${field} must be a boolean`,
      );
    },
  );
});

describe("isRetryable", () => {
  it("returns true for 429", () => {
    expect(isRetryable(429, DEFAULT_RETRY)).toBe(true);
  });

  it("returns true for 500, 502, 503, 504", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(isRetryable(status, DEFAULT_RETRY)).toBe(true);
    }
  });

  it("returns false for 400, 401, 404", () => {
    for (const status of [400, 401, 404]) {
      expect(isRetryable(status, DEFAULT_RETRY)).toBe(false);
    }
  });
});

describe("decideRetry", () => {
  const base = {
    bodyReplayable: true,
    attempt: 1,
    cause: { kind: "Network" as const },
  };

  it.each(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"])(
    "retries an automatic %s transport failure",
    (method) => {
      expect(decideRetry({ ...base, method, mode: "auto" }, DEFAULT_RETRY)?.cause).toEqual({
        kind: "Network",
      });
    },
  );

  it.each(["POST", "PATCH", "TRACE"])("does not automatically retry %s", (method) => {
    expect(decideRetry({ ...base, method, mode: "auto" }, DEFAULT_RETRY)).toBeUndefined();
  });

  it("honors explicit idempotent and never modes", () => {
    expect(
      decideRetry({ ...base, method: "POST", mode: "idempotent" }, DEFAULT_RETRY),
    ).toBeDefined();
    expect(decideRetry({ ...base, method: "GET", mode: "never" }, DEFAULT_RETRY)).toBeUndefined();
  });

  it("requires a replayable body and an available attempt", () => {
    expect(
      decideRetry({ ...base, method: "GET", mode: "auto", bodyReplayable: false }, DEFAULT_RETRY),
    ).toBeUndefined();
    expect(
      decideRetry({ ...base, method: "GET", mode: "auto", attempt: 3 }, DEFAULT_RETRY),
    ).toBeUndefined();
  });

  it("respects operational retry switches and configured statuses", () => {
    expect(
      decideRetry(
        { ...base, method: "GET", mode: "auto" },
        { ...DEFAULT_RETRY, retryOnNetworkError: false },
      ),
    ).toBeUndefined();
    expect(
      decideRetry(
        { ...base, method: "GET", mode: "auto", cause: { kind: "Timeout" } },
        { ...DEFAULT_RETRY, retryOnTimeout: false },
      ),
    ).toBeUndefined();
    expect(
      decideRetry(
        { ...base, method: "GET", mode: "auto", cause: { kind: "Http", status: 400 } },
        DEFAULT_RETRY,
      ),
    ).toBeUndefined();
  });
});

describe("calculateDelay", () => {
  it("uses Retry-After header when present", () => {
    const delay = calculateDelay(1, DEFAULT_RETRY, "5");
    expect(delay).toBe(5000);
  });

  it("caps Retry-After at maxDelayMs without jitter", () => {
    const delay = calculateDelay(1, { ...DEFAULT_RETRY, maxDelayMs: 2_000 }, "5");
    expect(delay).toBe(2_000);
  });

  it("uses an HTTP-date Retry-After header", () => {
    const now = Date.parse("2026-08-06T10:00:00.000Z");
    const delay = calculateDelay(1, DEFAULT_RETRY, "Thu, 06 Aug 2026 10:00:05 GMT", now);
    expect(delay).toBe(5000);
  });

  it("rejects partial or negative delta-seconds", () => {
    expect(parseRetryAfterMs("5.5")).toBeUndefined();
    expect(parseRetryAfterMs("-1")).toBeUndefined();
    expect(parseRetryAfterMs("5 seconds")).toBeUndefined();
  });

  it("uses exponential backoff when no header", () => {
    const delay1 = calculateDelay(1, { ...DEFAULT_RETRY, jitterFactor: 0 });
    expect(delay1).toBe(1000); // 1000 * 2^0

    const delay2 = calculateDelay(2, { ...DEFAULT_RETRY, jitterFactor: 0 });
    expect(delay2).toBe(2000); // 1000 * 2^1

    const delay3 = calculateDelay(3, { ...DEFAULT_RETRY, jitterFactor: 0 });
    expect(delay3).toBe(4000); // 1000 * 2^2
  });

  it("caps at maxDelayMs", () => {
    const delay = calculateDelay(10, { ...DEFAULT_RETRY, jitterFactor: 0, maxDelayMs: 5000 });
    expect(delay).toBe(5000);
  });

  it("keeps a zero backoff finite after exponent overflow", () => {
    const delay = calculateDelay(2_000, {
      ...DEFAULT_RETRY,
      initialDelayMs: 0,
      maxDelayMs: 0,
    });
    expect(delay).toBe(0);
  });
});

describe("applyJitter", () => {
  it("returns value within jitter range", () => {
    for (let i = 0; i < 100; i++) {
      const result = applyJitter(1000, 0.2);
      expect(result).toBeGreaterThanOrEqual(800);
      expect(result).toBeLessThanOrEqual(1200);
    }
  });

  it("returns exact value with zero jitter", () => {
    const result = applyJitter(1000, 0);
    expect(result).toBe(1000);
  });

  it("keeps very large accepted delays finite and safe", () => {
    const result = applyJitter(Number.MAX_SAFE_INTEGER, 1);
    expect(Number.isSafeInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });
});
