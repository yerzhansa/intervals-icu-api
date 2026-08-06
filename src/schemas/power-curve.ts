import * as v from "valibot";
import type { CamelCaseKeys } from "../transform.js";

export const PowerCurveSchema = v.looseObject({
  secs: v.array(v.number()),
  watts: v.array(v.nullish(v.number())),
});

/** Validated Intervals.icu response before convenience response key transformation. */
export type PowerCurveWire = v.InferOutput<typeof PowerCurveSchema>;

/** Power curve returned by managed convenience resources. */
export type PowerCurve = CamelCaseKeys<PowerCurveWire>;
