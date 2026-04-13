import { describe, it, expect } from "vitest";
import { calculateDelay, applyJitter, isRetryable, DEFAULT_RETRY } from "../src/retry.js";

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

describe("calculateDelay", () => {
  it("uses Retry-After header when present", () => {
    const delay = calculateDelay(1, DEFAULT_RETRY, "5");
    expect(delay).toBe(5000);
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
});
