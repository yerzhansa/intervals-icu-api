import {
  IntervalsClient,
  type AthleteUpdate,
  type AthleteUpdateWire,
  type AthleteHeartRateCurveSetWire,
  type AthletePaceCurveSetWire,
  type AthletePowerCurveWire,
  type AthletePowerCurveSetWire,
  type ActivityFilterWire,
  type CamelCaseKeys,
  type EventInput,
  type EventInputWire,
  type PowerCurve,
  type PowerCurveWire,
  type Rank,
  type RankWire,
  type SnakeCaseKeys,
  type WellnessUpdate,
  type WorkoutInput,
  type WorkoutInputWire,
} from "intervals-icu-api";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

interface NamedWireValue {
  readonly start_date_local: string;
  nested_value?: {
    inner_key: number;
  };
}

interface NamedCanonicalValue {
  readonly startDateLocal: string;
  nestedValue?: {
    innerKey: number;
  };
}

type CanonicalRequestKeys = [
  Expect<Equal<"activityRpePrompt" extends keyof AthleteUpdate ? true : false, true>>,
  Expect<Equal<"activity_rpe_prompt" extends keyof AthleteUpdate ? true : false, false>>,
  Expect<Equal<"activity_rpe_prompt" extends keyof AthleteUpdateWire ? true : false, true>>,
  Expect<Equal<"startDateLocal" extends keyof EventInput ? true : false, true>>,
  Expect<Equal<"start_date_local" extends keyof EventInput ? true : false, false>>,
  Expect<Equal<"start_date_local" extends keyof EventInputWire ? true : false, true>>,
  Expect<Equal<"fileContentsBase64" extends keyof WorkoutInput ? true : false, true>>,
  Expect<Equal<"file_contents_base64" extends keyof WorkoutInput ? true : false, false>>,
  Expect<Equal<"file_contents_base64" extends keyof WorkoutInputWire ? true : false, true>>,
  Expect<Equal<CamelCaseKeys<NamedWireValue>, NamedCanonicalValue>>,
  Expect<Equal<SnakeCaseKeys<NamedCanonicalValue>, NamedWireValue>>,
  Expect<Equal<CamelCaseKeys<readonly [{ item_id: 1 }]>, readonly [{ itemId: 1 }]>>,
  Expect<Equal<CamelCaseKeys<Date>, Date>>,
  Expect<
    Equal<CamelCaseKeys<Map<string, { value_key: number }>>, Map<string, { value_key: number }>>
  >,
  Expect<Equal<SnakeCaseKeys<Set<{ valueKey: number }>>, Set<{ valueKey: number }>>>,
  Expect<Equal<CamelCaseKeys<(value_key: string) => number>, (value_key: string) => number>>,
];

const client = new IntervalsClient({
  apiKey: "synthetic-key",
  athleteId: "synthetic-athlete",
});

const athlete: AthleteUpdate = { activityRpePrompt: true, applyToAll: true };
const event: EventInput = {
  startDateLocal: "2026-08-07T06:00:00",
  icuTrainingLoad: 42,
  workoutDoc: { blocks_v2: {} },
};
const wellness: WellnessUpdate = { avgSleepingHR: 48, hrvSDNN: 52, spO2: 98 };
const workout: WorkoutInput = {
  fileContentsBase64: "c3ludGhldGlj",
  icuTrainingLoad: 42,
  workoutDoc: { steps_v2: {} },
};
const wireActivity = {
  id: "synthetic-activity",
  start_date_local: "2000-01-01T00:00:00",
};
const heartRateCurveSetWire: AthleteHeartRateCurveSetWire = {
  activities: { "synthetic-activity": wireActivity },
  list: [{ secs: [60], values: [150], activity_id: ["synthetic-activity"] }],
};
const paceCurveSetWire: AthletePaceCurveSetWire = {
  activities: { "synthetic-activity": wireActivity },
  list: [{ distance: [1000], values: [220], paceModels: [] }],
};
const activityFilterWire: ActivityFilterWire = {
  field_id: "custom",
  value: { opaque_filter_key: "synthetic-value" },
};
const rankWire: RankWire = {
  position: { opaque_group_key: 1 },
  watts: { opaque_group_key: 300 },
};
const powerCurveWire: PowerCurveWire = {
  secs: [60],
  watts: [400],
  filters: [activityFilterWire],
  ranks: { opaque_rank_key: rankWire },
};
const athletePowerCurveWire: AthletePowerCurveWire = {
  secs: [60],
  values: [400],
  filters: [activityFilterWire],
  ranks: { opaque_rank_key: rankWire },
};
const powerCurveSetWire: AthletePowerCurveSetWire = {
  activities: { "synthetic-activity": wireActivity },
  list: [athletePowerCurveWire],
};
const managedRank: Rank = {
  position: new Map([["opaque_group_key", 1]]),
  watts: new Map([["opaque_group_key", 300]]),
};
const managedPowerCurve: PowerCurve = {
  secs: [60],
  watts: [400],
  ranks: new Map([["opaque_rank_key", managedRank]]),
};

void client.athlete.update(athlete);
void client.events.create(event);
void client.wellness.update(wellness);
void client.workouts.create(workout);
void heartRateCurveSetWire;
void paceCurveSetWire;
void powerCurveWire;
void powerCurveSetWire;
void managedPowerCurve;
void (null as unknown as CanonicalRequestKeys);
