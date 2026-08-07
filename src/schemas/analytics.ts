import * as v from "valibot";
import { camelCaseKeys, type CamelCaseKeys } from "../transform.js";
import { ActivitySchema, type Activity } from "./activity.js";

const NullableNumberArraySchema = v.array(v.nullable(v.number()));
const OptionalNumber = v.nullish(v.number());
const OptionalString = v.nullish(v.string());

function toOpaqueValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toOpaqueValue);
  if (value !== null && typeof value === "object") {
    return new Map(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        toOpaqueValue(item),
      ]),
    );
  }
  return value;
}

const OpaqueValueSchema = v.pipe(v.unknown(), v.transform(toOpaqueValue));

export const ActivityFilterSchema = v.looseObject({
  code: OptionalString,
  field_id: OptionalString,
  id: OptionalNumber,
  not: v.nullish(v.boolean()),
  operator: OptionalString,
  value: v.optional(OpaqueValueSchema),
});

export type ActivityFilterWire = v.InferInput<typeof ActivityFilterSchema>;
type ActivityFilterDecoded = v.InferOutput<typeof ActivityFilterSchema>;
export type ActivityFilter = Omit<CamelCaseKeys<ActivityFilterDecoded>, "value"> & {
  value?: unknown;
};

export const EffortSchema = v.looseObject({
  average: OptionalNumber,
  distance: OptionalNumber,
  duration: OptionalNumber,
  end_index: OptionalNumber,
  start_index: OptionalNumber,
});

export const BestEffortsSchema = v.looseObject({
  efforts: v.array(EffortSchema),
});

export const HistogramBucketSchema = v.looseObject({
  cadence: OptionalNumber,
  hr: OptionalNumber,
  max: OptionalNumber,
  min: OptionalNumber,
  movingSecs: OptionalNumber,
  secs: OptionalNumber,
  start: OptionalNumber,
  watts: OptionalNumber,
});

export const CurveFitSchema = v.looseObject({
  coefficients: v.nullish(NullableNumberArraySchema),
  id: OptionalString,
  r2: OptionalNumber,
});

export const PlotSchema = v.looseObject({
  cumulative_secs: v.nullish(NullableNumberArraySchema),
  max_bpm: OptionalNumber,
  min_bpm: OptionalNumber,
  secs: v.nullish(NullableNumberArraySchema),
});

export const PaceModelSchema = v.looseObject({
  criticalSpeed: OptionalNumber,
  dPrime: OptionalNumber,
  inputPointIndexes: v.nullish(NullableNumberArraySchema),
  r2: OptionalNumber,
  type: v.nullish(v.literal("CS")),
});

export const PowerModelSchema = v.looseObject({
  criticalPower: OptionalNumber,
  ftp: OptionalNumber,
  inputPointIndexes: v.nullish(NullableNumberArraySchema),
  pMax: OptionalNumber,
  type: v.nullish(v.picklist(["MS_2P", "MORTON_3P", "FFT_CURVES", "ECP"])),
  wPrime: OptionalNumber,
});

const NumericMapSchema = v.pipe(
  v.record(v.string(), v.number()),
  v.transform((record) => new Map(Object.entries(record))),
);

export const RankSchema = v.looseObject({
  position: v.nullish(NumericMapSchema),
  watts: v.nullish(NumericMapSchema),
});

const RankMapSchema = v.pipe(
  v.record(v.string(), RankSchema),
  v.transform((record) => new Map(Object.entries(record))),
);

const CurveMetadataSchema = {
  activity_id: v.nullish(v.array(v.string())),
  days: OptionalNumber,
  end_date_local: OptionalString,
  end_index: v.nullish(NullableNumberArraySchema),
  filter_label: OptionalString,
  filters: v.nullish(v.array(ActivityFilterSchema)),
  id: OptionalString,
  label: OptionalString,
  moving_time: OptionalNumber,
  percentile: OptionalNumber,
  start_date_local: OptionalString,
  start_index: v.nullish(NullableNumberArraySchema),
  submax_activity_id: v.nullish(v.array(v.array(v.string()))),
  submax_values: v.nullish(v.array(NullableNumberArraySchema)),
  training_load: OptionalNumber,
  weight: OptionalNumber,
} as const;

