import { describe, it, expect } from "vitest";
import { IntervalsApiError, RateLimitError, AuthenticationError } from "../src/errors.js";

describe("errors", () => {
  it("IntervalsApiError has status and body", () => {
    const err = new IntervalsApiError(404, { message: "not found" });
    expect(err.status).toBe(404);
    expect(err.body).toEqual({ message: "not found" });
    expect(err.name).toBe("IntervalsApiError");
    expect(err).toBeInstanceOf(Error);
  });

  it("RateLimitError has retryAfter", () => {
    const err = new RateLimitError(5000);
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBe(5000);
    expect(err.name).toBe("RateLimitError");
    expect(err).toBeInstanceOf(IntervalsApiError);
  });

  it("AuthenticationError is 401", () => {
    const err = new AuthenticationError();
    expect(err.status).toBe(401);
    expect(err.name).toBe("AuthenticationError");
    expect(err).toBeInstanceOf(IntervalsApiError);
  });
});
