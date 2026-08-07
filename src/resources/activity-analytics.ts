import * as v from "valibot";
import type { components, operations } from "../generated/schema.js";
import type { Result, ValidationIssue } from "../result.js";
import {
  ActivityHeartRateCurvePayloadSchema,
  ActivityPaceCurvePayloadSchema,
  ActivityPowerCurvePayloadSchema,
  AthleteHeartRateCurveSetSchema,
  AthletePaceCurveSetSchema,
  AthletePowerCurveSetSchema,
  AthletePowerHeartRateCurveSchema,
  BestEffortsSchema,
  HeartRateCurveSchema,
  HistogramBucketSchema,
  PaceCurveSchema,
  PowerCurveSchema,
  PowerVsHeartRatePlotSchema,
  type ActivityHeartRateCurvePayload,
  type ActivityPaceCurvePayload,
  type ActivityPowerCurvePayload,
  type AthleteHeartRateCurveSet,
  type AthletePaceCurveSet,
  type AthletePowerCurveSet,
  type AthletePowerHeartRateCurve,
  type BestEfforts,
  type HeartRateCurve,
  type HistogramBucket,
  type PaceCurve,
  type PowerCurve,
  type PowerVsHeartRatePlot,
} from "../schemas/analytics.js";
import type { ActivityStreamType } from "../schemas/activity-stream.js";
import { BaseResource } from "./base.js";

export type AnalyticsSportType = NonNullable<
  operations["listAthletePowerCurves"]["parameters"]["query"]["type"]
>;
export type ActivityFilterFieldId = NonNullable<
  components["schemas"]["ActivityFilter"]["field_id"]
>;
export type PowerCurveFatigue = "kj0" | "kj1";
export type PowerCurveSeries = "normal" | PowerCurveFatigue;
export type PaceModelType = "CS";
export type PowerModelType = "MS_2P" | "MORTON_3P" | "FFT_CURVES" | "ECP";

interface ActivityFilterInputCommon {
  code?: string;
  id?: number;
  not?: boolean;
  operator?: string;
  /** Opaque Intervals.icu filter value; nested keys are never recased. */
  value?: unknown;
}

/** @deprecated Prefer the canonical `fieldId` spelling through {@link ActivityFilterInput}. */
export type ActivityFilterInputWire = components["schemas"]["ActivityFilter"];

export type ActivityFilterInput = ActivityFilterInputCommon &
  (
    | { fieldId?: ActivityFilterFieldId; field_id?: never }
    | { fieldId?: never; field_id?: ActivityFilterFieldId }
  );

export interface FindBestEffortsOptions {
  stream: ActivityStreamType;
  /** Effort duration in seconds. */
  duration?: number;
  /** Effort distance in meters. */
  distance?: number;
  count?: number;
  minValue?: number;
  excludeIntervals?: boolean;
  startIndex?: number;
  endIndex?: number;
}

export interface HistogramOptions {
  bucketSize?: number;
}

export interface GetPaceCurveOptions {
  gap?: boolean;
}

export interface GetPowerCurveOptions {
  fatigue?: PowerCurveFatigue;
}

export interface GetPowerCurvesOptions {
  types?: readonly ActivityStreamType[];
  fatigue?: readonly PowerCurveSeries[];
}

interface ActivityCurveRangeOptions {
  oldest: string;
  newest: string;
  type?: AnalyticsSportType;
  filters?: readonly ActivityFilterInput[];
}

export interface ListActivityHeartRateCurvesOptions extends ActivityCurveRangeOptions {
  /** Durations in seconds. */
  secs?: readonly number[];
}

export interface ListActivityPaceCurvesOptions extends ActivityCurveRangeOptions {
  /** Distances in meters. */
  distances?: readonly number[];
  gap?: boolean;
}

type ListActivityPowerCurvesBase = ActivityCurveRangeOptions & {
  /**
   * Durations in seconds. Supported by the live Intervals.icu UI/API but missing from the
   * currently published OpenAPI operation.
   */
  secs?: readonly number[];
};

