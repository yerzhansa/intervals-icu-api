import { describe, expect, it, vi } from "vitest";
import { createAuthHeaders } from "../src/auth.js";
import { IntervalsClient } from "../src/client.js";

describe("cross-origin authorization provenance", () => {
  it("preserves an explicit request-local credential equal to the client default", async () => {
    const explicitAuthorization = createAuthHeaders({
      type: "api-key",
      apiKey: "test",
    }).Authorization;
    let request: Request | undefined;
    const baseFetch = vi.fn(async () => {
      throw new Error("base Fetch should not run");
    }) as typeof globalThis.fetch;
    const requestLocalFetch = vi.fn(async (input) => {
      request = new Request(input);
      return Response.json({ id: "i1", icu_ftp: 250 });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({ apiKey: "test", fetch: baseFetch });

    const result = await client.raw.GET("/api/v1/athlete/{id}", {
      baseUrl: "https://mirror.example.test",
      fetch: requestLocalFetch,
      headers: { Authorization: explicitAuthorization },
      params: { path: { id: "i1" } },
    });

    expect(result.data).toMatchObject({ icu_ftp: 250 });
    expect(request?.headers.get("authorization")).toBe(explicitAuthorization);
    expect(requestLocalFetch).toHaveBeenCalledTimes(1);
    expect(baseFetch).not.toHaveBeenCalled();
  });

  it("does not treat an undefined request-local value as explicit authorization", async () => {
    let request: Request | undefined;
    const requestLocalFetch = vi.fn(async (input) => {
      request = new Request(input);
      return Response.json({ id: "i1", icu_ftp: 250 });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({ apiKey: "test" });

    const result = await client.raw.GET("/api/v1/athlete/{id}", {
      baseUrl: "https://mirror.example.test",
      fetch: requestLocalFetch,
      headers: { Authorization: undefined },
      params: { path: { id: "i1" } },
    });

    expect(result.data).toMatchObject({ icu_ftp: 250 });
    expect(request?.headers.get("authorization")).toBeNull();
    expect(requestLocalFetch).toHaveBeenCalledTimes(1);
  });
});
