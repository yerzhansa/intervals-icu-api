import type { components } from "../generated/schema.js";
import { encodeRequestBody } from "../request-casing.js";
import type { Result } from "../result.js";
import { AthleteSchema, type Athlete } from "../schemas/athlete.js";
import type { CamelCaseKeys } from "../transform.js";
import { BaseResource } from "./base.js";

/** @deprecated Prefer the canonical camelCase {@link AthleteUpdate}. */
export type AthleteUpdateWire = components["schemas"]["AthleteUpdateDTO"];

/** Canonical managed request body. */
export type AthleteUpdate = CamelCaseKeys<AthleteUpdateWire>;

export class AthleteResource extends BaseResource {
  async get(): Promise<Result<Athlete>> {
    return this.http.requestJson(
      "GET",
      "/athlete/{id}",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}", {
          params: { path: { id: this.athleteId } },
          signal,
        }),
      AthleteSchema,
    );
  }

  async getProfile(): Promise<Result<Athlete>> {
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/profile",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/profile", {
          params: { path: { id: this.athleteId } },
          signal,
        }),
      AthleteSchema,
    );
  }

  async update(body: AthleteUpdate | AthleteUpdateWire) {
    const encoded = encodeRequestBody<AthleteUpdateWire>(body, "AthleteUpdateDTO");
    if (!encoded.ok) {
      return this.http.rejectValidation("PUT", "/athlete/{id}", [...encoded.issues]);
    }

    return this.http.requestJson("PUT", "/athlete/{id}", (signal) =>
      this.api.PUT("/api/v1/athlete/{id}", {
        params: { path: { id: this.athleteId } },
        body: encoded.value,
        signal,
      }),
    );
  }
}
