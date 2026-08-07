import * as v from "valibot";
import type { components } from "../generated/schema.js";
import { encodeRequestBody } from "../request-casing.js";
import type { Result } from "../result.js";
import { WellnessSchema, type WellnessRecord } from "../schemas/wellness.js";
import type { CamelCaseKeys } from "../transform.js";
import { BaseResource } from "./base.js";

/** @deprecated Prefer the canonical camelCase {@link WellnessUpdate}. */
export type WellnessUpdateWire = components["schemas"]["Wellness"];

/** Canonical managed request body. */
export type WellnessUpdate = CamelCaseKeys<WellnessUpdateWire>;

export class WellnessResource extends BaseResource {
  async list(query?: {
    oldest?: string;
    newest?: string;
    cols?: string[];
    fields?: string[];
  }): Promise<Result<WellnessRecord[]>> {
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/wellness",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/wellness{ext}", {
          params: { path: { id: this.athleteId, ext: "" }, query },
          signal,
        }),
      v.array(WellnessSchema),
    );
  }

  async get(date: string): Promise<Result<WellnessRecord>> {
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/wellness/{date}",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/wellness/{date}", {
          params: { path: { id: this.athleteId, date } },
          signal,
        }),
      WellnessSchema,
    );
  }

  async update(body: WellnessUpdate | WellnessUpdateWire) {
    const encoded = encodeRequestBody<WellnessUpdateWire>(body, "Wellness");
    if (!encoded.ok) {
      return this.http.rejectValidation("PUT", "/athlete/{id}/wellness", [...encoded.issues]);
    }

    return this.http.requestJson("PUT", "/athlete/{id}/wellness", (signal) =>
      this.api.PUT("/api/v1/athlete/{id}/wellness", {
        params: { path: { id: this.athleteId } },
        body: encoded.value,
        signal,
      }),
    );
  }

  async updateByDate(date: string, body: WellnessUpdate | WellnessUpdateWire) {
    const encoded = encodeRequestBody<WellnessUpdateWire>(body, "Wellness");
    if (!encoded.ok) {
      return this.http.rejectValidation("PUT", "/athlete/{id}/wellness/{date}", [
        ...encoded.issues,
      ]);
    }

    return this.http.requestJson("PUT", "/athlete/{id}/wellness/{date}", (signal) =>
      this.api.PUT("/api/v1/athlete/{id}/wellness/{date}", {
        params: { path: { id: this.athleteId, date } },
        body: encoded.value,
        signal,
      }),
    );
  }

  async updateBulk(body: WellnessUpdate[] | WellnessUpdateWire[]) {
    const encoded = encodeRequestBody<WellnessUpdateWire[]>(body, "Wellness", true);
    if (!encoded.ok) {
      return this.http.rejectValidation("PUT", "/athlete/{id}/wellness-bulk", [...encoded.issues]);
    }

    return this.http.requestJson("PUT", "/athlete/{id}/wellness-bulk", (signal) =>
      this.api.PUT("/api/v1/athlete/{id}/wellness-bulk", {
        params: { path: { id: this.athleteId } },
        body: encoded.value,
        signal,
      }),
    );
  }
}