export const HeartRateCurveSchema = v.looseObject({
  ...CurveMetadataSchema,
  secs: v.array(v.number()),
  values: NullableNumberArraySchema,
});

export const PaceCurveSchema = v.looseObject({
  ...CurveMetadataSchema,
  distance: v.array(v.number()),
  paceModels: v.nullish(v.array(PaceModelSchema)),
  type: v.nullish(v.picklist(["POWER", "HR", "PACE", "GAP"])),
  values: NullableNumberArraySchema,
});

const PowerCurveFields = {
  ...CurveMetadataSchema,
  after_kj: OptionalNumber,
  compound_score_5m: OptionalNumber,
  mapPlot: v.nullish(PlotSchema),
  powerModels: v.nullish(v.array(PowerModelSchema)),
  ranks: v.nullish(RankMapSchema),
  secs: v.array(v.number()),
  stream_name: OptionalString,
  stream_type: OptionalString,
  submax_watts_per_kg: v.nullish(v.array(NullableNumberArraySchema)),
  submax_wkg_activity_id: v.nullish(v.array(v.array(v.string()))),
  vo2max_5m: OptionalNumber,
  watts_per_kg: v.nullish(NullableNumberArraySchema),
  wkg_activity_id: v.nullish(v.array(v.string())),
} as const;

/** Per-activity power-curve shape, retaining the 0.2 `secs` + `watts` contract. */
export const PowerCurveSchema = v.looseObject({
  ...PowerCurveFields,
  values: v.nullish(NullableNumberArraySchema),
  watts: NullableNumberArraySchema,
});

/** Athlete best-power-curve shape returned inside the athlete curve-set payload. */
export const AthletePowerCurveSchema = v.looseObject({
  ...PowerCurveFields,
  values: NullableNumberArraySchema,
  watts: v.nullish(NullableNumberArraySchema),
});

export const PowerVsHeartRatePlotSchema = v.looseObject({
  avgCadenceZ2: OptionalNumber,
  bucketSize: OptionalNumber,
  cooldown: OptionalNumber,
  curves: v.nullish(v.array(CurveFitSchema)),
  decoupling: OptionalNumber,
  elapsedTime: OptionalNumber,
  end: OptionalNumber,
  hrLag: OptionalNumber,
  hrZ2BucketCount: OptionalNumber,
  medianCadenceZ2: OptionalNumber,
  mid: OptionalNumber,
  powerHr: OptionalNumber,
  powerHrFirst: OptionalNumber,
  powerHrSecond: OptionalNumber,
  powerHrZ2: OptionalNumber,
  ratioCoefficients: v.nullish(NullableNumberArraySchema),
  series: v.array(HistogramBucketSchema),
  start: OptionalNumber,
  warmup: OptionalNumber,
});

export const ActivityHeartRateCurveSchema = v.looseObject({
  bpm: NullableNumberArraySchema,
  id: OptionalString,
  start_date_local: OptionalString,
  weight: OptionalNumber,
});

export const ActivityHeartRateCurvePayloadSchema = v.looseObject({
  curves: v.array(ActivityHeartRateCurveSchema),
  secs: v.array(v.number()),
});

export const ActivityPaceCurveSchema = v.looseObject({
  id: OptionalString,
  secs: NullableNumberArraySchema,
  start_date_local: OptionalString,
  weight: OptionalNumber,
});

export const ActivityPaceCurvePayloadSchema = v.looseObject({
  curves: v.array(ActivityPaceCurveSchema),
  distances: v.array(v.number()),
  gap: v.boolean(),
});

export const ActivityPowerCurveSchema = v.looseObject({
  id: OptionalString,
  start_date_local: OptionalString,
  watts: NullableNumberArraySchema,
  weight: OptionalNumber,
});

export const ActivityPowerCurvePayloadSchema = v.looseObject({
  after_kj: OptionalNumber,
  curves: v.array(ActivityPowerCurveSchema),
  secs: v.array(v.number()),
});

export const DataCurveSchema = v.looseObject({
  ...CurveMetadataSchema,
  after_kj: OptionalNumber,
  distance: v.nullish(NullableNumberArraySchema),
  secs: v.nullish(NullableNumberArraySchema),
  values: v.nullish(NullableNumberArraySchema),
});

