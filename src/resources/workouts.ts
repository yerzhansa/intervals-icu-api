import type { components } from "../generated/schema.js";
import type { Result } from "../result.js";
import { BaseResource } from "./base.js";

type WorkoutEx = components["schemas"]["WorkoutEx"];

export class WorkoutsResource extends BaseResource {
  async list() {
    return this.http.requestJson("GET", "/athlete/{id}/workouts", () =>
      this.api.GET("/api/v1/athlete/{id}/workouts", {
        params: { path: { id: this.athleteId } },
      }),
    );
  }

  async get(workoutId: number) {
    return this.http.requestJson("GET", "/athlete/{id}/workouts/{workoutId}", () =>
      this.api.GET("/api/v1/athlete/{id}/workouts/{workoutId}", {
        params: { path: { id: this.athleteId, workoutId } },
      }),
    );
  }

  async create(body: WorkoutEx) {
    return this.http.requestJson("POST", "/athlete/{id}/workouts", () =>
      this.api.POST("/api/v1/athlete/{id}/workouts", {
        params: { path: { id: this.athleteId } },
        body,
      }),
    );
  }

  async delete(workoutId: number) {
    return this.http.requestJson("DELETE", "/athlete/{id}/workouts/{workoutId}", () =>
      this.api.DELETE("/api/v1/athlete/{id}/workouts/{workoutId}", {
        params: { path: { id: this.athleteId, workoutId } },
      }),
    );
  }

  async downloadZip(): Promise<Result<ArrayBuffer>> {
    return this.http.requestBinary("GET", "/athlete/{id}/workouts.zip", `/api/v1/athlete/${this.athleteId}/workouts.zip`);
  }
}