export type ListActivityPowerCurvesOptions =
  | (ListActivityPowerCurvesBase & { fatigue?: undefined })
  | (ListActivityPowerCurvesBase & { fatigue: PowerCurveFatigue; type: AnalyticsSportType });

interface ListAthleteCurvesCommonOptions {
  newest?: string;
  /** Window selectors such as `42d`, `s0`, `all`, or an Intervals.icu range selector. */
  curves?: readonly string[];
  type?: AnalyticsSportType;
  subMaxEfforts?: number;
  now?: string;
  filters?: readonly ActivityFilterInput[];
  f1?: readonly ActivityFilterInput[];
  f2?: readonly ActivityFilterInput[];
  f3?: readonly ActivityFilterInput[];
}

export interface ListAthleteHeartRateCurvesOptions extends ListAthleteCurvesCommonOptions {}

export interface ListAthletePaceCurvesOptions extends ListAthleteCurvesCommonOptions {
  includeRanks?: boolean;
  gap?: boolean;
  pmType?: PaceModelType;
}

export interface ListAthletePowerCurvesOptions extends ListAthleteCurvesCommonOptions {
  type: AnalyticsSportType;
  includeRanks?: boolean;
  pmType?: PowerModelType;
}

export interface GetAthletePowerHeartRateCurveOptions {
  start: string;
  end: string;
  type?: AnalyticsSportType;
  filters?: readonly ActivityFilterInput[];
}

export class ActivityAnalyticsResource extends BaseResource {
  async findBestEfforts(
    activityId: string,
    options: FindBestEffortsOptions,
  ): Promise<Result<BestEfforts>> {
    const query: operations["findBestEfforts"]["parameters"]["query"] = {
      ...options,
      stream: options.stream,
    };
    return this.http.requestJson(
      "GET",
      "/activity/{id}/best-efforts",
      (signal) =>
        this.api.GET("/api/v1/activity/{id}/best-efforts", {
          params: { path: { id: activityId }, query },
          signal,
        }),
      BestEffortsSchema,
    );
  }

  async getGapHistogram(activityId: string): Promise<Result<HistogramBucket[]>> {
    return this.getHistogram(
      "/activity/{id}/gap-histogram",
      "/api/v1/activity/{id}/gap-histogram",
      activityId,
    );
  }

  async getHeartRateHistogram(
    activityId: string,
    options: HistogramOptions = {},
  ): Promise<Result<HistogramBucket[]>> {
    return this.http.requestJson(
      "GET",
      "/activity/{id}/hr-histogram",
      (signal) =>
        this.api.GET("/api/v1/activity/{id}/hr-histogram", {
          params: { path: { id: activityId }, query: options },
          signal,
        }),
      v.array(HistogramBucketSchema),
    );
  }

  async getPaceHistogram(activityId: string): Promise<Result<HistogramBucket[]>> {
    return this.getHistogram(
      "/activity/{id}/pace-histogram",
      "/api/v1/activity/{id}/pace-histogram",
      activityId,
    );
  }

  async getPowerHistogram(
    activityId: string,
    options: HistogramOptions = {},
  ): Promise<Result<HistogramBucket[]>> {
    return this.http.requestJson(
      "GET",
      "/activity/{id}/power-histogram",
      (signal) =>
        this.api.GET("/api/v1/activity/{id}/power-histogram", {
          params: { path: { id: activityId }, query: options },
          signal,
        }),
      v.array(HistogramBucketSchema),
    );
  }

  async getHeartRateCurve(activityId: string): Promise<Result<HeartRateCurve>> {
    return this.http.requestJson(
      "GET",
      "/activity/{id}/hr-curve",
      (signal) =>
        this.api.GET("/api/v1/activity/{id}/hr-curve{ext}", {
          params: { path: { id: activityId, ext: "" } },
          signal,
        }),
      HeartRateCurveSchema,
    );
  }

