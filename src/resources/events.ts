import * as v from "valibot";
import type { components } from "../generated/schema.js";
import type { Result } from "../result.js";
import { EventSchema, type Event } from "../schemas/event.js";
import { BaseResource } from "./base.js";

type EventBody = components["schemas"]["EventEx"];

export class EventsResource extends BaseResource {
  async list(query?: { oldest?: string; newest?: string; category?: string[]; limit?: number }): Promise<Result<Event[]>> {
    return this.http.requestJson("GET", "/athlete/{id}/events", () =>
      this.api.GET("/api/v1/athlete/{id}/events{format}", {
        params: { path: { id: this.athleteId, format: "" }, query },
      }),
      v.array(EventSchema),
    );
  }

  async get(eventId: number): Promise<Result<Event>> {
    return this.http.requestJson("GET", "/athlete/{id}/events/{eventId}", () =>
      this.api.GET("/api/v1/athlete/{id}/events/{eventId}", {
        params: { path: { id: this.athleteId, eventId } },
      }),
      EventSchema,
    );
  }

  async create(body: EventBody, options?: { upsertOnUid?: boolean }): Promise<Result<Event>> {
    return this.http.requestJson("POST", "/athlete/{id}/events", () =>
      this.api.POST("/api/v1/athlete/{id}/events", {
        params: {
          path: { id: this.athleteId },
          query: { upsertOnUid: options?.upsertOnUid ?? false },
        },
        body,
      }),
      EventSchema,
    );
  }

  async update(eventId: number, body: EventBody): Promise<Result<Event>> {
    return this.http.requestJson("PUT", "/athlete/{id}/events/{eventId}", () =>
      this.api.PUT("/api/v1/athlete/{id}/events/{eventId}", {
        params: { path: { id: this.athleteId, eventId } },
        body,
      }),
      EventSchema,
    );
  }

  async delete(eventId: number) {
    return this.http.requestJson("DELETE", "/athlete/{id}/events/{eventId}", () =>
      this.api.DELETE("/api/v1/athlete/{id}/events/{eventId}", {
        params: { path: { id: this.athleteId, eventId } },
      }),
    );
  }

  async downloadWorkout(eventId: number, format: "zwo" | "mrc" | "erg" | "fit"): Promise<Result<ArrayBuffer>> {
    return this.http.requestBinary("GET", "/athlete/{id}/events/{eventId}/download", `/api/v1/athlete/${this.athleteId}/events/${eventId}/download.${format}`);
  }
}
