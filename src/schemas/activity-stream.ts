import * as v from "valibot";
import type { CamelCaseKeys } from "../transform.js";

/**
 * Stream names documented by Intervals.icu. This list is intentionally open:
 * custom and future stream names are valid too.
 */
export const KNOWN_ACTIVITY_STREAM_TYPES = [
  "time",
  "watts",
  "cadence",
  "heartrate",
  "distance",
  "altitude",
  "latlng",
  "velocity_smooth",
  "moving",
  "grade_smooth",
  "temp",
  "torque",
  "raw_watts",
  "fixed_watts",
  "fixed_heartrate",
  "left_right_balance",
  "left_pedal_smoothness",
  "right_pedal_smoothness",
  "left_torque_effectiveness",
  "right_torque_effectiveness",
  "smo2",
  "thb",
  "smo2_2",
  "thb_2",
  "dfa_a1",
  "epoc",
  "hrv",
  "ga_velocity",
  "fixed_altitude",
  "corrupt_time",
  "core_temperature",
  "skin_temperature",
  "stride_length",
  "w_bal",
  "respiration",
  "tidal_volume",
  "tidal_volume_min",
  "watts_alt",
  "watts_alt_acc",
  "bloodglucose",
  "artifacts",
] as const;

export type KnownActivityStreamType = (typeof KNOWN_ACTIVITY_STREAM_TYPES)[number];

/** Known names retain editor completion while arbitrary/custom names stay valid. */
export type ActivityStreamType = KnownActivityStreamType | (string & {});

export interface ActivityStreamAnomalyWire {
  start_index?: number;
  end_index?: number;
  value?: number;
  valueEnd?: number | null;
  [key: string]: unknown;
}

export type ActivityStreamAnomaly = CamelCaseKeys<ActivityStreamAnomalyWire>;

export interface ActivityStreamWire<T = unknown> {
  type: string;
  name?: string | null;
  data: T[];
  data2?: T[] | null;
  valueType?: string | null;
  valueTypeIsArray?: boolean;
  anomalies?: ActivityStreamAnomalyWire[] | null;
  custom?: boolean;
  allNull?: boolean;
  [key: string]: unknown;
}

export type ActivityStream<T = unknown> = CamelCaseKeys<ActivityStreamWire<T>>;

export interface GetStreamsOptions {
  types?: readonly ActivityStreamType[];
  includeDefaults?: boolean;
}

export const ActivityStreamAnomalySchema = v.looseObject({
  start_index: v.optional(v.number()),
  end_index: v.optional(v.number()),
  value: v.optional(v.number()),
  valueEnd: v.optional(v.nullable(v.number())),
});

/** Runtime overlay for the official schema, which incorrectly models data arrays as objects. */
export const ActivityStreamSchema: v.GenericSchema<unknown, ActivityStreamWire> = v.looseObject({
  type: v.string(),
  name: v.optional(v.nullable(v.string())),
  data: v.array(v.unknown()),
  data2: v.optional(v.nullable(v.array(v.unknown()))),
  valueType: v.optional(v.nullable(v.string())),
  valueTypeIsArray: v.optional(v.boolean()),
  anomalies: v.optional(v.nullable(v.array(ActivityStreamAnomalySchema))),
  custom: v.optional(v.boolean()),
  allNull: v.optional(v.boolean()),
});