const ActivityMapSchema = v.pipe(
  v.record(v.string(), ActivitySchema),
  v.transform(
    (record) =>
      new Map(
        Object.entries(record).map(([activityId, activity]) => [
          activityId,
          camelCaseKeys(activity),
        ]),
      ),
  ),
);

export const AthleteHeartRateCurveSetSchema = v.looseObject({
  activities: ActivityMapSchema,
  list: v.array(HeartRateCurveSchema),
});

export const AthletePaceCurveSetSchema = v.looseObject({
  activities: ActivityMapSchema,
  list: v.array(PaceCurveSchema),
});

export const AthletePowerCurveSetSchema = v.looseObject({
  activities: ActivityMapSchema,
  list: v.array(AthletePowerCurveSchema),
});

/** Validated JSON shape before response key transformation and map normalization. */
export type AthleteHeartRateCurveSetWire = v.InferInput<typeof AthleteHeartRateCurveSetSchema>;
/** Validated JSON shape before response key transformation and map normalization. */
export type AthletePaceCurveSetWire = v.InferInput<typeof AthletePaceCurveSetSchema>;
/** Validated JSON shape before response key transformation and map normalization. */
export type AthletePowerCurveSetWire = v.InferInput<typeof AthletePowerCurveSetSchema>;

export const AthletePowerHeartRateCurveSchema = v.looseObject({
  athleteId: OptionalString,
  bpm: NullableNumberArraySchema,
  bucketSize: OptionalNumber,
  cadence: NullableNumberArraySchema,
  end: OptionalString,
  ftp: OptionalNumber,
  lthr: OptionalNumber,
  maxWatts: OptionalNumber,
  max_hr: OptionalNumber,
  minWatts: OptionalNumber,
  minutes: NullableNumberArraySchema,
  start: OptionalString,
});

export type EffortWire = v.InferInput<typeof EffortSchema>;
type EffortDecoded = v.InferOutput<typeof EffortSchema>;
export type Effort = CamelCaseKeys<EffortDecoded>;
export type BestEffortsWire = v.InferInput<typeof BestEffortsSchema>;
type BestEffortsDecoded = v.InferOutput<typeof BestEffortsSchema>;
export type BestEfforts = CamelCaseKeys<BestEffortsDecoded>;
export type HistogramBucketWire = v.InferInput<typeof HistogramBucketSchema>;
type HistogramBucketDecoded = v.InferOutput<typeof HistogramBucketSchema>;
export type HistogramBucket = CamelCaseKeys<HistogramBucketDecoded>;
export type CurveFitWire = v.InferInput<typeof CurveFitSchema>;
type CurveFitDecoded = v.InferOutput<typeof CurveFitSchema>;
export type CurveFit = CamelCaseKeys<CurveFitDecoded>;
export type PlotWire = v.InferInput<typeof PlotSchema>;
type PlotDecoded = v.InferOutput<typeof PlotSchema>;
export type Plot = CamelCaseKeys<PlotDecoded>;
export type PaceModelWire = v.InferInput<typeof PaceModelSchema>;
type PaceModelDecoded = v.InferOutput<typeof PaceModelSchema>;
export type PaceModel = CamelCaseKeys<PaceModelDecoded>;
export type PowerModelWire = v.InferInput<typeof PowerModelSchema>;
type PowerModelDecoded = v.InferOutput<typeof PowerModelSchema>;
export type PowerModel = CamelCaseKeys<PowerModelDecoded>;
export type RankWire = v.InferInput<typeof RankSchema>;
type RankDecoded = v.InferOutput<typeof RankSchema>;
export type Rank = CamelCaseKeys<RankDecoded>;
export type HeartRateCurveWire = v.InferInput<typeof HeartRateCurveSchema>;
type HeartRateCurveDecoded = v.InferOutput<typeof HeartRateCurveSchema>;
export type HeartRateCurve = CamelCaseKeys<HeartRateCurveDecoded>;
export type PaceCurveWire = v.InferInput<typeof PaceCurveSchema>;
type PaceCurveDecoded = v.InferOutput<typeof PaceCurveSchema>;
export type PaceCurve = CamelCaseKeys<PaceCurveDecoded>;
export type PowerCurveWire = v.InferInput<typeof PowerCurveSchema>;
type PowerCurveDecoded = v.InferOutput<typeof PowerCurveSchema>;
export type PowerCurve = CamelCaseKeys<PowerCurveDecoded>;
export type AthletePowerCurveWire = v.InferInput<typeof AthletePowerCurveSchema>;
type AthletePowerCurveDecoded = v.InferOutput<typeof AthletePowerCurveSchema>;
export type AthletePowerCurve = CamelCaseKeys<AthletePowerCurveDecoded>;
export type PowerVsHeartRatePlotWire = v.InferInput<typeof PowerVsHeartRatePlotSchema>;
type PowerVsHeartRatePlotDecoded = v.InferOutput<typeof PowerVsHeartRatePlotSchema>;
export type PowerVsHeartRatePlot = CamelCaseKeys<PowerVsHeartRatePlotDecoded>;
export type ActivityHeartRateCurvePayloadWire = v.InferInput<
  typeof ActivityHeartRateCurvePayloadSchema
