import * as v from "valibot";
import type { Result } from "../result.js";
import { ActivitySchema, type Activity } from "../schemas/activity.js";
import { BaseResource } from "./base.js";

export class ActivitiesResource extends BaseResource {
  async list(query: { oldest: string; newest?: string; limit?: number; fields?: string[] }): Promise<Result<Activity[]>> {
    return this.http.requestJson("GET", "/athlete/{id}/activities", () =>
      this.api.GET("/api/v1/athlete/{id}/activities", {
        params: { path: { id: this.athleteId }, query },
      }),
      v.array(ActivitySchema),
    );
  }

  async get(activityId: string): Promise<Result<Activity>> {
    return this.http.requestJson("GET", "/activity/{id}", () =>
      this.api.GET("/api/v1/activity/{id}", {
        params: { path: { id: activityId } },
      }),
      ActivitySchema,
    );
  }

  async getStreams(activityId: string, types: string[]) {
    return this.http.requestJson("GET", "/activity/{id}/streams", () =>
      this.api.GET("/api/v1/activity/{id}/streams{ext}", {
        params: {
          path: { id: activityId, ext: ".json" },
          query: { types },
        },
      }),
    );
  }

  async downloadFile(activityId: string): Promise<Result<ArrayBuffer>> {
    return this.http.requestBinary("GET", "/activity/{id}/file", `/api/v1/activity/${activityId}/file`);
  }

  async downloadFitFile(activityId: string): Promise<Result<ArrayBuffer>> {
    return this.http.requestBinary("GET", "/activity/{id}/fit-file", `/api/v1/activity/${activityId}/fit-file`);
  }

  async downloadGpxFile(activityId: string): Promise<Result<ArrayBuffer>> {
    return this.http.requestBinary("GET", "/activity/{id}/gpx-file", `/api/v1/activity/${activityId}/gpx-file`);
  }

  async exportCsv(query?: { oldest?: string; newest?: string }): Promise<Result<string>> {
    const qs = new URLSearchParams();
    if (query?.oldest) qs.set("oldest", query.oldest);
    if (query?.newest) qs.set("newest", query.newest);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const result = await this.http.requestBinary("GET", "/athlete/{id}/activities.csv", `/api/v1/athlete/${this.athleteId}/activities.csv${suffix}`);
    if (!result.ok) return result;
    return { ok: true, value: new TextDecoder().decode(result.value) };
  }
}
