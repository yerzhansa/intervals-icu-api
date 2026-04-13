import * as v from "valibot";
import { decode } from "../decode.js";

export const WellnessSchema = v.looseObject({
  id: v.string(),
  ctl: v.nullish(v.number()),
  atl: v.nullish(v.number()),
  rampRate: v.nullish(v.number()),
  ctlLoad: v.nullish(v.number()),
  atlLoad: v.nullish(v.number()),
  weight: v.nullish(v.number()),
  restingHR: v.nullish(v.number()),
  hrv: v.nullish(v.number()),
  hrvSDNN: v.nullish(v.number()),
  sleepSecs: v.nullish(v.number()),
  sleepScore: v.nullish(v.number()),
  sleepQuality: v.nullish(v.number()),
  avgSleepingHR: v.nullish(v.number()),
  soreness: v.nullish(v.number()),
  fatigue: v.nullish(v.number()),
  stress: v.nullish(v.number()),
  mood: v.nullish(v.number()),
  motivation: v.nullish(v.number()),
  injury: v.nullish(v.number()),
  kcalConsumed: v.nullish(v.number()),
  menstrualPhase: v.nullish(v.string()),
  menstrualPhasePredicted: v.nullish(v.string()),
  sportInfo: v.nullish(v.array(v.unknown())),
  updated: v.nullish(v.string()),
});

export type WellnessRecord = v.InferOutput<typeof WellnessSchema>;

export const decodeWellness = (data: unknown) => decode(WellnessSchema, data);
