#!/usr/bin/env node

import { GENERATED_PATH, generateSchema } from "./schema-common.mjs";

await generateSchema();
process.stdout.write(`Generated ${GENERATED_PATH}\n`);
