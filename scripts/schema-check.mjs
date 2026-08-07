#!/usr/bin/env node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GENERATED_PATH, generateSchema } from "./schema-common.mjs";
import { GENERATED_REQUEST_CASING_PATH, generateRequestCasing } from "./request-casing-common.mjs";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "intervals-icu-api-schema-"));
const temporaryOutput = join(temporaryDirectory, "schema.ts");
const temporaryRequestCasingOutput = join(temporaryDirectory, "request-casing.ts");

try {
  await Promise.all([
    generateSchema(temporaryOutput),
    generateRequestCasing(temporaryRequestCasingOutput),
  ]);
  const [checkedIn, generated, checkedInRequestCasing, generatedRequestCasing] = await Promise.all([
    readFile(GENERATED_PATH, "utf8"),
    readFile(temporaryOutput, "utf8"),
    readFile(GENERATED_REQUEST_CASING_PATH, "utf8"),
    readFile(temporaryRequestCasingOutput, "utf8"),
  ]);

  const stale = [];
  if (checkedIn !== generated) stale.push("src/generated/schema.ts");
  if (checkedInRequestCasing !== generatedRequestCasing) {
    stale.push("src/generated/request-casing.ts");
  }

  if (stale.length > 0) {
    process.stderr.write(`${stale.join(", ")} stale; run npm run schema:generate\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("OpenAPI snapshot, declarations, and request casing are in sync\n");
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
