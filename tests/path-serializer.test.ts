import { describe, expect, it, vi } from "vitest";
import { IntervalsClient } from "../src/client.js";

const dotCases = [
  [".", "%252E"],
  ["..", "%252E%252E"],
  ["%2e", "%252E"],
  [".%2E", "%252E%252E"],
] as const;

describe("generated path serialization", () => {
  it("keeps managed dot-only activity IDs in their path segment", async () => {
    const urls: string[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(new Request(input).url);
      return Response.json({
        id: "synthetic-activity",
        start_date_local: "2026-01-01T00:00:00",
        type: "Run",
      });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({ apiKey: "test", fetch });

    for (const [id] of dotCases) {
      const result = await client.activities.get(id);
      expect(result.ok).toBe(true);
    }

    expect(urls.map((url) => new URL(url).pathname)).toEqual(
      dotCases.map(([, encoded]) => `/api/v1/activity/${encoded}`),
    );
  });

  it("keeps raw dot-only athlete IDs in their path segment", async () => {
    const urls: string[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(new Request(input).url);
      return Response.json({ id: "synthetic-athlete" });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({ apiKey: "test", fetch });

    for (const [id] of dotCases) {
      const result = await client.raw.GET("/api/v1/athlete/{id}", {
        params: { path: { id } },
      });
      expect(result.data).toMatchObject({ id: "synthetic-athlete" });
    }

    expect(urls.map((url) => new URL(url).pathname)).toEqual(
      dotCases.map(([, encoded]) => `/api/v1/athlete/${encoded}`),
    );
  });
});
