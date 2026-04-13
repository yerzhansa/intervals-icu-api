import { describe, it, expect } from "vitest";
import { RateLimiter } from "../src/rate-limiter.js";

describe("RateLimiter", () => {
  it("allows immediate requests within burst limit", async () => {
    const limiter = new RateLimiter({ requestsPerSecond: 10, burst: 5 });
    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("delays requests when tokens exhausted", async () => {
    const limiter = new RateLimiter({ requestsPerSecond: 10, burst: 1 });
    await limiter.acquire(); // uses the 1 token
    const start = Date.now();
    await limiter.acquire(); // must wait ~100ms for refill
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });
});