  async getPaceCurve(
    activityId: string,
    options: GetPaceCurveOptions = {},
  ): Promise<Result<PaceCurve>> {
    return this.http.requestJson(
      "GET",
      "/activity/{id}/pace-curve",
      (signal) =>
        this.api.GET("/api/v1/activity/{id}/pace-curve{ext}", {
          params: { path: { id: activityId, ext: "" }, query: options },
          signal,
        }),
      PaceCurveSchema,
    );
  }

  async getPowerCurve(
    activityId: string,
    options: GetPowerCurveOptions = {},
  ): Promise<Result<PowerCurve>> {
    return this.http.requestJson(
      "GET",
      "/activity/{id}/power-curve",
      (signal) =>
        this.api.GET("/api/v1/activity/{id}/power-curve{ext}", {
          params: { path: { id: activityId, ext: "" }, query: options },
          signal,
        }),
      PowerCurveSchema,
    );
  }

  async getPowerCurves(
    activityId: string,
    options: GetPowerCurvesOptions = {},
  ): Promise<Result<PowerCurve[]>> {
    const query = {
      ...(options.types === undefined ? {} : { types: [...options.types] }),
      ...(options.fatigue === undefined ? {} : { fatigue: [...options.fatigue] }),
    };
    return this.http.requestJson(
      "GET",
      "/activity/{id}/power-curves",
      (signal) =>
        this.api.GET("/api/v1/activity/{id}/power-curves{ext}", {
          params: { path: { id: activityId, ext: "" }, query },
          querySerializer: analyticsQuerySerializer,
          signal,
        }),
      v.array(PowerCurveSchema),
    );
  }

  async getPowerVsHeartRate(activityId: string): Promise<Result<PowerVsHeartRatePlot>> {
    return this.http.requestJson(
      "GET",
      "/activity/{id}/power-vs-hr",
      (signal) =>
        this.api.GET("/api/v1/activity/{id}/power-vs-hr{ext}", {
          params: { path: { id: activityId, ext: "" } },
          signal,
        }),
      PowerVsHeartRatePlotSchema,
    );
  }

