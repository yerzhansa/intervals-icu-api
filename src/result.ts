export type Result<T, E = ApiError> = { ok: true; value: T } | { ok: false; error: E };

export type ApiError =
  | { kind: "Unauthorized"; status: 401; body: unknown }
  | { kind: "Forbidden"; status: 403; body: unknown }
  | { kind: "NotFound"; status: 404; body: unknown }
  | { kind: "RateLimit"; status: 429; retryAfterMs: number; body: unknown }
  | { kind: "Validation"; issues: ValidationIssue[] }
  | { kind: "Http"; status: number; statusText: string; body: unknown }
  | { kind: "Timeout"; message: string }
  | { kind: "Network"; message: string }
  | { kind: "Unknown"; error: unknown };

export interface ValidationIssue {
  path: string;
  message: string;
  expected: string;
  received: unknown;
}

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw new Error(`Unwrap failed: ${JSON.stringify(result.error)}`);
}

export function mapResult<T, U, E>(result: Result<T, E>, fn: (v: T) => U): Result<U, E> {
  if (result.ok) return ok(fn(result.value));
  return result;
}

export function toValidationIssues(issues: { path?: { key: unknown }[]; message: string; expected?: string | null; received?: unknown }[]): ValidationIssue[] {
  return issues.map((i) => ({
    path: i.path?.map((p) => String(p.key)).join(".") ?? "",
    message: i.message,
    expected: i.expected ?? "unknown",
    received: i.received,
  }));
}

