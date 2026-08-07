#!/usr/bin/env node

import { GENERATED_PATH, generateSchema } from "./schema-common.mjs";
import { GENERATED_REQUEST_CASING_PATH, generateRequestCasing } from "./request-casing-common.mjs";

await generateSchema();
await generateRequestCasing();
process.stdout.write(`Generated ${GENERATED_PATH}\n`);
process.stdout.write(`Generated ${GENERATED_REQUEST_CASING_PATH}\n`);