  async listActivityHeartRateCurves(
    options: ListActivityHeartRateCurvesOptions,
  ): Promise<Result<ActivityHeartRateCurvePayload>> {
    const invalid = this.rejectFilterAliasCollisions("/athlete/{id}/activity-hr-curves", [
      ["filters", options.filters],
    ]);
    if (invalid) return invalid;

    const query = {
      ...mapActivityRange(options),
      ...(options.secs === undefined ? {} : { secs: [...options.secs] }),
    };
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/activity-hr-curves",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/activity-hr-curves{ext}", {
          params: { path: { id: this.athleteId, ext: "" }, query },
          querySerializer: analyticsQuerySerializer,
          signal,
        }),
      ActivityHeartRateCurvePayloadSchema,
    );
  }

  async listActivityPaceCurves(
    options: ListActivityPaceCurvesOptions,
  ): Promise<Result<ActivityPaceCurvePayload>> {
    const invalid = this.rejectFilterAliasCollisions("/athlete/{id}/activity-pace-curves", [
      ["filters", options.filters],
    ]);
    if (invalid) return invalid;

    const query = {
      ...mapActivityRange(options),
      ...(options.distances === undefined ? {} : { distances: [...options.distances] }),
      ...(options.gap === undefined ? {} : { gap: options.gap }),
    };
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/activity-pace-curves",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/activity-pace-curves{ext}", {
          params: { path: { id: this.athleteId, ext: "" }, query },
          querySerializer: analyticsQuerySerializer,
          signal,
        }),
      ActivityPaceCurvePayloadSchema,
    );
  }

  async listActivityPowerCurves(
    options: ListActivityPowerCurvesOptions,
  ): Promise<Result<ActivityPowerCurvePayload>> {
    const invalid = this.rejectFilterAliasCollisions("/athlete/{id}/activity-power-curves", [
      ["filters", options.filters],
    ]);
    if (invalid) return invalid;

    const query = {
      ...mapActivityRange(options),
      ...(options.fatigue === undefined ? {} : { fatigue: options.fatigue }),
      ...(options.secs === undefined ? {} : { secs: [...options.secs] }),
    };
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/activity-power-curves",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/activity-power-curves{ext}", {
          params: { path: { id: this.athleteId, ext: "" }, query },
          querySerializer: analyticsQuerySerializer,
          signal,
        }),
      ActivityPowerCurvePayloadSchema,
    );
  }

  async listAthleteHeartRateCurves(
    options: ListAthleteHeartRateCurvesOptions = {},
  ): Promise<Result<AthleteHeartRateCurveSet>> {
    const invalid = this.rejectFilterAliasCollisions(
      "/athlete/{id}/hr-curves",
      filterGroups(options),
    );
    if (invalid) return invalid;

    const query = mapAthleteCurveOptions(options);
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/hr-curves",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/hr-curves{ext}", {
          params: {
            path: { id: this.athleteId, ext: "" },
            // The live API permits f1/f2/f3 omission; the published schema marks them required.
            query: query as operations["listAthleteHRCurves"]["parameters"]["query"],
          },
          querySerializer: analyticsQuerySerializer,
          signal,
        }),
      AthleteHeartRateCurveSetSchema,
    );
  }

  async listAthletePaceCurves(
    options: ListAthletePaceCurvesOptions = {},
  ): Promise<Result<AthletePaceCurveSet>> {
    const invalid = this.rejectFilterAliasCollisions(
      "/athlete/{id}/pace-curves",
      filterGroups(options),
    );
    if (invalid) return invalid;

    const query = {
      ...mapAthleteCurveOptions(options),
      ...(options.includeRanks === undefined ? {} : { includeRanks: options.includeRanks }),
      ...(options.gap === undefined ? {} : { gap: options.gap }),
      ...(options.pmType === undefined ? {} : { pmType: options.pmType }),
    };
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/pace-curves",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/pace-curves{ext}", {
          params: {
            path: { id: this.athleteId, ext: "" },
            // The live API permits f1/f2/f3 omission; the published schema marks them required.
            query: query as operations["listAthletePaceCurves"]["parameters"]["query"],
          },
          querySerializer: analyticsQuerySerializer,
          signal,
        }),
      AthletePaceCurveSetSchema,
    );
  }

  async listAthletePowerCurves(
    options: ListAthletePowerCurvesOptions,
  ): Promise<Result<AthletePowerCurveSet>> {
    const invalid = this.rejectFilterAliasCollisions(
      "/athlete/{id}/power-curves",
      filterGroups(options),
    );
    if (invalid) return invalid;

    const query = {
      ...mapAthleteCurveOptions(options),
      type: options.type,
      ...(options.includeRanks === undefined ? {} : { includeRanks: options.includeRanks }),
      ...(options.pmType === undefined ? {} : { pmType: options.pmType }),
    };
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/power-curves",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/power-curves{ext}", {
          params: {
            path: { id: this.athleteId, ext: "" },
            // The live API permits f1/f2/f3 omission; the published schema marks them required.
            query: query as operations["listAthletePowerCurves"]["parameters"]["query"],
          },
          querySerializer: analyticsQuerySerializer,
          signal,
        }),
      AthletePowerCurveSetSchema,
    );
  }

  async getAthletePowerHeartRateCurve(
    options: GetAthletePowerHeartRateCurveOptions,
  ): Promise<Result<AthletePowerHeartRateCurve>> {
    const invalid = this.rejectFilterAliasCollisions("/athlete/{id}/power-hr-curve", [
      ["filters", options.filters],
    ]);
    if (invalid) return invalid;

    const query = {
      start: options.start,
      end: options.end,
      ...(options.type === undefined ? {} : { type: options.type }),
      ...(options.filters === undefined ? {} : { filters: mapFilters(options.filters) }),
    };
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/power-hr-curve",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/power-hr-curve", {
          params: { path: { id: this.athleteId }, query },
          querySerializer: analyticsQuerySerializer,
          signal,
        }),
      AthletePowerHeartRateCurveSchema,
    );
  }

  private async getHistogram(
    logicalPath: string,
    apiPath: "/api/v1/activity/{id}/gap-histogram" | "/api/v1/activity/{id}/pace-histogram",
    activityId: string,
  ): Promise<Result<HistogramBucket[]>> {
    return this.http.requestJson(
      "GET",
      logicalPath,
      (signal) => this.api.GET(apiPath, { params: { path: { id: activityId } }, signal }),
      v.array(HistogramBucketSchema),
    );
  }

  private rejectFilterAliasCollisions(
    path: string,
    groups: readonly FilterGroup[],
  ): Promise<Result<never>> | undefined {
    const issues = findFilterAliasCollisions(groups);
    return issues.length === 0 ? undefined : this.http.rejectValidation("GET", path, issues);
  }
}

