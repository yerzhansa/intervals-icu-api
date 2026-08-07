import { describe, expect, it, vi } from "vitest";

import { IntervalsClient } from "../src/client.js";
import { encodeRequestBody } from "../src/request-casing.js";
import type { EventInput, EventInputWire } from "../src/resources/events.js";

describe("schema-aware request casing", () => {
  it("encodes canonical event fields recursively and preserves workout_doc dictionary keys", () => {
    const input = {
      startDateLocal: "2026-08-07T06:00:00",
      icuTrainingLoad: 42,
      workout: { movingTime: 1_800 },
      workoutDoc: {
        blocks_v2: {
          target_power: 0.7,
          nested_values: [{ keep_this_key: true }],
        },
      },
    } satisfies EventInput;

    const encoded = encodeRequestBody<EventInputWire>(input, "EventEx");

    expect(encoded).toEqual({
      ok: true,
      value: {
        start_date_local: "2026-08-07T06:00:00",
        icu_training_load: 42,
        workout: { moving_time: 1_800 },
        workout_doc: {
          blocks_v2: {
            target_power: 0.7,
            nested_values: [{ keep_this_key: true }],
          },
        },
      },
    });
    expect(input).toEqual({
      startDateLocal: "2026-08-07T06:00:00",
      icuTrainingLoad: 42,
      workout: { movingTime: 1_800 },
      workoutDoc: {
        blocks_v2: {
          target_power: 0.7,
          nested_values: [{ keep_this_key: true }],
        },
      },
    });
  });

  it("keeps legacy wire DTOs source-compatible and byte-for-key exact", () => {
    const body: EventInputWire = {
      start_date_local: "2026-08-07T06:00:00",
      icu_training_load: 42,
      workout: { moving_time: 1_800 },
      workout_doc: { keep_this_key: { and_this_one: true } },
    };

    expect(encodeRequestBody<EventInputWire>(body, "EventEx")).toEqual({
      ok: true,
      value: body,
    });
  });

  it("uses exact schema mappings for upstream mixed-case fields and acronyms", () => {
    expect(
      encodeRequestBody(
        {
          activityRpePrompt: true,
          applyToAll: true,
          localDate: "2026-08-07",
          recalcHrZones: true,
        },
        "AthleteUpdateDTO",
      ),
    ).toEqual({
      ok: true,
      value: {
        activity_rpe_prompt: true,
        applyToAll: true,
        localDate: "2026-08-07",
        recalcHrZones: true,
      },
    });

    expect(
      encodeRequestBody(
        {
          avgSleepingHR: 48,
          hrvSDNN: 52,
          spO2: 98,
          sportInfo: [{ pMax: 1_100, wPrime: 19_000 }],
        },
        "Wellness",
      ),
    ).toEqual({
      ok: true,
      value: {
        avgSleepingHR: 48,
        hrvSDNN: 52,
        spO2: 98,
        sportInfo: [{ pMax: 1_100, wPrime: 19_000 }],
      },
    });
  });

  it("rejects duplicate aliases and mixed casing without exposing body values", () => {
    const duplicate = encodeRequestBody(
      {
        startDateLocal: "canonical-value",
        start_date_local: "wire-value",
      },
      "EventEx",
    );
    expect(duplicate).toEqual({
      ok: false,
      issues: [
        {
          path: "body.startDateLocal",
          message:
            'Request keys "startDateLocal" and "start_date_local" both map to wire key "start_date_local"',
          expected: "one request alias per field",
          received: ["startDateLocal", "start_date_local"],
        },
      ],
    });
    expect(
      encodeRequestBody(
        {
          start_date_local: "wire-value",
          startDateLocal: "canonical-value",
        },
        "EventEx",
      ).ok,
    ).toBe(false);

    const mixed = encodeRequestBody(
      {
        startDateLocal: "canonical-value",
        icu_training_load: 42,
      },
      "EventEx",
    );
    expect(mixed.ok).toBe(false);
    if (!mixed.ok) {
      expect(mixed.issues[0]).toMatchObject({
        path: "body.icuTrainingLoad",
        message: "Request body mixes canonical camelCase and legacy wire-cased field names",
        expected: "camelCase request body",
      });
      expect(JSON.stringify(mixed.issues)).not.toContain("canonical-value");
    }
  });

  it("treats opaque and unknown dictionaries as wire data, including dangerous property names", () => {
    const workoutDoc = JSON.parse(
      '{"foo_bar":1,"fooBar":2,"__proto__":{"polluted_value":true},"constructor":{"prototype":{"bad":true}}}',
    ) as Record<string, unknown>;
    const unknownExtension = JSON.parse(
      '{"future_field":{"nested_wire_key":true},"__proto__":{"safe":true}}',
    ) as Record<string, unknown>;

    const encoded = encodeRequestBody<Record<string, unknown>>(
      { workoutDoc, ...unknownExtension },
      "WorkoutEx",
    );

    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const body = encoded.value;
    expect(body.workout_doc).toEqual(workoutDoc);
    expect(body.future_field).toEqual({ nested_wire_key: true });
    expect(Object.hasOwn(body, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).polluted_value).toBeUndefined();
    expect(({} as Record<string, unknown>).bad).toBeUndefined();
  });

  it("allows shared references but returns Validation data for a true cycle", () => {
    const shared = { keep_this_key: true };
    const sharedResult = encodeRequestBody(
      { workoutDoc: { first_key: shared, second_key: shared } },
      "WorkoutEx",
    );
    expect(sharedResult.ok).toBe(true);

    const cycle: Record<string, unknown> = {};
    cycle.next = cycle;
    const cyclicResult = encodeRequestBody({ workoutDoc: { cycle } }, "WorkoutEx");
    expect(cyclicResult).toEqual({
      ok: false,
      issues: [
        {
          path: "body.workoutDoc.cycle.next",
          message: "Request body contains a circular reference",
          expected: "acyclic JSON request body",
          received: "circular reference",
        },
      ],
    });
  });

  it("rejects structured class instances instead of bypassing the schema codec", () => {
    class EventBody {
      readonly startDateLocal = "2026-08-07T06:00:00";
      readonly category = "WORKOUT";
    }

    expect(encodeRequestBody(new EventBody(), "EventEx")).toEqual({
      ok: false,
      issues: [
        {
          path: "body",
          message: "Request body field must be a plain JSON object",
          expected: "plain JSON object",
          received: "EventBody",
        },
      ],
    });
  });

  it("preserves explicit undefined on optional structured fields for compatibility", () => {
    expect(encodeRequestBody({ sportInfo: undefined }, "Wellness")).toEqual({
      ok: true,
      value: { sportInfo: undefined },
    });
  });

  it("rejects callable structured bodies even when they define toJSON", () => {
    const body = Object.assign(function eventBody() {}, {
      startDateLocal: "2026-08-07T06:00:00",
      toJSON: () => ({ startDateLocal: "bypass" }),
    });

    expect(encodeRequestBody(body, "EventEx")).toEqual({
      ok: false,
      issues: [
        {
          path: "body",
          message: "Request body field must be a plain JSON object",
          expected: "plain JSON object",
          received: "function",
        },
      ],
    });
  });

  it("shadows inherited toJSON hooks on encoded records and bulk arrays", () => {
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON");
    let encodedJson: string | undefined;
    let bulkJson: string | undefined;

    try {
      Object.defineProperty(Object.prototype, "toJSON", {
        value: () => ({ startDateLocal: "bypass" }),
        configurable: true,
      });
      const encoded = encodeRequestBody({ startDateLocal: "2026-08-07T06:00:00" }, "EventEx");
      const bulk = encodeRequestBody([{ avgSleepingHR: 48 }], "Wellness", true);
      if (!encoded.ok || !bulk.ok) throw new Error("Expected request encoding to succeed");
      encodedJson = JSON.stringify(encoded.value);
      bulkJson = JSON.stringify(bulk.value);
    } finally {
      if (previous === undefined) Reflect.deleteProperty(Object.prototype, "toJSON");
      else Object.defineProperty(Object.prototype, "toJSON", previous);
    }

    expect(encodedJson).toBe('{"start_date_local":"2026-08-07T06:00:00"}');
    expect(bulkJson).toBe('[{"avgSleepingHR":48}]');
  });

  it("rejects callable toJSON hooks before serialization", () => {
    const toJSON = vi.fn(() => ({ startDateLocal: "bypass" }));
    const encoded = encodeRequestBody(
      {
        startDateLocal: "2026-08-07T06:00:00",
        extension: { nested_value: true, toJSON },
      },
      "EventEx",
    );

    expect(encoded).toEqual({
      ok: false,
      issues: [
        {
          path: "body.extension.toJSON",
          message: "Request body cannot contain a callable toJSON serialization hook",
          expected: "JSON data without serialization hooks",
          received: "function",
        },
      ],
    });
    expect(toJSON).not.toHaveBeenCalled();
  });

  it("encodes bulk arrays under one consistent casing contract", () => {
    const encoded = encodeRequestBody(
      [
        { avgSleepingHR: 48, sportInfo: [{ pMax: 1_000 }] },
        { avgSleepingHR: 49, sportInfo: [{ wPrime: 20_000 }] },
      ],
      "Wellness",
      true,
    );

    expect(encoded).toEqual({
      ok: true,
      value: [
        { avgSleepingHR: 48, sportInfo: [{ pMax: 1_000 }] },
        { avgSleepingHR: 49, sportInfo: [{ wPrime: 20_000 }] },
      ],
    });
  });
});

