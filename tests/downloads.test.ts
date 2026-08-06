import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { gzipSync } from "node:zlib";
import { IntervalsClient } from "../src/client.js";
import type { BinaryDownload } from "../src/download.js";

const BASE = "https://intervals.icu";
const bytes = new Uint8Array([0x2e, 0x46, 0x49, 0x54]);
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient() {
  return new IntervalsClient({ apiKey: "synthetic-key", athleteId: "synthetic-athlete" });
}

function createRecordingClient(athleteId: string, baseUrl = BASE) {
  const requestedUrls: string[] = [];
  const fetchImpl: typeof globalThis.fetch = async (input) => {
    const rawUrl =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requestedUrls.push(new URL(rawUrl).href);
    return new Response(bytes);
  };

  return {
    client: new IntervalsClient({ apiKey: "synthetic-key", athleteId, baseUrl, fetch: fetchImpl }),
    requestedUrls,
  };
}

describe("download path segments", () => {
  it("keeps reserved characters in an activity ID inside one encoded segment", async () => {
    const { client, requestedUrls } = createRecordingClient("synthetic-athlete");
    const activityId = "../victim?admin=true#fragment/%2F !'()*\\";
    const encodedActivityId = "..%2Fvictim%3Fadmin%3Dtrue%23fragment%2F%252F%20%21%27%28%29%2A%5C";

    await client.activities.downloadFile(activityId);
    await client.activities.downloadFitFile(activityId);
    await client.activities.downloadGpxFile(activityId);

    expect(requestedUrls).toEqual([
      `${BASE}/api/v1/activity/${encodedActivityId}/file`,
      `${BASE}/api/v1/activity/${encodedActivityId}/fit-file`,
      `${BASE}/api/v1/activity/${encodedActivityId}/gpx-file`,
    ]);
  });

  it("percent-encodes a dot-only ID before URL parsing can normalize it", async () => {
    const { client, requestedUrls } = createRecordingClient("synthetic-athlete");

    await client.activities.downloadFile("..");

    expect(requestedUrls).toEqual([`${BASE}/api/v1/activity/%252E%252E/file`]);
  });

  it("keeps adversarial athlete and event IDs inside their path segments", async () => {
    const { client, requestedUrls } = createRecordingClient("../other?scope=all#fragment");

    await client.activities.exportCsv();
    await client.events.downloadWorkout(
      "/../../erase?all=true" as never,
      "fit/../../steal?x=1#frag" as never,
    );
    await client.workouts.downloadZip({
      format: "zwo",
      oldest: "2025-01-01",
      newest: "2025-01-31",
    });

    expect(requestedUrls).toEqual([
      `${BASE}/api/v1/athlete/..%2Fother%3Fscope%3Dall%23fragment/activities.csv`,
      `${BASE}/api/v1/athlete/..%2Fother%3Fscope%3Dall%23fragment/events/%2F..%2F..%2Ferase%3Fall%3Dtrue/download.fit%2F..%2F..%2Fsteal%3Fx%3D1%23frag`,
      `${BASE}/api/v1/athlete/..%2Fother%3Fscope%3Dall%23fragment/workouts.zip?ext=zwo&oldest=2025-01-01&newest=2025-01-31`,
    ]);
  });

  it("normalizes a trailing-slash base URL before appending manual paths", async () => {
    const { client, requestedUrls } = createRecordingClient("synthetic-athlete", `${BASE}///`);

    await client.activities.downloadFile("synthetic-activity");

    expect(requestedUrls).toEqual([`${BASE}/api/v1/activity/synthetic-activity/file`]);
  });
});

