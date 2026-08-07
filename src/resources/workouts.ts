import type { components } from "../generated/schema.js";
import type { BinaryDownload, WorkoutZipMetadataOptions, WorkoutZipOptions } from "../download.js";
import { encodePathSegment } from "../path.js";
import { encodeRequestBody } from "../request-casing.js";
import type { Result } from "../result.js";
import type { CamelCaseKeys } from "../transform.js";
import { BaseResource } from "./base.js";

/** @deprecated Prefer the canonical camelCase {@link WorkoutInput}. */
export type WorkoutInputWire = components["schemas"]["WorkoutEx"];

/** Canonical managed request body. */
export type WorkoutInput = CamelCaseKeys<WorkoutInputWire>;

export class WorkoutsResource extends BaseResource {
  async list() {
    return this.http.requestJson("GET", "/athlete/{id}/workouts", (signal) =>
      this.api.GET("/api/v1/athlete/{id}/workouts", {
        params: { path: { id: this.athleteId } },
        signal,
      }),
    );
  }

  async get(workoutId: number) {
    return this.http.requestJson("GET", "/athlete/{id}/workouts/{workoutId}", (signal) =>
      this.api.GET("/api/v1/athlete/{id}/workouts/{workoutId}", {
        params: { path: { id: this.athleteId, workoutId } },
        signal,
      }),
    );
  }

  async create(body: WorkoutInput | WorkoutInputWire) {
    const encoded = encodeRequestBody<WorkoutInputWire>(body, "WorkoutEx");
    if (!encoded.ok) {
      return this.http.rejectValidation("POST", "/athlete/{id}/workouts", [...encoded.issues]);
    }

    return this.http.requestJson("POST", "/athlete/{id}/workouts", (signal) =>
      this.api.POST("/api/v1/athlete/{id}/workouts", {
        params: { path: { id: this.athleteId } },
        body: encoded.value,
        signal,
      }),
    );
  }

  async delete(workoutId: number) {
    return this.http.requestJson("DELETE", "/athlete/{id}/workouts/{workoutId}", (signal) =>
      this.api.DELETE("/api/v1/athlete/{id}/workouts/{workoutId}", {
        params: { path: { id: this.athleteId, workoutId } },
        signal,
      }),
    );
  }

  async downloadZip(): Promise<Result<ArrayBuffer>>;
  async downloadZip(options: WorkoutZipMetadataOptions): Promise<Result<BinaryDownload>>;
  async downloadZip(options: WorkoutZipOptions): Promise<Result<ArrayBuffer>>;
  async downloadZip(
    options?: WorkoutZipOptions | WorkoutZipMetadataOptions,
  ): Promise<Result<ArrayBuffer | BinaryDownload>> {
    if (!isWorkoutZipOptions(options)) {
      return this.http.rejectValidation("GET", "/athlete/{id}/workouts.zip", [
        {
          path: "options",
          message: "Workout ZIP downloads require format, oldest, and newest",
          expected: "WorkoutZipOptions",
          received: options,
        },
      ]);
    }

    const query = new URLSearchParams({
      ext: options.format,
      oldest: options.oldest,
      newest: options.newest,
    });
    if (options.powerRange !== undefined) query.set("powerRange", String(options.powerRange));
    if (options.hrRange !== undefined) query.set("hrRange", String(options.hrRange));
    if (options.paceRange !== undefined) query.set("paceRange", String(options.paceRange));
    if (options.locale !== undefined) query.set("locale", options.locale);

    const urlPath = `/api/v1/athlete/${encodePathSegment(this.athleteId)}/workouts.zip?${query.toString()}`;
    return options.includeMetadata
      ? this.http.requestBinaryDownload("GET", "/athlete/{id}/workouts.zip", urlPath)
      : this.http.requestBinary("GET", "/athlete/{id}/workouts.zip", urlPath);
  }
}

const WORKOUT_ZIP_FORMATS = new Set<WorkoutZipOptions["format"]>(["zwo", "mrc", "erg", "fit"]);

function isWorkoutZipOptions(
  options: WorkoutZipOptions | WorkoutZipMetadataOptions | undefined,
): options is WorkoutZipOptions | WorkoutZipMetadataOptions {
  if (options === undefined || typeof options !== "object" || options === null) return false;

  const candidate = options as Partial<WorkoutZipOptions>;
  return (
    typeof candidate.format === "string" &&
    WORKOUT_ZIP_FORMATS.has(candidate.format as WorkoutZipOptions["format"]) &&
    typeof candidate.oldest === "string" &&
    candidate.oldest.trim().length > 0 &&
    typeof candidate.newest === "string" &&
    candidate.newest.trim().length > 0
  );
}
