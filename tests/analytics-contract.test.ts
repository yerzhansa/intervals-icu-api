import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import * as v from "valibot";
import { IntervalsClient } from "../src/client.js";
import type {
  ActivityFilterInput,
  FindBestEffortsOptions,
} from "../src/resources/activity-analytics.js";
import {
  ActivityHeartRateCurvePayloadSchema,
  ActivityPaceCurvePayloadSchema,
  ActivityPowerCurvePayloadSchema,
  AthletePowerCurveSchema,
  AthletePowerHeartRateCurveSchema,
  HeartRateCurveSchema,
  PaceCurveSchema,
  PowerCurveSchema,
} from "../src/schemas/analytics.js";
import type {
  AthleteHeartRateCurveSet,
  AthletePaceCurveSet,
  AthletePowerCurve,
  AthletePowerCurveSet,
  AthleteCurveActivity,
  HeartRateCurve,
  PaceCurve,
  PowerCurve,
  PowerVsHeartRatePlot,
} from "../src/schemas/analytics.js";
import fixture from "./fixtures/analytics-responses.json";

const BASE = "https://intervals.icu";
const observedUrls = new Map<string, URL>();

function jsonHandler(path: string, value: unknown) {
  return http.get(`${BASE}${path}`, ({ request }) => {
    observedUrls.set(path, new URL(request.url));
    return HttpResponse.json(value);
  });
}

