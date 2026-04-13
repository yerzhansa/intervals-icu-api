import { describe, it, expect, vi } from "vitest";
import { callHook, type Hooks } from "../src/hooks.js";

describe("callHook", () => {
  it("calls the hook when defined", async () => {
    const onRequest = vi.fn();
    const hooks: Hooks = { onRequest };
    await callHook(hooks, "onRequest", { method: "GET", path: "/test" });
    expect(onRequest).toHaveBeenCalledWith({ method: "GET", path: "/test" });
  });

  it("does nothing when hook is undefined", async () => {
    const hooks: Hooks = {};
    await callHook(hooks, "onRequest", { method: "GET", path: "/test" });
  });

  it("supports async hooks", async () => {
    const order: string[] = [];
    const hooks: Hooks = {
      onRequest: async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push("hook");
      },
    };
    await callHook(hooks, "onRequest", { method: "GET", path: "/test" });
    order.push("after");
    expect(order).toEqual(["hook", "after"]);
  });

  it("swallows hook errors", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const hooks: Hooks = {
      onRequest: () => {
        throw new Error("hook broke");
      },
    };
    await callHook(hooks, "onRequest", { method: "GET", path: "/test" });
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it("fires onResponse with status and duration", async () => {
    const onResponse = vi.fn();
    const hooks: Hooks = { onResponse };
    await callHook(hooks, "onResponse", {
      method: "GET",
      path: "/test",
      status: 200,
      durationMs: 42,
    });
    expect(onResponse).toHaveBeenCalledWith({
      method: "GET",
      path: "/test",
      status: 200,
      durationMs: 42,
    });
  });

  it("fires onRetry with attempt info", async () => {
    const onRetry = vi.fn();
    const hooks: Hooks = { onRetry };
    await callHook(hooks, "onRetry", {
      method: "GET",
      path: "/test",
      attempt: 1,
      maxAttempts: 3,
      delayMs: 1000,
      reason: "HTTP 429",
    });
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, delayMs: 1000 }));
  });
});
