import * as v from "valibot";
import { decode } from "../decode.js";
import type { CamelCaseKeys } from "../transform.js";

export const AthleteSchema = v.looseObject({
  id: v.union([v.string(), v.number()]),
  name: v.nullish(v.string()),
  email: v.nullish(v.string()),
  city: v.nullish(v.string()),
  country: v.nullish(v.string()),
  sex: v.nullish(v.string()),
  weight: v.nullish(v.number()),
  icu_ftp: v.nullish(v.number()),
  icu_resting_hr: v.nullish(v.number()),
  icu_max_hr: v.nullish(v.number()),
  icu_lthr: v.nullish(v.number()),
  icu_date_of_birth: v.nullish(v.string()),
  locale: v.nullish(v.string()),
  timezone: v.nullish(v.string()),
});

/** Validated Intervals.icu response before convenience response key transformation. */
export type AthleteWire = v.InferOutput<typeof AthleteSchema>;

/** Athlete returned by managed convenience resources. */
export type Athlete = CamelCaseKeys<AthleteWire>;

export const decodeAthlete = (data: unknown) => decode(AthleteSchema, data);
