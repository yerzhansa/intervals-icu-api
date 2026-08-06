import { describe, expect, it, vi } from "vitest";
import { createAuthHeaders } from "../src/auth.js";
import { IntervalsClient } from "../src/client.js";
import { HttpExecutor } from "../src/http.js";
import { RateLimiter } from "../src/rate-limiter.js";
import { DEFAULT_RETRY } from "../src/retry.js";

class CustomRequest extends Request {
  static instances: CustomRequest[] = [];
  readonly customMarker = "custom-request";

  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init);
    CustomRequest.instances.push(this);
  }
}

describe("raw custom Request compatibility", () => {
  it("preserves the custom Request and its timeout signal on same-origin calls", async () => {
    CustomRequest.instances = [];
    let observed: Request | undefined;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      observed = input as Request;
      return new Promise<Response>((_resolve, reject) => {
        observed?.signal.addEventListener(
          "abort",
          () => reject(observed?.signal.reason ?? new Error("aborted")),
          { once: true },
        );
      });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({ apiKey: "test", fetch, timeoutMs: 5 });

    await expect(
      client.raw.GET("/api/v1/athlete/{id}", {
        Request: CustomRequest,
        params: { path: { id: "i1" } },
      }),
    ).rejects.toThrow("Request exceeded configured timeout of 5 ms");

    expect(observed).toBeInstanceOf(CustomRequest);
    expect(observed).toBe(CustomRequest.instances.at(-1));
    expect((observed as CustomRequest).customMarker).toBe("custom-request");
    expect(observed?.signal.aborted).toBe(true);
  });

  it("preserves the custom Request for an explicit cross-origin credential", async () => {
    CustomRequest.instances = [];
    let observed: Request | undefined;
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      observed = input as Request;
      return Response.json({ id: "i1", icu_ftp: 250 });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({ apiKey: "test" });

    const result = await client.raw.GET("/api/v1/athlete/{id}", {
      Request: CustomRequest,
      baseUrl: "https://mirror.example.test",
      fetch,
      headers: { Authorization: "Bearer test-mirror-token" },
      params: { path: { id: "i1" } },
    });

    expect(result.data).toMatchObject({ icu_ftp: 250 });
    expect(observed).toBeInstanceOf(CustomRequest);
    expect(observed).toBe(CustomRequest.instances.at(-1));
    expect((observed as CustomRequest).customMarker).toBe("custom-request");
    expect(observed?.headers.get("authorization")).toBe("Bearer test-mirror-token");
  });

  it("materializes init overrides only when removing an inherited credential", async () => {
    const defaultAuthorization = createAuthHeaders({
      type: "api-key",
      apiKey: "test",
    }).Authorization;
    let observedInput: RequestInfo | URL | undefined;
    let observedInit: RequestInit | undefined;
    const fetch = vi.fn(async (input, init) => {
      observedInput = input;
      observedInit = init;
      return Response.json({ ok: true });
    }) as typeof globalThis.fetch;
    const http = new HttpExecutor({
      rateLimiter: new RateLimiter({ requestsPerSecond: 1_000, burst: 1_000 }),
      retryOpts: DEFAULT_RETRY,
      hooks: {},
      baseUrl: "https://example.test",
      auth: { type: "api-key", apiKey: "test" },
    });
    const request = new CustomRequest("https://mirror.example.test/resource", {
      headers: { Authorization: defaultAuthorization },
    });

    await http.createRawFetch(fetch)(request, {
      method: "POST",
      headers: {
        Authorization: defaultAuthorization,
        "x-request-override": "kept",
      },
      body: "payload",
    });

    expect(observedInput).toBeInstanceOf(Request);
    expect(observedInput).not.toBeInstanceOf(CustomRequest);
    const sanitized = observedInput as Request;
    expect(sanitized.method).toBe("POST");
    expect(sanitized.headers.get("authorization")).toBeNull();
    expect(sanitized.headers.get("x-request-override")).toBe("kept");
    expect(await sanitized.text()).toBe("payload");
    expect(observedInit).toBeUndefined();
  });
});
