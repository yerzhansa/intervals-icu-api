#!/usr/bin/env node

import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ROOT_DIR,
  UPSTREAM_URL,
  fetchUpstream,
  normalizeJson,
  readSnapshot,
  sha256,
  writeAtomically,
} from "./schema-common.mjs";

const HTTP_METHODS = new Set(["delete", "get", "head", "options", "patch", "post", "put", "trace"]);

function entries(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value) : [];
}

function fingerprint(value) {
  return JSON.stringify(normalizeJson(value));
}

export function compareMaps(before, after) {
  const beforeMap = new Map(entries(before));
  const afterMap = new Map(entries(after));
  const added = [...afterMap.keys()].filter((key) => !beforeMap.has(key)).sort();
  const removed = [...beforeMap.keys()].filter((key) => !afterMap.has(key)).sort();
  const changed = [...beforeMap.keys()]
    .filter(
      (key) =>
        afterMap.has(key) && fingerprint(beforeMap.get(key)) !== fingerprint(afterMap.get(key)),
    )
    .sort();
  return { added, removed, changed };
}

function operations(document) {
  const output = {};
  for (const [path, pathItem] of entries(document.paths)) {
    for (const [method, operation] of entries(pathItem)) {
      if (HTTP_METHODS.has(method.toLowerCase())) {
        output[`${method.toUpperCase()} ${path}`] = operation;
      }
    }
  }
  return output;
}

function compareStringLists(before, after) {
  const beforeSet = new Set(
    Array.isArray(before) ? before.filter((item) => typeof item === "string") : [],
  );
  const afterSet = new Set(
    Array.isArray(after) ? after.filter((item) => typeof item === "string") : [],
  );
  return {
    added: [...afterSet].filter((item) => !beforeSet.has(item)).sort(),
    removed: [...beforeSet].filter((item) => !afterSet.has(item)).sort(),
  };
}

export function compareSchemaFields(beforeSchemas, afterSchemas) {
  const beforeMap = new Map(entries(beforeSchemas));
  const afterMap = new Map(entries(afterSchemas));
  const changes = [];

  for (const name of [...beforeMap.keys()].filter((key) => afterMap.has(key)).sort()) {
    const before = beforeMap.get(name);
    const after = afterMap.get(name);
    const properties = compareMaps(before?.properties, after?.properties);
    const required = compareStringLists(before?.required, after?.required);
    const changeCount =
      properties.added.length +
      properties.removed.length +
      properties.changed.length +
      required.added.length +
      required.removed.length;

    if (changeCount > 0) {
      changes.push({ name, properties, required });
    }
  }

  return changes;
}

function markdownList(values) {
  return values.length === 0
    ? "_None._"
    : values.map((value) => `- \`${String(value).replaceAll("`", "\\`")}\``).join("\n");
}

function section(title, comparison) {
  return [
    `## ${title}`,
    "",
    `### Added (${comparison.added.length})`,
    "",
    markdownList(comparison.added),
    "",
    `### Removed (${comparison.removed.length})`,
    "",
    markdownList(comparison.removed),
    "",
    `### Changed (${comparison.changed.length})`,
    "",
    markdownList(comparison.changed),
  ].join("\n");
}

function inlineMarkdownList(values) {
  return values.length === 0
    ? "_None._"
    : values.map((value) => `\`${String(value).replaceAll("`", "\\`")}\``).join(", ");
}

function schemaFieldSection(changes) {
  const contents = changes.map(({ name, properties, required }) =>
    [
      `### \`${String(name).replaceAll("`", "\\`")}\``,
      "",
      `- Added properties (${properties.added.length}): ${inlineMarkdownList(properties.added)}`,
      `- Removed properties (${properties.removed.length}): ${inlineMarkdownList(properties.removed)}`,
      `- Changed properties (${properties.changed.length}): ${inlineMarkdownList(properties.changed)}`,
      `- Required fields added (${required.added.length}): ${inlineMarkdownList(required.added)}`,
      `- Required fields removed (${required.removed.length}): ${inlineMarkdownList(required.removed)}`,
    ].join("\n"),
  );

  return [
    "## Component schema field changes",
    "",
    contents.length === 0 ? "_No property or required-field changes._" : contents.join("\n\n"),
  ].join("\n");
}

function readOutputArgument(argv) {
  const index = argv.indexOf("--output");
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error("--output requires a file path");
  }
  return resolve(ROOT_DIR, value);
}

export function createDriftReport(checked, live, source = UPSTREAM_URL) {
  const pathDiff = compareMaps(checked.paths, live.paths);
  const operationDiff = compareMaps(operations(checked), operations(live));
  const beforeSchemas = checked.components?.schemas;
  const afterSchemas = live.components?.schemas;
  const schemaDiff = compareMaps(beforeSchemas, afterSchemas);
  const schemaFieldDiff = compareSchemaFields(beforeSchemas, afterSchemas);
  const driftCount = [pathDiff, operationDiff, schemaDiff].reduce(
    (count, item) => count + item.added.length + item.removed.length + item.changed.length,
    0,
  );

  return [
    "# Intervals.icu OpenAPI upstream drift",
    "",
    `Source: ${source}`,
    "",
    `- Checked semantic SHA-256: \`${sha256(fingerprint(checked))}\``,
    `- Live semantic SHA-256: \`${sha256(fingerprint(live))}\``,
    `- Categorized changes: **${driftCount}**`,
    "",
    section("Paths", pathDiff),
    "",
    section("Operations", operationDiff),
    "",
    section("Component schemas", schemaDiff),
    "",
    schemaFieldSection(schemaFieldDiff),
    "",
  ].join("\n");
}

async function main() {
  const [{ document: checked }, live] = await Promise.all([readSnapshot(), fetchUpstream()]);
  const report = createDriftReport(checked, live.document);
  const outputPath = readOutputArgument(process.argv.slice(2));

  if (outputPath) {
    await writeAtomically(outputPath, report);
    process.stdout.write(`Wrote ${outputPath}\n`);
  } else {
    process.stdout.write(report);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, report, "utf8");
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await main();
}