const server = setupServer(
  jsonHandler("/api/v1/activity/:id/best-efforts", fixture.bestEfforts),
  jsonHandler("/api/v1/activity/:id/gap-histogram", fixture.histogram),
  jsonHandler("/api/v1/activity/:id/hr-histogram", fixture.histogram),
  jsonHandler("/api/v1/activity/:id/pace-histogram", fixture.histogram),
  jsonHandler("/api/v1/activity/:id/power-histogram", fixture.histogram),
  jsonHandler("/api/v1/activity/:id/hr-curve", fixture.heartRateCurve),
  jsonHandler("/api/v1/activity/:id/pace-curve", fixture.paceCurve),
  jsonHandler("/api/v1/activity/:id/power-curve", fixture.powerCurve),
  jsonHandler("/api/v1/activity/:id/power-curves", [fixture.powerCurve]),
  jsonHandler("/api/v1/activity/:id/power-vs-hr", fixture.powerVsHeartRate),
  jsonHandler("/api/v1/athlete/:id/activity-hr-curves", fixture.activityHeartRateCurves),
  jsonHandler("/api/v1/athlete/:id/activity-pace-curves", fixture.activityPaceCurves),
  jsonHandler("/api/v1/athlete/:id/activity-power-curves", fixture.activityPowerCurves),
  jsonHandler("/api/v1/athlete/:id/hr-curves", fixture.athleteHeartRateCurveSet),
  jsonHandler("/api/v1/athlete/:id/pace-curves", fixture.athletePaceCurveSet),
  jsonHandler("/api/v1/athlete/:id/power-curves", fixture.athletePowerCurveSet),
  jsonHandler("/api/v1/athlete/:id/power-hr-curve", fixture.athletePowerHeartRateCurve),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

function createClient() {
  return new IntervalsClient({ apiKey: "synthetic-key", athleteId: "synthetic-athlete" });
}

describe("activity analytics endpoints", () => {
  it("exposes typed best efforts, histograms, curves, and power versus heart rate", async () => {
    const client = createClient();
    const bestEfforts = await client.activities.findBestEfforts("synthetic-activity", {
      stream: "watts",
      duration: 300,
      count: 1,
      minValue: 200,
      excludeIntervals: true,
      startIndex: 1,
      endIndex: 400,
    });
    const gapHistogram = await client.activities.getGapHistogram("synthetic-activity");
    const heartRateHistogram = await client.activities.getHeartRateHistogram("synthetic-activity", {
      bucketSize: 5,
    });
    const paceHistogram = await client.activities.getPaceHistogram("synthetic-activity");
    const powerHistogram = await client.activities.getPowerHistogram("synthetic-activity", {
      bucketSize: 25,
    });
    const heartRateCurve = await client.activities.getHeartRateCurve("synthetic-activity");
    const paceCurve = await client.activities.getPaceCurve("synthetic-activity", { gap: true });
    const powerCurve = await client.activities.getPowerCurve("synthetic-activity", {
      fatigue: "kj0",
    });
    const powerCurves = await client.activities.getPowerCurves("synthetic-activity", {
      types: ["watts", "raw_watts"],
      fatigue: ["normal", "kj0"],
    });
    const powerVsHeartRate = await client.activities.getPowerVsHeartRate("synthetic-activity");

    expect(bestEfforts.ok && bestEfforts.value.efforts[0].startIndex).toBe(10);
    expect(bestEfforts.ok && bestEfforts.value.newServerField).toBe("preserved");
    expect(gapHistogram.ok && gapHistogram.value[0].movingSecs).toBe(55);
    expect(heartRateHistogram.ok && heartRateHistogram.value[0].min).toBe(100);
    expect(paceHistogram.ok).toBe(true);
    expect(powerHistogram.ok && powerHistogram.value[0].max).toBe(150);
    expect(heartRateCurve.ok && heartRateCurve.value.activityId).toEqual(["synthetic-activity"]);
    expect(paceCurve.ok && paceCurve.value.paceModels?.[0].criticalSpeed).toBe(4.2);
    expect(powerCurve.ok && powerCurve.value.wattsPerKg?.[2]).toBe(3.5);
    expect(powerCurve.ok && powerCurve.value.watts[2]).toBe(300);
    expect(powerCurves.ok && powerCurves.value).toHaveLength(1);
    expect(powerVsHeartRate.ok && powerVsHeartRate.value.powerHr).toBeUndefined();
    expectTypeOf(heartRateCurve).toEqualTypeOf<
      { ok: true; value: HeartRateCurve } | { ok: false; error: unknown }
    >();
    expectTypeOf(powerVsHeartRate).toMatchTypeOf<
      { ok: true; value: PowerVsHeartRatePlot } | { ok: false }
    >();
    expectTypeOf(powerCurve).toMatchTypeOf<{ ok: true; value: PowerCurve } | { ok: false }>();

    const bestUrl = observedUrls.get("/api/v1/activity/:id/best-efforts");
    expect(bestUrl?.searchParams.get("stream")).toBe("watts");
    expect(bestUrl?.searchParams.get("duration")).toBe("300");
    expect(bestUrl?.searchParams.get("excludeIntervals")).toBe("true");
    expect(observedUrls.get("/api/v1/activity/:id/pace-curve")?.searchParams.get("gap")).toBe(
      "true",
    );
    expect(observedUrls.get("/api/v1/activity/:id/power-curves")?.searchParams.get("types")).toBe(
      "watts,raw_watts",
    );
    expect(observedUrls.get("/api/v1/activity/:id/power-curves")?.searchParams.get("fatigue")).toBe(
      "normal,kj0",
    );
  });

  it("returns Validation when a stable semantic axis is missing", async () => {
    server.use(
      http.get(`${BASE}/api/v1/activity/:id/hr-curve`, () => HttpResponse.json({ values: [150] })),
    );

    const result = await createClient().activities.getHeartRateCurve("synthetic-activity");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("Validation");
  });

  it.each([
    ["missing", {}],
    ["null duration", { duration: null }],
    ["NaN distance", { distance: Number.NaN }],
    ["infinite duration", { duration: Number.POSITIVE_INFINITY }],
  ] as const)(
    "rejects a best-efforts search with a %s window before fetching",
    async (_name, window) => {
      let requestCount = 0;
      server.use(
        http.get(`${BASE}/api/v1/activity/:id/best-efforts`, () => {
          requestCount += 1;
          return HttpResponse.json(fixture.bestEfforts);
        }),
      );
      const options = { stream: "watts", ...window } as unknown as FindBestEffortsOptions;

      const result = await createClient().activities.findBestEfforts("synthetic-activity", options);

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "Validation",
          issues: [
            {
              path: "query",
              message: "At least one of duration or distance is required",
              expected: "duration or distance",
              received: undefined,
            },
          ],
        },
      });
      expect(requestCount).toBe(0);
    },
  );

  it("preserves zero as a finite best-efforts window selector", async () => {
    let requestedUrl: URL | undefined;
    server.use(
      http.get(`${BASE}/api/v1/activity/:id/best-efforts`, ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json(fixture.bestEfforts);
      }),
    );

    const result = await createClient().activities.findBestEfforts("synthetic-activity", {
      stream: "watts",
      duration: 0,
    });

    expect(result.ok).toBe(true);
    expect(requestedUrl?.searchParams.get("duration")).toBe("0");
  });
});

