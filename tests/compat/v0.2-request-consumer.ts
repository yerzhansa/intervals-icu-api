import { IntervalsClient, type WireOperations } from "intervals-icu-api";

const client = new IntervalsClient({
  apiKey: "synthetic-key",
  athleteId: "synthetic-athlete",
  retry: { maxAttempts: 1 },
});

async function consumeWireRequestCompatibility(): Promise<void> {
  const powerCurvesQuery: WireOperations["listAthletePowerCurves"]["parameters"]["query"] = {
    type: "Ride",
    filters: [{ field_id: "indoor", operator: "eq", value: {} }],
    f1: [{ field_id: "type", value: {} }],
    f2: [],
    f3: [],
  };
  await client.powerCurves.get(powerCurvesQuery);

  await client.athlete.update({
    activity_rpe_prompt: true,
    applyToAll: true,
  });

  await client.events.create({
    start_date_local: "2026-08-07T06:00:00",
    icu_training_load: 42,
    category: "WORKOUT",
    name: "Synthetic event",
    workout_doc: { blocks_v2: {} },
  });

  await client.events.update(123, {
    start_date_local: "2026-08-08T06:00:00",
    category: "WORKOUT",
    name: "Updated synthetic event",
  });

  await client.wellness.update({
    avgSleepingHR: 48,
    hrvSDNN: 52,
    spO2: 98,
  });

  await client.wellness.updateBulk([
    { id: "2026-08-07", restingHR: 48 },
    { id: "2026-08-08", restingHR: 47 },
  ]);

  await client.workouts.create({
    file_contents_base64: "c3ludGhldGlj",
    icu_training_load: 42,
    workout_doc: { steps_v2: {} },
  });
}

void consumeWireRequestCompatibility;
