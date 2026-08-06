#!/usr/bin/env node

import assert from "node:assert/strict";
import test from "node:test";

import { compareSchemaFields, createDriftReport } from "./schema-upstream-diff.mjs";

function reverseKeyOrder(value) {
  if (Array.isArray(value)) return value.map(reverseKeyOrder);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, item]) => [key, reverseKeyOrder(item)]),
  );
}

const before = {
  openapi: "3.0.1",
  paths: {
    "/z": { get: { summary: "Before" } },
    "/removed": { post: { summary: "Removed" } },
  },
  components: {
    schemas: {
      Beta: { type: "object", properties: { value: { type: "number" } } },
      Alpha: {
        type: "object",
        required: ["z"],
        properties: {
          z: { type: "string" },
          old: { type: "number" },
          modified: { type: "string" },
        },
      },
    },
  },
};

const after = {
  openapi: "3.0.1",
  paths: {
    "/added": { get: { summary: "Added" } },
    "/z": {
      get: { summary: "After" },
      put: { summary: "Added to existing path" },
    },
  },
  components: {
    schemas: {
      Gamma: { type: "object", properties: { value: { type: "boolean" } } },
      Alpha: {
        type: "object",
        required: ["a"],
        properties: {
          modified: { type: "number" },
          a: { type: "boolean" },
          z: { type: "string" },
        },
      },
    },
  },
};

test("categorizes endpoint, operation, schema, property, and required-field drift", () => {
  assert.deepEqual(compareSchemaFields(before.components.schemas, after.components.schemas), [
    {
      name: "Alpha",
      properties: { added: ["a"], removed: ["old"], changed: ["modified"] },
      required: { added: ["a"], removed: ["z"] },
    },
  ]);

  const report = createDriftReport(before, after, "https://example.test/openapi");
  assert.match(report, /## Paths[\s\S]*### Added \(1\)[\s\S]*`\/added`/);
  assert.match(report, /## Operations[\s\S]*### Added \(2\)[\s\S]*`GET \/added`[\s\S]*`PUT \/z`/);
  assert.match(report, /## Operations[\s\S]*### Removed \(1\)[\s\S]*`POST \/removed`/);
  assert.match(report, /## Operations[\s\S]*### Changed \(1\)[\s\S]*`GET \/z`/);
  assert.match(report, /## Component schemas[\s\S]*### Added \(1\)[\s\S]*`Gamma`/);
  assert.match(report, /## Component schemas[\s\S]*### Removed \(1\)[\s\S]*`Beta`/);
  assert.match(report, /## Component schemas[\s\S]*### Changed \(1\)[\s\S]*`Alpha`/);
  assert.match(report, /Added properties \(1\): `a`/);
  assert.match(report, /Removed properties \(1\): `old`/);
  assert.match(report, /Changed properties \(1\): `modified`/);
  assert.match(report, /Required fields added \(1\): `a`/);
  assert.match(report, /Required fields removed \(1\): `z`/);
});

test("produces deterministic output independent of object insertion order", () => {
  const report = createDriftReport(before, after);
  assert.equal(createDriftReport(before, after), report);
  assert.equal(createDriftReport(reverseKeyOrder(before), reverseKeyOrder(after)), report);
});
