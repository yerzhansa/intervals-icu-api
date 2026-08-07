import { describe, expect, expectTypeOf, it } from "vitest";
import { decodeActivity, type Activity, type ActivityWire } from "../src/schemas/activity.js";
import type { Athlete, AthleteWire } from "../src/schemas/athlete.js";
import type { Event, EventWire } from "../src/schemas/event.js";
import type { PowerCurve, PowerCurveWire } from "../src/schemas/power-curve.js";
import type { WellnessRecord, WellnessRecordWire } from "../src/schemas/wellness.js";
import type { Workout, WorkoutWire } from "../src/schemas/workout.js";
import { camelCaseKeys, type CamelCaseKeys } from "../src/transform.js";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;
type Expect<T extends true> = T;

type PublicResponseAliases = [
  Expect<Equal<Activity, CamelCaseKeys<ActivityWire>>>,
  Expect<Equal<Athlete, CamelCaseKeys<AthleteWire>>>,
  Expect<Equal<Event, CamelCaseKeys<EventWire>>>,
  Expect<Equal<PowerCurve, CamelCaseKeys<PowerCurveWire>>>,
  Expect<Equal<WellnessRecord, CamelCaseKeys<WellnessRecordWire>>>,
  Expect<Equal<Workout, CamelCaseKeys<WorkoutWire>>>,
];

describe("response schema types", () => {
  it("maps wire keys to the same camelCase shape returned at runtime", () => {
    const wire: ActivityWire = {
      id: "activity",
      start_date_local: "2026-01-01T00:00:00",
      type: "Run",
      icu_training_load: 42,
      icu_zone_times: [{ id: "Z2", secs: 1_800 }],
    };

    const response: Activity = camelCaseKeys(wire);

    expect(response).toMatchObject({
      id: "activity",
      startDateLocal: "2026-01-01T00:00:00",
      icuTrainingLoad: 42,
      icuZoneTimes: [{ id: "Z2", secs: 1_800 }],
    });
    expectTypeOf(response.startDateLocal).toEqualTypeOf<string>();
    expectTypeOf(response.icuTrainingLoad).toEqualTypeOf<number | null | undefined>();
    expectTypeOf<PublicResponseAliases>().toMatchTypeOf<readonly true[]>();
  });

  it("keeps standalone decoder output in wire casing", () => {
    const decoded = decodeActivity({
      id: "activity",
      start_date_local: "2026-01-01T00:00:00",
      type: "Run",
      moving_time: 1_800,
    });

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    expect(decoded.value).toMatchObject({
      start_date_local: "2026-01-01T00:00:00",
      moving_time: 1_800,
    });
    expect(decoded.value).not.toHaveProperty("startDateLocal");
    expectTypeOf(decoded.value).toEqualTypeOf<ActivityWire>();
  });
});
