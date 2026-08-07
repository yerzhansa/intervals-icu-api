import * as v from "valibot";
import type { components } from "../generated/schema.js";
import type { BinaryDownload, BinaryMetadataOptions, BinaryOnlyOptions } from "../download.js";
import type { Result } from "../result.js";
import { encodePathSegment } from "../path.js";
import { encodeRequestBody } from "../request-casing.js";
import { EventSchema, type Event } from "../schemas/event.js";
import type { CamelCaseKeys } from "../transform.js";
import { BaseResource } from "./base.js";

/** @deprecated Prefer the canonical camelCase {@link EventInput}. */
export type EventInputWire = components["schemas"]["EventEx"];

/** Canonical managed request body. */
export type EventInput = CamelCaseKeys<EventInputWire>;

export class EventsResource extends BaseResource {
  async list(query?: {
    oldest?: string;
    newest?: string;
    category?: string[];
    limit?: number;
  }): Promise<Result<Event[]>> {
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/events",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/events{format}", {
          params: { path: { id: this.athleteId, format: "" }, query },
          signal,
        }),
      v.array(EventSchema),
    );
  }

  async get(eventId: number): Promise<Result<Event>> {
    return this.http.requestJson(
      "GET",
      "/athlete/{id}/events/{eventId}",
      (signal) =>
        this.api.GET("/api/v1/athlete/{id}/events/{eventId}", {
          params: { path: { id: this.athleteId, eventId } },
          signal,
        }),
      EventSchema,
    );
  }

  async create(
    body: EventInput | EventInputWire,
    options?: { upsertOnUid?: boolean },
  ): Promise<Result<Event>> {
    const encoded = encodeRequestBody<EventInputWire>(body, "EventEx");
    if (!encoded.ok) {
      return this.http.rejectValidation("POST", "/athlete/{id}/events", [...encoded.issues]);
    }

    return this.http.requestJson(
      "POST",
      "/athlete/{id}/events",
      (signal) =>
        this.api.POST("/api/v1/athlete/{id}/events", {
          params: {
            path: { id: this.athleteId },
            query: { upsertOnUid: options?.upsertOnUid ?? false },
          },
          body: encoded.value,
          signal,
        }),
      EventSchema,
    );
  }

  async update(eventId: number, body: EventInput | EventInputWire): Promise<Result<Event>> {
    const encoded = encodeRequestBody<EventInputWire>(body, "EventEx");
    if (!encoded.ok) {
      return this.http.rejectValidation("PUT", "/athlete/{id}/events/{eventId}", [
        ...encoded.issues,
      ]);
    }

    return this.http.requestJson(
      "PUT",
      "/athlete/{id}/events/{eventId}",
      (signal) =>
        this.api.PUT("/api/v1/athlete/{id}/events/{eventId}", {
          params: { path: { id: this.athleteId, eventId } },
          body: encoded.value,
          signal,
        }),
      EventSchema,
    );
  }

  async delete(eventId: number) {
    return this.http.requestJson("DELETE", "/athlete/{id}/events/{eventId}", (signal) =>
      this.api.DELETE("/api/v1/athlete/{id}/events/{eventId}", {
        params: { path: { id: this.athleteId, eventId } },
        signal,
      }),
    );
  }

  async downloadWorkout(
    eventId: number,
    format: "zwo" | "mrc" | "erg" | "fit",
  ): Promise<Result<ArrayBuffer>>;
  async downloadWorkout(
    eventId: number,
    format: "zwo" | "mrc" | "erg" | "fit",
    options: BinaryMetadataOptions,
  ): Promise<Result<BinaryDownload>>;
  async downloadWorkout(
    eventId: number,
    format: "zwo" | "mrc" | "erg" | "fit",
    options?: BinaryOnlyOptions,
  ): Promise<Result<ArrayBuffer>>;
  async downloadWorkout(
    eventId: number,
    format: "zwo" | "mrc" | "erg" | "fit",
    options: BinaryOnlyOptions | BinaryMetadataOptions = {},
  ): Promise<Result<ArrayBuffer | BinaryDownload>> {
    const urlPath = `/api/v1/athlete/${encodePathSegment(this.athleteId)}/events/${encodePathSegment(eventId)}/download.${encodePathSegment(format)}`;
    return options.includeMetadata
      ? this.http.requestBinaryDownload("GET", "/athlete/{id}/events/{eventId}/download", urlPath)
      : this.http.requestBinary("GET", "/athlete/{id}/events/{eventId}/download", urlPath);
  }
}