describe("analytics positional curve schemas", () => {
  it.each([
    ["heart-rate secs/values", HeartRateCurveSchema, { secs: [1, 60], values: [180] }],
    [
      "heart-rate secs/start_index",
      HeartRateCurveSchema,
      { secs: [1, 60], values: [180, 160], start_index: [1] },
    ],
    [
      "heart-rate secs/end_index",
      HeartRateCurveSchema,
      { secs: [1, 60], values: [180, 160], end_index: [2] },
    ],
    ["pace distance/values", PaceCurveSchema, { distance: [1_000], values: [220, 1_200] }],
    [
      "pace distance/start_index",
      PaceCurveSchema,
      { distance: [400, 1_000], values: [80, 220], start_index: [1] },
    ],
    [
      "pace distance/end_index",
      PaceCurveSchema,
      { distance: [400, 1_000], values: [80, 220], end_index: [2] },
    ],
    ["activity power secs/watts", PowerCurveSchema, { secs: [5, 60], watts: [400] }],
    [
      "activity power secs/optional values",
      PowerCurveSchema,
      { secs: [5, 60], watts: [400, 350], values: [400] },
    ],
    [
      "activity power secs/watts_per_kg",
      PowerCurveSchema,
      { secs: [5, 60], watts: [400, 350], watts_per_kg: [5] },
    ],
    ["athlete power secs/values", AthletePowerCurveSchema, { secs: [5, 60], values: [400] }],
    [
      "athlete power secs/optional watts",
      AthletePowerCurveSchema,
      { secs: [5, 60], values: [400, 350], watts: [400] },
    ],
    [
      "athlete power secs/watts_per_kg",
      AthletePowerCurveSchema,
      { secs: [5, 60], values: [400, 350], watts_per_kg: [5] },
    ],
    [
      "activity heart-rate payload axis",
      ActivityHeartRateCurvePayloadSchema,
      { secs: [60, 300], curves: [{ bpm: [180] }] },
    ],
    [
      "activity pace payload axis",
      ActivityPaceCurvePayloadSchema,
      { distances: [1_000, 5_000], gap: false, curves: [{ secs: [220] }] },
    ],
    [
      "activity power payload axis",
      ActivityPowerCurvePayloadSchema,
      { secs: [60, 300], curves: [{ watts: [400] }] },
    ],
    [
      "power/heart-rate bpm/cadence/minutes",
      AthletePowerHeartRateCurveSchema,
      { bpm: [150, 160], cadence: [85], minutes: [10, 20] },
    ],
  ] as const)("rejects mismatched %s arrays", (_name, schema, input) => {
    expect(v.safeParse(schema, input).success).toBe(false);
  });

  it.each([
    [
      "heart-rate index",
      HeartRateCurveSchema,
      { secs: [1, 60], values: [180, 160], start_index: null },
    ],
    ["pace index", PaceCurveSchema, { distance: [400, 1_000], values: [80, 220], end_index: null }],
    [
      "activity power W/kg",
      PowerCurveSchema,
      { secs: [5, 60], watts: [400, 350], watts_per_kg: null },
    ],
    ["athlete power W/kg", AthletePowerCurveSchema, { secs: [5, 60], values: [400, 350] }],
  ] as const)("accepts nullish/absent optional %s arrays", (_name, schema, input) => {
    expect(v.safeParse(schema, input).success).toBe(true);
  });
});

