import * as v from "valibot";

export const PowerCurveSchema = v.looseObject({
  secs: v.array(v.number()),
  watts: v.array(v.nullish(v.number())),
});

export type PowerCurve = v.InferOutput<typeof PowerCurveSchema>;
