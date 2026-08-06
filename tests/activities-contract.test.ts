import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { IntervalsClient } from "../src/client.js";
import type { ActivityIntervals } from "../src/resources/activities.js";
import {
  KNOWN_ACTIVITY_STREAM_TYPES,
  type ActivityStream,
  type KnownActivityStreamType,
} from "../src/schemas/activity-stream.js";
import streamsFixture from "./fixtures/activity-streams.json";
import intervalsFixture from "./fixtures/activity-intervals.json";

const BASE = "https://intervals.icu";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient() {
  return new IntervalsClient({ apiKey: "synthetic-key", athleteId: "synthetic-athlete" });
}

describe("typed activity streams", () => {
  it("includes raw_watts in the known-name autocomplete union", () => {
    const rawWatts: KnownActivityStreamType = "raw_watts";
    expect(KNOWN_ACTIVITY_STREAM_TYPES).toContain(rawWatts);
  });

  it("preserves the legacy array overload and repeated query parameters", async () => {
    let requestedTypes: string[] = [];
    server.use(
      http.get(`${BASE}/api/v1/activity/:id/streams.json`, ({ request }) => {
        requestedTypes = new URL(request.url).searchParams.getAll("types");
        return HttpResponse.json(streamsFixture);
      }),
    );

    const result = await createClient().activities.getStreams("synthetic-activity", [
      "time",
      "heartrate",
    ]);

    expect(requestedTypes).toEqual(["time", "heartrate"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<ActivityStream[]>();
      expect(result.value[1].data2).toEqual([76.8, 76.81, null]);
      expect(result.value[3].anomalies?.[0].startIndex).toBe(0);
      expect(result.value[3].brandNewMetadata).toBe("preserved");
    }
  });

  it("forwards includeDefaults and does not invent a types parameter", async () => {
    let query = new URLSearchParams();
    server.use(
      http.get(`${BASE}/api/v1/activity/:id/streams.json`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json(streamsFixture);
      }),
    );

    const result = await createClient().activities.getStreams("synthetic-activity", {
      includeDefaults: true,
    });

    expect(result.ok).toBe(true);
    expect(query.has("types")).toBe(false);
    expect(query.get("includeDefaults")).toBe("true");
  });

  it("leaves both optional query fields absent when options are omitted", async () => {
    let query = new URLSearchParams();
    server.use(
      http.get(`${BASE}/api/v1/activity/:id/streams.json`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json(streamsFixture);
      }),
    );

    const result = await createClient().activities.getStreams("synthetic-activity");

    expect(result.ok).toBe(true);
    expect([...query.keys()]).toEqual([]);
  });

  it("returns Validation for malformed stream rows", async () => {
    server.use(
      http.get(`${BASE}/api/v1/activity/:id/streams.json`, () =>
        HttpResponse.json([{ type: "time" }]),
      ),
    );

    const result = await createClient().activities.getStreams("synthetic-activity");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("Validation");
  });
});

describe("activity intervals proof endpoint", () => {
  it("returns the generated interval surface in camelCase", async () => {
    server.use(
      http.get(`${BASE}/api/v1/activity/:id/intervals`, () => HttpResponse.json(intervalsFixture)),
    );

    const result = await createClient().activities.getIntervals("synthetic-activity");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<ActivityIntervals>();
      expect(result.value.icuIntervals?.[0].startIndex).toBe(10);
      expect(result.value.icuIntervals?.[0].averageStanceTime).toBe(250.5);
      expect(result.value.icuGroups?.[0].averageVerticalRatio).toBe(8.1);
    }
  });
});
