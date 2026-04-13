import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, unwrap, mapResult } from "../src/result.js";

describe("Result", () => {
  it("ok() creates success result", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
  });

  it("err() creates error result", () => {
    const r = err({ kind: "NotFound" as const, status: 404 as const, body: null });
    expect(r.ok).toBe(false);
    expect(r.error.kind).toBe("NotFound");
  });

  it("isOk narrows type", () => {
    const r = ok("hello");
    if (isOk(r)) {
      expect(r.value).toBe("hello");
    }
  });

  it("isErr narrows type", () => {
    const r = err({ kind: "Unknown" as const, error: "fail" });
    if (isErr(r)) {
      expect(r.error.kind).toBe("Unknown");
    }
  });

  it("unwrap() returns value for ok", () => {
    expect(unwrap(ok(42))).toBe(42);
  });

  it("unwrap() throws for err", () => {
    expect(() => unwrap(err({ kind: "Unknown" as const, error: "fail" }))).toThrow("Unwrap failed");
  });

  it("mapResult transforms value", () => {
    const r = mapResult(ok(21), (v) => v * 2);
    expect(unwrap(r)).toBe(42);
  });

  it("mapResult passes through errors", () => {
    const e = err({ kind: "NotFound" as const, status: 404 as const, body: null });
    const r = mapResult(e, () => "nope");
    expect(r.ok).toBe(false);
  });
});
