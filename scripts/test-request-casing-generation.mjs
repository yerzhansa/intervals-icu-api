import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildRequestCasingSchemas, renderRequestCasingSource } from "./request-casing-common.mjs";

test("generates exact mixed-case mappings and opaque dictionary boundaries", () => {
  const document = fixtureDocument({
    EventEx: {
      type: "object",
      properties: {
        avgSleepingHR: { type: "number" },
        start_date_local: { type: "string" },
        workout_doc: {
          type: "object",
          additionalProperties: { type: "object" },
        },
      },
    },
  });

  assert.deepEqual(buildRequestCasingSchemas(document), {
    EventEx: {
      kind: "object",
      properties: {
        avgSleepingHR: { wire: "avgSleepingHR" },
        startDateLocal: { wire: "start_date_local" },
        workoutDoc: {
          wire: "workout_doc",
          value: {
            kind: "dictionary",
            value: { kind: "opaque" },
          },
        },
      },
    },
  });
});

test("fails generation on a canonical property collision", () => {
  const document = fixtureDocument({
    Collision: {
      type: "object",
      properties: {
        fooBar: { type: "number" },
        foo_bar: { type: "string" },
      },
    },
  });

  assert.throws(
    () => buildRequestCasingSchemas(document),
    /Canonical request key collision at #\/components\/schemas\/Collision: "fooBar" and "foo_bar" both map to "fooBar"/,
  );
});

test("renders deterministically and the checked-in snapshot has no collisions", async () => {
  const document = JSON.parse(await readFile(new URL("../openapi.json", import.meta.url), "utf8"));
  const first = renderRequestCasingSource(document);
  const second = renderRequestCasingSource(structuredClone(document));

  assert.equal(first, second);
  const schemas = buildRequestCasingSchemas(document);
  assert.equal(schemas.EventEx.properties.workoutDoc.value.kind, "dictionary");
  assert.equal(schemas.Wellness.properties.avgSleepingHR.wire, "avgSleepingHR");
  assert.equal(schemas.AthleteUpdateDTO.properties.activityRpePrompt.wire, "activity_rpe_prompt");
  assert.equal(schemas.AthleteUpdateDTO.properties.applyToAll.wire, "applyToAll");
});

function fixtureDocument(schemas) {
  const rootName = Object.keys(schemas)[0];
  return {
    openapi: "3.1.0",
    info: { title: "fixture", version: "1" },
    paths: {
      "/fixture": {
        post: {
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/${rootName}` },
              },
            },
          },
        },
      },
    },
    components: { schemas },
  };
}