describe("athlete analytics endpoints", () => {
  it("returns typed range payloads in canonical camelCase", async () => {
    const client = createClient();
    const heartRate = await client.activities.listActivityHeartRateCurves({
      oldest: "2000-01-01",
      newest: "2000-01-31",
      secs: [60, 300],
    });
    const pace = await client.activities.listActivityPaceCurves({
      oldest: "2000-01-01",
      newest: "2000-01-31",
      type: "Run",
      distances: [1000, 5000],
      gap: false,
    });
    const power = await client.activities.listActivityPowerCurves({
      oldest: "2000-01-01",
      newest: "2000-01-31",
      type: "Ride",
      fatigue: "kj0",
      secs: [5, 60, 300],
    });

    expect(heartRate.ok && heartRate.value.curves[0].startDateLocal).toContain("2000-01-01");
    expect(pace.ok && pace.value.distances).toEqual([1000, 5000]);
    expect(pace.ok && pace.value.curves[0].secs).toEqual([220, 1200]);
    expect(power.ok && power.value.afterKj).toBe(0);
    expect(
      observedUrls.get("/api/v1/athlete/:id/activity-hr-curves")?.searchParams.get("secs"),
    ).toBe("60,300");
    expect(
      observedUrls.get("/api/v1/athlete/:id/activity-pace-curves")?.searchParams.get("distances"),
    ).toBe("1000,5000");
    expect(
      observedUrls.get("/api/v1/athlete/:id/activity-power-curves")?.searchParams.get("secs"),
    ).toBe("5,60,300");
  });

  it("preserves opaque map keys in athlete curve sets", async () => {
    const client = createClient();
    const heartRate = await client.activities.listAthleteHeartRateCurves({
      curves: ["42d"],
      filters: [{ fieldId: "indoor", operator: "eq", value: true }],
      f1: [{ fieldId: "type", value: ["Ride"] }],
    });
    const pace = await client.activities.listAthletePaceCurves({
      type: "Run",
      curves: ["42d"],
      pmType: "CS",
    });
    const power = await client.activities.listAthletePowerCurves({
      type: "Ride",
      curves: ["42d-kj0"],
      includeRanks: true,
      pmType: "MS_2P",
    });

    for (const result of [heartRate, pace, power]) {
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.activities).toBeInstanceOf(Map);
      expect(result.value.activities.has("opaque_activity_key")).toBe(true);
      expect(result.value.list[0].activityId).toEqual(["synthetic-activity", "synthetic-activity"]);
      const filter = result.value.list[0].filters?.[0];
      expect(filter?.fieldId).toBe("custom");
      expect(filter?.value).toBeInstanceOf(Map);
      if (!(filter?.value instanceof Map)) {
        throw new Error("Expected a map-backed filter value");
      }
      expect(filter.value.has("opaque_filter_key")).toBe(true);
    }
    expect(pace.ok && pace.value.list[0].paceModels?.[0].criticalSpeed).toBe(4.2);
    expect(power.ok && power.value.list[0].wattsPerKg?.[0]).toBe(5.3);
    expect(power.ok && power.value.list[0].values[0]).toBe(400);
    expect(power.ok && power.value.list[0].powerModels?.[0].criticalPower).toBe(285);
    expect(power.ok && power.value.list[0].ranks).toBeInstanceOf(Map);
    if (power.ok) {
      const rank = power.value.list[0].ranks?.get("synthetic_rank_key");
      expect(rank?.position).toBeInstanceOf(Map);
      expect(rank?.position?.get("opaque_group_key")).toBe(1);
    }
    expect(power.ok && power.value.list[0].mapPlot?.minBpm).toBe(120);
    expectTypeOf<AthleteHeartRateCurveSet["list"][number]>().toEqualTypeOf<HeartRateCurve>();
    expectTypeOf<AthletePaceCurveSet["list"][number]>().toEqualTypeOf<PaceCurve>();
    expectTypeOf<AthletePowerCurveSet["list"][number]>().toEqualTypeOf<AthletePowerCurve>();
    expectTypeOf<AthletePowerCurveSet["activities"]>().toEqualTypeOf<
      ReadonlyMap<string, AthleteCurveActivity>
    >();
    expectTypeOf(power).toMatchTypeOf<{ ok: true; value: AthletePowerCurveSet } | { ok: false }>();

    const heartRateUrl = observedUrls.get("/api/v1/athlete/:id/hr-curves");
    expect(heartRateUrl?.searchParams.get("curves")).toBe("42d");
    expect(JSON.parse(heartRateUrl?.searchParams.get("filters") ?? "null")).toEqual([
      { field_id: "indoor", operator: "eq", value: true },
    ]);
    expect(JSON.parse(heartRateUrl?.searchParams.get("f1") ?? "null")).toEqual([
      { field_id: "type", value: ["Ride"] },
    ]);
    expect(heartRateUrl?.searchParams.has("f2")).toBe(false);
    expect(heartRateUrl?.searchParams.has("f3")).toBe(false);
  });

  it("accepts the compact live curve activity summary when type is omitted", async () => {
    server.use(
      jsonHandler("/api/v1/athlete/:id/power-curves", {
        ...fixture.athletePowerCurveSet,
        activities: {
          synthetic_key: {
            id: "synthetic-activity",
            start_date_local: "2000-01-01T00:00:00",
            name: "Synthetic activity",
            distance: 40_000,
            moving_time: 3_600,
            training_load: 42,
            icu_weight: 75,
            race: false,
          },
        },
      }),
    );

    const result = await createClient().activities.listAthletePowerCurves({
      type: "Ride",
      curves: ["42d"],
    });
    server.resetHandlers();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.activities.get("synthetic_key")).toEqual({
      id: "synthetic-activity",
      startDateLocal: "2000-01-01T00:00:00",
      name: "Synthetic activity",
      distance: 40_000,
      movingTime: 3_600,
      trainingLoad: 42,
      icuWeight: 75,
      race: false,
    });
    expect(result.value.activities.get("synthetic_key")?.type).toBeUndefined();
  });

  it("returns the mixed-wire-case athlete power/heart-rate payload in camelCase", async () => {
    const result = await createClient().activities.getAthletePowerHeartRateCurve({
      start: "2000-01-01",
      end: "2000-01-31",
      type: "Ride",
      filters: [{ fieldId: "indoor", operator: "eq", value: {} }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.athleteId).toBe("synthetic-athlete");
      expect(result.value.maxHr).toBe(190);
      expect(result.value.minutes).toEqual([10, 20, 30]);
    }
    const serializedFilter = observedUrls
      .get("/api/v1/athlete/:id/power-hr-curve")
      ?.searchParams.get("filters");
    expect(serializedFilter && JSON.parse(serializedFilter)).toEqual([
      { field_id: "indoor", operator: "eq", value: {} },
    ]);
  });

  it("keeps the old powerCurves resource as a corrected deprecated delegate", async () => {
    const result = await createClient().powerCurves.get({
      type: "Ride",
      filters: [{ field_id: "indoor", operator: "eq", value: {} }],
      f1: [{ field_id: "type", value: {} }],
      f2: [],
      f3: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.activities.has("opaque_activity_key")).toBe(true);
    const url = observedUrls.get("/api/v1/athlete/:id/power-curves");
    expect(JSON.parse(url?.searchParams.get("filters") ?? "null")).toEqual([
      { field_id: "indoor", operator: "eq", value: {} },
    ]);
    expect(JSON.parse(url?.searchParams.get("f1") ?? "null")).toEqual([
      { field_id: "type", value: {} },
    ]);
    expect(url?.searchParams.get("f2")).toBe("[]");
    expect(url?.searchParams.get("f3")).toBe("[]");
  });

  it("rejects canonical and wire filter alias collisions", async () => {
    const conflictingFilter = {
      fieldId: "indoor",
      field_id: "type",
    } as unknown as ActivityFilterInput;

    const result = await createClient().powerCurves.get({
      type: "Ride",
      filters: [conflictingFilter],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "Validation",
      issues: [
        {
          path: "query.filters.0.fieldId",
          message: 'Request keys "fieldId" and "field_id" both map to wire key "field_id"',
          expected: "one request alias per field",
          received: ["fieldId", "field_id"],
        },
      ],
    });
  });
});
