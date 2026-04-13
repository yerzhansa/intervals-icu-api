import * as v from "valibot";
import { decode } from "../decode.js";

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

export type Athlete = v.InferOutput<typeof AthleteSchema>;

export const decodeAthlete = (data: unknown) => decode(AthleteSchema, data);