describe("managed mutation integration", () => {
  it("sends canonical bodies using exact wire keys for all managed mutation resources", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      bodies.push((await request.clone().json()) as Record<string, unknown>);

      if (request.url.includes("/events")) {
        return Response.json({
          id: 1,
          start_date_local: "2026-08-07T06:00:00",
          category: "WORKOUT",
          name: "Synthetic",
        });
      }
      return Response.json({ ok: true });
    }) as typeof globalThis.fetch;
    const client = new IntervalsClient({
      apiKey: "synthetic-key",
      athleteId: "synthetic-athlete",
      retry: { maxAttempts: 1 },
      fetch: fetchImpl,
    });

    await client.athlete.update({ activityRpePrompt: true, applyToAll: true });
    await client.events.create({
      startDateLocal: "2026-08-07T06:00:00",
      category: "WORKOUT",
      name: "Synthetic",
    });
    await client.events.create({
      start_date_local: "2026-08-08T06:00:00",
      icu_training_load: 43,
      category: "WORKOUT",
      name: "Legacy wire request",
    });
    await client.wellness.update({ avgSleepingHR: 48, spO2: 98 });
    await client.workouts.create({ fileContentsBase64: "c3ludGhldGlj", icuTrainingLoad: 42 });

    expect(bodies).toEqual([
      { activity_rpe_prompt: true, applyToAll: true },
      {
        start_date_local: "2026-08-07T06:00:00",
        category: "WORKOUT",
        name: "Synthetic",
      },
      {
        start_date_local: "2026-08-08T06:00:00",
        icu_training_load: 43,
        category: "WORKOUT",
        name: "Legacy wire request",
      },
      { avgSleepingHR: 48, spO2: 98 },
      { file_contents_base64: "c3ludGhldGlj", icu_training_load: 42 },
    ]);
  });

  it("returns local Validation with hook cardinality and performs no fetch", async () => {
    const fetchImpl = vi.fn<typeof globalThis.fetch>();
    const onRequest = vi.fn();
    const onError = vi.fn();
    const client = new IntervalsClient({
      apiKey: "synthetic-key",
      athleteId: "synthetic-athlete",
      fetch: fetchImpl,
      hooks: { onRequest, onError },
    });

    const result = await client.events.create({
      startDateLocal: "canonical",
      start_date_local: "wire",
    } as EventInput & EventInputWire);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("Validation");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("does not let an own toJSON hook replace a managed mutation body", async () => {
    const fetchImpl = vi.fn<typeof globalThis.fetch>();
    const toJSON = vi.fn(() => ({ startDateLocal: "bypass" }));
    const client = new IntervalsClient({
      apiKey: "test",
      athleteId: "synthetic-athlete",
      fetch: fetchImpl,
    });

    const result = await client.events.create({
      startDateLocal: "2026-08-07T06:00:00",
      category: "WORKOUT",
      name: "Synthetic",
      toJSON,
    } as EventInput & { toJSON(): unknown });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("Validation");
    expect(toJSON).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
