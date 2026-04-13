import type { components } from "../generated/schema.js";
import type { Result } from "../result.js";
import { AthleteSchema, type Athlete } from "../schemas/athlete.js";
import { BaseResource } from "./base.js";

type AthleteUpdate = components["schemas"]["AthleteUpdateDTO"];

export class AthleteResource extends BaseResource {
  async get(): Promise<Result<Athlete>> {
    return this.http.requestJson("GET", "/athlete/{id}", () =>
      this.api.GET("/api/v1/athlete/{id}", {
        params: { path: { id: this.athleteId } },
      }),
      AthleteSchema,
    );
  }

  async getProfile(): Promise<Result<Athlete>> {
    return this.http.requestJson("GET", "/athlete/{id}/profile", () =>
      this.api.GET("/api/v1/athlete/{id}/profile", {
        params: { path: { id: this.athleteId } },
      }),
      AthleteSchema,
    );
  }

  async update(body: AthleteUpdate) {
    return this.http.requestJson("PUT", "/athlete/{id}", () =>
      this.api.PUT("/api/v1/athlete/{id}", {
        params: { path: { id: this.athleteId } },
        body,
      }),
    );
  }
}