describe("download compatibility and metadata", () => {
  it("keeps the legacy ArrayBuffer value and forwards FIT filters", async () => {
    let query = new URLSearchParams();
    server.use(
      http.get(`${BASE}/api/v1/activity/:id/fit-file`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return new HttpResponse(bytes, { headers: { "Content-Type": "application/octet-stream" } });
      }),
    );

    const result = await createClient().activities.downloadFitFile("synthetic-activity", {
      power: false,
      hr: true,
    });

    expectTypeOf(result).toEqualTypeOf<import("../src/result.js").Result<ArrayBuffer>>();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.byteLength).toBe(4);
    expect(query.get("power")).toBe("false");
    expect(query.get("hr")).toBe("true");
  });

  it("returns opt-in metadata and sanitizes a path-like filename", async () => {
    server.use(
      http.get(
        `${BASE}/api/v1/activity/:id/fit-file`,
        () =>
          new HttpResponse(bytes, {
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Disposition": 'attachment; filename="../../unsafe.fit"',
              "Content-Length": "4",
              "Content-Encoding": "identity",
            },
          }),
      ),
    );

    const result = await createClient().activities.downloadFitFile("synthetic-activity", {
      includeMetadata: true,
    });

    expectTypeOf(result).toEqualTypeOf<import("../src/result.js").Result<BinaryDownload>>();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.bytes.byteLength).toBe(4);
      expect(result.value.filename).toBe("unsafe.fit");
      expect(result.value.contentType).toBe("application/octet-stream");
      expect(result.value.contentLength).toBe(4);
      expect(result.value.contentEncoding).toBe("identity");
    }
  });

  it("decodes an RFC 5987 filename and strips controls", async () => {
    server.use(
      http.get(
        `${BASE}/api/v1/activity/:id/gpx-file`,
        () =>
          new HttpResponse(bytes, {
            headers: {
              "Content-Disposition": "attachment; filename*=UTF-8''safe%C2%85%20session.gpx",
            },
          }),
      ),
    );

    const result = await createClient().activities.downloadGpxFile("synthetic-activity", {
      includeMetadata: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.filename).toBe("safe session.gpx");
  });

  it.each([
    ['attachment; filename="CON.fit"', "_CON.fit"],
    ['attachment; filename="file.fit:stream. "', "file.fit_stream"],
  ])("makes a server filename safe across filesystems", async (disposition, expected) => {
    server.use(
      http.get(
        `${BASE}/api/v1/activity/:id/fit-file`,
        () =>
          new HttpResponse(bytes, {
            headers: { "Content-Disposition": disposition },
          }),
      ),
    );

    const result = await createClient().activities.downloadFitFile("synthetic-activity", {
      includeMetadata: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.filename).toBe(expected);
  });

  it("bounds a multibyte filename by filesystem byte and UTF-16 limits", async () => {
    const original = `${"😀".repeat(255)}.fit`;
    server.use(
      http.get(
        `${BASE}/api/v1/activity/:id/fit-file`,
        () =>
          new HttpResponse(bytes, {
            headers: {
              "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(original)}`,
            },
          }),
      ),
    );

    const result = await createClient().activities.downloadFitFile("synthetic-activity", {
      includeMetadata: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const filename = result.value.filename ?? "";
      expect(filename).not.toBe("");
      expect(new TextEncoder().encode(filename).byteLength).toBeLessThanOrEqual(255);
      expect(filename.length).toBeLessThanOrEqual(255);
      expect(filename).toMatch(/\.fit$/u);
    }
  });

  it("reports compressed transport metadata without decompressing Fetch-decoded bytes again", async () => {
    const compressed = gzipSync(bytes);
    server.use(
      http.get(
        `${BASE}/api/v1/activity/:id/fit-file`,
        () =>
          new HttpResponse(compressed, {
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Encoding": "gzip",
              "Content-Length": String(compressed.byteLength),
            },
          }),
      ),
    );

    const result = await createClient().activities.downloadFitFile("synthetic-activity", {
      includeMetadata: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(new Uint8Array(result.value.bytes)).toEqual(bytes);
      expect(result.value.contentEncoding).toBe("gzip");
      expect(result.value.contentLength).toBe(compressed.byteLength);
    }
  });
});

describe("workout ZIP contract", () => {
  it("returns local Validation and makes no request when required options are absent", async () => {
    let requestCount = 0;
    const onRequest = vi.fn();
    const onError = vi.fn();
    server.use(
      http.get(`${BASE}/api/v1/athlete/:id/workouts.zip`, () => {
        requestCount += 1;
        return new HttpResponse(bytes);
      }),
    );

    const client = new IntervalsClient({
      apiKey: "synthetic-key",
      athleteId: "synthetic-athlete",
      hooks: { onRequest, onError },
    });
    const result = await client.workouts.downloadZip();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("Validation");
    expect(requestCount).toBe(0);
    expect(onRequest).toHaveBeenCalledOnce();
    expect(onRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/athlete/{id}/workouts.zip",
    });
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/athlete/{id}/workouts.zip",
        error: expect.objectContaining({ kind: "Validation" }),
      }),
    );
  });

  it.each([
    {},
    { format: "zwo" },
    { format: "xml", oldest: "2025-01-01", newest: "2025-01-31" },
    { format: "zwo", oldest: "", newest: "2025-01-31" },
  ])("rejects incomplete or invalid options without requesting the API", async (options) => {
    let requestCount = 0;
    server.use(
      http.get(`${BASE}/api/v1/athlete/:id/workouts.zip`, () => {
        requestCount += 1;
        return new HttpResponse(bytes);
      }),
    );

    const result = await createClient().workouts.downloadZip(options as never);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("Validation");
    expect(requestCount).toBe(0);
  });

  it("sends the required and optional server query fields", async () => {
    let query = new URLSearchParams();
    server.use(
      http.get(`${BASE}/api/v1/athlete/:id/workouts.zip`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return new HttpResponse(bytes);
      }),
    );

    const result = await createClient().workouts.downloadZip({
      format: "zwo",
      oldest: "2025-01-01",
      newest: "2025-01-31",
      powerRange: 0.05,
      locale: "en",
    });

    expect(result.ok).toBe(true);
    expect(Object.fromEntries(query)).toEqual({
      ext: "zwo",
      oldest: "2025-01-01",
      newest: "2025-01-31",
      powerRange: "0.05",
      locale: "en",
    });
  });
});
