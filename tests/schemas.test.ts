import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { AthleteSchema } from "../src/schemas/athlete.js";
import { ActivitySchema } from "../src/schemas/activity.js";
import { WellnessSchema } from "../src/schemas/wellness.js";
import { EventSchema } from "../src/schemas/event.js";
import { WorkoutSchema } from "../src/schemas/workout.js";
import { PowerCurveSchema } from "../src/schemas/power-curve.js";
import athleteFixture from "./fixtures/athlete.json";
import activityFixture from "./fixtures/activity.json";
import wellnessFixture from "./fixtures/wellness.json";
import eventFixture from "./fixtures/event.json";
import powerCurveFixture from "./fixtures/power-curve.json";

describe("Schema validation", () => {
  it("validates athlete fixture", () => {
    const result = v.safeParse(AthleteSchema, athleteFixture);
    expect(result.success).toBe(true);
  });

  it("validates activity fixture", () => {
    const result = v.safeParse(ActivitySchema, activityFixture);
    expect(result.success).toBe(true);
  });

  it("validates wellness fixture", () => {
    const result = v.safeParse(WellnessSchema, wellnessFixture);
    expect(result.success).toBe(true);
  });

  it("validates event fixture", () => {
    const result = v.safeParse(EventSchema, eventFixture);
    expect(result.success).toBe(true);
  });

  it("validates power curve fixture", () => {
    const result = v.safeParse(PowerCurveSchema, powerCurveFixture);
    expect(result.success).toBe(true);
  });

  it("accepts unknown extra fields (forward compat)", () => {
    const data = { ...athleteFixture, brand_new_field_2028: "something" };
    const result = v.safeParse(AthleteSchema, data);
    expect(result.success).toBe(true);
  });

  it("handles null vs undefined (nullish)", () => {
    const data = { ...wellnessFixture, weight: null, hrv: undefined };
    const result = v.safeParse(WellnessSchema, data);
    expect(result.success).toBe(true);
  });

  it("rejects activity missing required id", () => {
    const { id, ...noId } = activityFixture;
    const result = v.safeParse(ActivitySchema, noId);
    expect(result.success).toBe(false);
  });

  it("validates workout schema", () => {
    const data = { id: 1, name: "Sweet Spot", type: "Ride", moving_time: 3600 };
    const result = v.safeParse(WorkoutSchema, data);
    expect(result.success).toBe(true);
  });
});
