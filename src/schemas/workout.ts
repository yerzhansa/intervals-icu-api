import * as v from "valibot";

export const WorkoutSchema = v.looseObject({
  id: v.number(),
  athlete_id: v.nullish(v.string()),
  name: v.nullish(v.string()),
  description: v.nullish(v.string()),
  type: v.nullish(v.string()),
  indoor: v.nullish(v.boolean()),
  moving_time: v.nullish(v.number()),
  icu_training_load: v.nullish(v.number()),
  workout_doc: v.nullish(v.unknown()),
  folder_id: v.nullish(v.number()),
  created: v.nullish(v.string()),
  updated: v.nullish(v.string()),
});

export type Workout = v.InferOutput<typeof WorkoutSchema>;
