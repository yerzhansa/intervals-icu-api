import * as v from "valibot";
import type {
  BinaryDownload,
  BinaryMetadataOptions,
  BinaryOnlyOptions,
  SensorDownloadMetadataOptions,
  SensorDownloadOptions,
} from "../download.js";
import type { components } from "../generated/schema.js";
import { encodePathSegment } from "../path.js";
import type { Result } from "../result.js";
import { ActivitySchema, type Activity } from "../schemas/activity.js";
import {
  ActivityStreamSchema,
  type ActivityStream,
  type GetStreamsOptions,
} from "../schemas/activity-stream.js";
import type { CamelCaseKeys } from "../transform.js";
import { BaseResource } from "./base.js";

export type ActivityIntervalsWire = components["schemas"]["IntervalsDTO"];
export type ActivityIntervals = CamelCaseKeys<ActivityIntervalsWire>;

export class ActivitiesResource extends BaseResource {
  async list(query: {
    oldest: string;
    newest?: string;
    limit?: number;
    fields?: string[];
  }): Promise<Result<Activity[]>> {
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/activities",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/activities", {
          params: { path: { id: this.athleteId }, query },
          signal,
        }),
      v.array(ActivitySchema),
    );
  }

  async get(activityId: string): Promise<Result<Activity>> {
    return this.http.requestJson(
      "GET",
      "/activity/{id}",
      (signal) =>
        this.api.GET("/api/v1/activity/{id}", {
          params: { path: { id: activityId } },
          signal,
        }),
      ActivitySchema,
    );
  }

  /** @deprecated Pass `{ types, includeDefaults }` instead. */
  async getStreams(activityId: string, types: readonly string[]): Promise<Result<ActivityStream[]>>;
  async getStreams(
    activityId: string,
    options?: GetStreamsOptions,
  ): Promise<Result<ActivityStream[]>>;
  async getStreams(
    activityId: string,
    typesOrOptions: readonly string[] | GetStreamsOptions = {},
  ): Promise<Result<ActivityStream[]>> {
    const options: GetStreamsOptions = Array.isArray(typesOrOptions)
      ? { types: typesOrOptions }
      : (typesOrOptions as GetStreamsOptions);
    const query = {
      ...(options.types === undefined ? {} : { types: [...options.types] }),
      ...(options.includeDefaults === undefined
        ? {}
        : { includeDefaults: options.includeDefaults }),
    };

    return this.http.requestJson(
      "GET",
      "/activity/{id}/streams",
      (signal) =>
        this.api.GET("/api/v1/activity/{id}/streams{ext}", {
          params: {
            path: { id: activityId, ext: ".json" },
            query,
          },
          signal,
        }),
      v.array(ActivityStreamSchema),
    );
  }

  async getIntervals(activityId: string): Promise<Result<ActivityIntervals>> {
    return this.http.requestJson<ActivityIntervalsWire>(
      "GET",
      "/activity/{id}/intervals",
      (signal) =>
        this.api.GET("/api/v1/activity/{id}/intervals", {
          params: { path: { id: activityId } },
          signal,
        }),
    );
  }

  async downloadFile(activityId: string): Promise<Result<ArrayBuffer>>;
  async downloadFile(
    activityId: string,
    options: BinaryMetadataOptions,
  ): Promise<Result<BinaryDownload>>;
  async downloadFile(activityId: string, options?: BinaryOnlyOptions): Promise<Result<ArrayBuffer>>;
  async downloadFile(
    activityId: string,
    options: BinaryOnlyOptions | BinaryMetadataOptions = {},
  ): Promise<Result<ArrayBuffer | BinaryDownload>> {
    const urlPath = `/api/v1/activity/${encodePathSegment(activityId)}/file`;
    return options.includeMetadata
      ? this.http.requestBinaryDownload("GET", "/activity/{id}/file", urlPath)
      : this.http.requestBinary("GET", "/activity/{id}/file", urlPath);
  }

  async downloadFitFile(activityId: string): Promise<Result<ArrayBuffer>>;
  async downloadFitFile(
    activityId: string,
    options: SensorDownloadMetadataOptions,
  ): Promise<Result<BinaryDownload>>;
  async downloadFitFile(
    activityId: string,
    options?: SensorDownloadOptions,
  ): Promise<Result<ArrayBuffer>>;
  async downloadFitFile(
    activityId: string,
    options: SensorDownloadOptions | SensorDownloadMetadataOptions = {},
  ): Promise<Result<ArrayBuffer | BinaryDownload>> {
    const urlPath = withSensorQuery(
      `/api/v1/activity/${encodePathSegment(activityId)}/fit-file`,
      options,
    );
    return options.includeMetadata
      ? this.http.requestBinaryDownload("GET", "/activity/{id}/fit-file", urlPath)
      : this.http.requestBinary("GET", "/activity/{id}/fit-file", urlPath);
  }

  async downloadGpxFile(activityId: string): Promise<Result<ArrayBuffer>>;
  async downloadGpxFile(
    activityId: string,
    options: SensorDownloadMetadataOptions,
  ): Promise<Result<BinaryDownload>>;
  async downloadGpxFile(
    activityId: string,
    options?: SensorDownloadOptions,
  ): Promise<Result<ArrayBuffer>>;
  async downloadGpxFile(
    activityId: string,
    options: SensorDownloadOptions | SensorDownloadMetadataOptions = {},
  ): Promise<Result<ArrayBuffer | BinaryDownload>> {
    const urlPath = withSensorQuery(
      `/api/v1/activity/${encodePathSegment(activityId)}/gpx-file`,
      options,
    );
    return options.includeMetadata
      ? this.http.requestBinaryDownload("GET", "/activity/{id}/gpx-file", urlPath)
      : this.http.requestBinary("GET", "/activity/{id}/gpx-file", urlPath);
  }

  async exportCsv(query?: { oldest?: string; newest?: string }): Promise<Result<string>> {
    const qs = new URLSearchParams();
    if (query?.oldest) qs.set("oldest", query.oldest);
    if (query?.newest) qs.set("newest", query.newest);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const result = await this.http.requestBinary(
      "GET",
      "/athlete/{id}/activities.csv",
      `/api/v1/athlete/${encodePathSegment(this.athleteId)}/activities.csv${suffix}`,
    );
    if (!result.ok) return result;
    return { ok: true, value: new TextDecoder().decode(result.value) };
  }
}

function withSensorQuery(
  urlPath: string,
  options: SensorDownloadOptions | SensorDownloadMetadataOptions,
): string {
  const query = new URLSearchParams();
  if (options.power !== undefined) query.set("power", String(options.power));
  if (options.hr !== undefined) query.set("hr", String(options.hr));
  const suffix = query.toString();
  return suffix ? `${urlPath}?${suffix}` : urlPath;
}
