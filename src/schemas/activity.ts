import * as v from "valibot";
import { decode, decodeArray } from "../decode.js";

export const ActivitySchema = v.looseObject({
  id: v.union([v.string(), v.number()]),
  start_date_local: v.string(),
  type: v.string(),
  name: v.nullish(v.string()),
  description: v.nullish(v.string()),
  distance: v.nullish(v.number()),
  moving_time: v.nullish(v.number()),
  elapsed_time: v.nullish(v.number()),
  icu_training_load: v.nullish(v.number()),
  icu_intensity: v.nullish(v.number()),
  icu_ftp: v.nullish(v.number()),
  icu_weighted_avg_watts: v.nullish(v.number()),
  icu_average_watts: v.nullish(v.number()),
  average_heartrate: v.nullish(v.number()),
  max_heartrate: v.nullish(v.number()),
  average_cadence: v.nullish(v.number()),
  calories: v.nullish(v.number()),
  average_speed: v.nullish(v.number()),
  max_speed: v.nullish(v.number()),
  total_elevation_gain: v.nullish(v.number()),
  source: v.nullish(v.string()),
  trainer: v.nullish(v.boolean()),
  group: v.nullish(v.string()),
  icu_zone_times: v.nullish(
    v.array(v.union([v.number(), v.looseObject({ id: v.nullish(v.string()), secs: v.nullish(v.number()) })]))
  ),
});

export type Activity = v.InferOutput<typeof ActivitySchema>;

export const decodeActivity = (data: unknown) => decode(ActivitySchema, data);
export const decodeActivities = (data: unknown) => decodeArray(ActivitySchema, data);
