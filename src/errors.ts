export class IntervalsApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Intervals.icu API error: ${status}`);
    this.name = "IntervalsApiError";
    this.status = status;
    this.body = body;
  }
}

export class RateLimitError extends IntervalsApiError {
  readonly retryAfter: number;

  constructor(retryAfter: number, body?: unknown) {
    super(429, body, `Rate limited. Retry after ${retryAfter}ms`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class AuthenticationError extends IntervalsApiError {
  constructor(body?: unknown) {
    super(401, body, "Authentication failed. Check your API key or bearer token.");
    this.name = "AuthenticationError";
  }
}
