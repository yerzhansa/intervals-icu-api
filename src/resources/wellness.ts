import * as v from "valibot";
import type { components } from "../generated/schema.js";
import type { Result } from "../result.js";
import { WellnessSchema, type WellnessRecord } from "../schemas/wellness.js";
import { BaseResource } from "./base.js";

type WellnessBody = components["schemas"]["Wellness"];

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

  async update(body: WellnessBody) {
    return this.http.requestJson("PUT", "/athlete/{id}/wellness", (signal) =>
      this.api.PUT("/api/v1/athlete/{id}/wellness", {
        params: { path: { id: this.athleteId } },
        body,
        signal,
      }),
    );
  }

  async updateByDate(date: string, body: WellnessBody) {
    return this.http.requestJson("PUT", "/athlete/{id}/wellness/{date}", (signal) =>
      this.api.PUT("/api/v1/athlete/{id}/wellness/{date}", {
        params: { path: { id: this.athleteId, date } },
        body,
        signal,
      }),
    );
  }

  async updateBulk(body: WellnessBody[]) {
    return this.http.requestJson("PUT", "/athlete/{id}/wellness-bulk", (signal) =>
      this.api.PUT("/api/v1/athlete/{id}/wellness-bulk", {
        params: { path: { id: this.athleteId } },
        body,
        signal,
      }),
    );
  }
}
