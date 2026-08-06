#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import {
  SNAPSHOT_PATH,
  fetchUpstream,
  formatFile,
  sha256,
  writeAtomically,
} from "./schema-common.mjs";

const { contents } = await fetchUpstream();
await writeAtomically(SNAPSHOT_PATH, contents);
await formatFile(SNAPSHOT_PATH);
const formattedContents = await readFile(SNAPSHOT_PATH, "utf8");

process.stdout.write(`Updated openapi.json (${sha256(formattedContents)})\n`);