>;
type ActivityHeartRateCurvePayloadDecoded = v.InferOutput<
  typeof ActivityHeartRateCurvePayloadSchema
>;
export type ActivityHeartRateCurvePayload = CamelCaseKeys<ActivityHeartRateCurvePayloadDecoded>;
export type ActivityHeartRateCurveWire = v.InferInput<typeof ActivityHeartRateCurveSchema>;
type ActivityHeartRateCurveDecoded = v.InferOutput<typeof ActivityHeartRateCurveSchema>;
export type ActivityHeartRateCurve = CamelCaseKeys<ActivityHeartRateCurveDecoded>;
export type ActivityPaceCurvePayloadWire = v.InferInput<typeof ActivityPaceCurvePayloadSchema>;
type ActivityPaceCurvePayloadDecoded = v.InferOutput<typeof ActivityPaceCurvePayloadSchema>;
export type ActivityPaceCurvePayload = CamelCaseKeys<ActivityPaceCurvePayloadDecoded>;
export type ActivityPaceCurveWire = v.InferInput<typeof ActivityPaceCurveSchema>;
type ActivityPaceCurveDecoded = v.InferOutput<typeof ActivityPaceCurveSchema>;
export type ActivityPaceCurve = CamelCaseKeys<ActivityPaceCurveDecoded>;
export type ActivityPowerCurvePayloadWire = v.InferInput<typeof ActivityPowerCurvePayloadSchema>;
type ActivityPowerCurvePayloadDecoded = v.InferOutput<typeof ActivityPowerCurvePayloadSchema>;
export type ActivityPowerCurvePayload = CamelCaseKeys<ActivityPowerCurvePayloadDecoded>;
export type ActivityPowerCurveWire = v.InferInput<typeof ActivityPowerCurveSchema>;
type ActivityPowerCurveDecoded = v.InferOutput<typeof ActivityPowerCurveSchema>;
export type ActivityPowerCurve = CamelCaseKeys<ActivityPowerCurveDecoded>;
export type DataCurveWire = v.InferInput<typeof DataCurveSchema>;
type DataCurveDecoded = v.InferOutput<typeof DataCurveSchema>;
export type DataCurve = CamelCaseKeys<DataCurveDecoded>;
export type AthletePowerHeartRateCurveWire = v.InferInput<typeof AthletePowerHeartRateCurveSchema>;
type AthletePowerHeartRateCurveDecoded = v.InferOutput<typeof AthletePowerHeartRateCurveSchema>;
export type AthletePowerHeartRateCurve = CamelCaseKeys<AthletePowerHeartRateCurveDecoded>;

export interface AthleteHeartRateCurveSet {
  activities: ReadonlyMap<string, Activity>;
  list: HeartRateCurve[];
  [key: string]: unknown;
}

export interface AthletePaceCurveSet {
  activities: ReadonlyMap<string, Activity>;
  list: PaceCurve[];
  [key: string]: unknown;
}

export interface AthletePowerCurveSet {
  activities: ReadonlyMap<string, Activity>;
  list: AthletePowerCurve[];
  [key: string]: unknown;
}
