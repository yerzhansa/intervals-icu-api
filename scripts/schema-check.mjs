#!/usr/bin/env node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GENERATED_PATH, generateSchema } from "./schema-common.mjs";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "intervals-icu-api-schema-"));
const temporaryOutput = join(temporaryDirectory, "schema.ts");

try {
  await generateSchema(temporaryOutput);
  const [checkedIn, generated] = await Promise.all([
    readFile(GENERATED_PATH, "utf8"),
    readFile(temporaryOutput, "utf8"),
  ]);

  if (checkedIn !== generated) {
    process.stderr.write("src/generated/schema.ts is stale; run npm run schema:generate\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("OpenAPI snapshot and generated declarations are in sync\n");
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
