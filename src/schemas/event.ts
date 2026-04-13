import * as v from "valibot";
import { decode, decodeArray } from "../decode.js";

export const EventSchema = v.looseObject({
  id: v.number(),
  start_date_local: v.string(),
  icu_training_load: v.nullish(v.number()),
  moving_time: v.nullish(v.number()),
  category: v.string(),
  name: v.nullish(v.string()),
  type: v.nullish(v.string()),
  description: v.nullish(v.string()),
  not_on_fitness_chart: v.nullish(v.boolean()),
  indoor: v.nullish(v.boolean()),
  color: v.nullish(v.string()),
  uid: v.nullish(v.string()),
  workout_doc: v.nullish(v.unknown()),
  hide_from_athlete: v.nullish(v.boolean()),
});

export type Event = v.InferOutput<typeof EventSchema>;

export const decodeEvent = (data: unknown) => decode(EventSchema, data);
export const decodeEvents = (data: unknown) => decodeArray(EventSchema, data);