function mapFilter(filter: ActivityFilterInput): components["schemas"]["ActivityFilter"] {
  type WireFilterValue = components["schemas"]["ActivityFilter"]["value"];
  const fieldId = filter.fieldId ?? filter.field_id;
  return {
    ...(filter.code === undefined ? {} : { code: filter.code }),
    ...(fieldId === undefined ? {} : { field_id: fieldId }),
    ...(filter.id === undefined ? {} : { id: filter.id }),
    ...(filter.not === undefined ? {} : { not: filter.not }),
    ...(filter.operator === undefined ? {} : { operator: filter.operator }),
    ...(filter.value === undefined ? {} : { value: filter.value as WireFilterValue }),
  };
}

type FilterGroup = readonly [name: string, filters: readonly ActivityFilterInput[] | undefined];

function filterGroups(options: ListAthleteCurvesCommonOptions): readonly FilterGroup[] {
  return [
    ["filters", options.filters],
    ["f1", options.f1],
    ["f2", options.f2],
    ["f3", options.f3],
  ];
}

function findFilterAliasCollisions(groups: readonly FilterGroup[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [name, filters] of groups) {
    filters?.forEach((filter, index) => {
      if (Object.hasOwn(filter, "fieldId") && Object.hasOwn(filter, "field_id")) {
        issues.push({
          path: `query.${name}.${index}.fieldId`,
          message: 'Request keys "fieldId" and "field_id" both map to wire key "field_id"',
          expected: "one request alias per field",
          received: ["fieldId", "field_id"],
        });
      }
    });
  }
  return issues;
}

function mapFilters(
  filters: readonly ActivityFilterInput[] | undefined,
): components["schemas"]["ActivityFilter"][] | undefined {
  return filters?.map(mapFilter);
}

function mapActivityRange(options: ActivityCurveRangeOptions) {
  return {
    oldest: options.oldest,
    newest: options.newest,
    ...(options.type === undefined ? {} : { type: options.type }),
    ...(options.filters === undefined ? {} : { filters: mapFilters(options.filters) }),
  };
}

function mapAthleteCurveOptions(options: ListAthleteCurvesCommonOptions) {
  return {
    ...(options.newest === undefined ? {} : { newest: options.newest }),
    ...(options.curves === undefined ? {} : { curves: [...options.curves] }),
    ...(options.type === undefined ? {} : { type: options.type }),
    ...(options.subMaxEfforts === undefined ? {} : { subMaxEfforts: options.subMaxEfforts }),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.filters === undefined ? {} : { filters: mapFilters(options.filters) }),
    ...(options.f1 === undefined ? {} : { f1: mapFilters(options.f1) }),
    ...(options.f2 === undefined ? {} : { f2: mapFilters(options.f2) }),
    ...(options.f3 === undefined ? {} : { f3: mapFilters(options.f3) }),
  };
}

/** Mirrors the query preprocessing used by the live Intervals.icu application. */
function analyticsQuerySerializer(query: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (isFilterParameter(name)) {
        if (name === "filters" && value.length === 0) continue;
        search.append(name, JSON.stringify(value));
      } else {
        search.append(name, value.join(","));
      }
    } else if (isPlainObject(value)) {
      search.append(name, JSON.stringify(value));
    } else {
      search.append(name, String(value));
    }
  }
  return search.toString();
}

function isFilterParameter(name: string): boolean {
  return name === "filters" || name === "f1" || name === "f2" || name === "f3";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
