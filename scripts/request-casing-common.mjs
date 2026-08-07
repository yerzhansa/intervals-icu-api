import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { ROOT_DIR, formatFile, readSnapshot } from "./schema-common.mjs";

export const GENERATED_REQUEST_CASING_PATH = resolve(ROOT_DIR, "src/generated/request-casing.ts");

export function buildRequestCasingSchemas(document) {
  const componentSchemas = document.components?.schemas;
  if (!isRecord(componentSchemas)) {
    throw new Error("OpenAPI document does not contain component schemas");
  }

  assertNoCanonicalPropertyCollisions(componentSchemas);

  const roots = collectRequestSchemaRoots(document);
  const reachable = new Set();
  for (const root of roots) collectReachableSchema(root, componentSchemas, reachable);

  const descriptors = {};
  for (const schemaName of [...reachable].sort()) {
    const descriptor = simplifySchema(
      componentSchemas[schemaName],
      `#/components/schemas/${schemaName}`,
    );
    if (descriptor?.kind === "object") descriptors[schemaName] = descriptor;
  }
  return descriptors;
}

export function renderRequestCasingSource(document) {
  const schemas = buildRequestCasingSchemas(document);
  return `/* eslint-disable */
// This file is generated from openapi.json. Do not edit it by hand.

export const REQUEST_CASING_SCHEMAS = ${JSON.stringify(schemas, null, 2)} as const;

export type RequestCasingSchemaName = keyof typeof REQUEST_CASING_SCHEMAS;
`;
}

export async function generateRequestCasing(outputPath = GENERATED_REQUEST_CASING_PATH) {
  const { document } = await readSnapshot();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderRequestCasingSource(document), "utf8");
  await formatFile(outputPath);
}

function collectRequestSchemaRoots(document) {
  const roots = new Set();
  for (const pathItem of Object.values(document.paths ?? {})) {
    if (!isRecord(pathItem)) continue;
    for (const operation of Object.values(pathItem)) {
      if (!isRecord(operation) || !isRecord(operation.requestBody)) continue;
      collectSchemaReferences(operation.requestBody, roots);
    }
  }
  return roots;
}

function collectSchemaReferences(value, names) {
  if (Array.isArray(value)) {
    for (const item of value) collectSchemaReferences(item, names);
    return;
  }
  if (!isRecord(value)) return;

  const referenceName = getComponentSchemaName(value.$ref);
  if (referenceName !== undefined) names.add(referenceName);
  for (const item of Object.values(value)) collectSchemaReferences(item, names);
}

function collectReachableSchema(schemaName, componentSchemas, reachable) {
  if (reachable.has(schemaName)) return;
  const schema = componentSchemas[schemaName];
  if (!isRecord(schema)) {
    throw new Error(`Request schema references missing component ${JSON.stringify(schemaName)}`);
  }

  reachable.add(schemaName);
  const references = new Set();
  collectSchemaReferences(schema, references);
  for (const reference of references) {
    collectReachableSchema(reference, componentSchemas, reachable);
  }
}

function assertNoCanonicalPropertyCollisions(componentSchemas) {
  for (const [schemaName, schema] of Object.entries(componentSchemas)) {
    walkSchemaObjects(schema, `#/components/schemas/${schemaName}`, (objectSchema, pointer) => {
      const sources = new Map();
      for (const wireKey of Object.keys(objectSchema.properties ?? {})) {
        const canonicalKey = toCanonicalKey(wireKey);
        const previous = sources.get(canonicalKey);
        if (previous !== undefined) {
          throw new Error(
            `Canonical request key collision at ${pointer}: ${JSON.stringify(previous)} and ${JSON.stringify(wireKey)} both map to ${JSON.stringify(canonicalKey)}`,
          );
        }
        sources.set(canonicalKey, wireKey);
      }
    });
  }
}

function walkSchemaObjects(schema, pointer, visit, active = new Set()) {
  if (Array.isArray(schema)) {
    schema.forEach((item, index) => walkSchemaObjects(item, `${pointer}/${index}`, visit, active));
    return;
  }
  if (!isRecord(schema) || active.has(schema)) return;

  active.add(schema);
  try {
    if (isRecord(schema.properties)) visit(schema, pointer);
    for (const [key, value] of Object.entries(schema)) {
      if (key === "$ref") continue;
      walkSchemaObjects(value, `${pointer}/${escapeJsonPointer(key)}`, visit, active);
    }
  } finally {
    active.delete(schema);
  }
}

function simplifySchema(schema, pointer) {
  if (!isRecord(schema)) return undefined;

  const referenceName = getComponentSchemaName(schema.$ref);
  if (referenceName !== undefined) return { kind: "ref", name: referenceName };

  if (schema.type === "array" || schema.items !== undefined) {
    return {
      kind: "array",
      item: simplifySchema(schema.items, `${pointer}/items`) ?? { kind: "opaque" },
    };
  }

  const properties = isRecord(schema.properties) ? schema.properties : undefined;
  const hasExplicitAdditionalProperties = Object.hasOwn(schema, "additionalProperties");
  if (schema.type === "object" || properties || hasExplicitAdditionalProperties) {
    if (!properties && !hasExplicitAdditionalProperties) return { kind: "opaque" };

    if (!properties && hasExplicitAdditionalProperties) {
      return {
        kind: "dictionary",
        value: simplifyAdditionalProperties(
          schema.additionalProperties,
          `${pointer}/additionalProperties`,
        ),
      };
    }

    const descriptor = { kind: "object", properties: {} };
    for (const wireKey of Object.keys(properties ?? {}).sort()) {
      const canonicalKey = toCanonicalKey(wireKey);
      const child = simplifySchema(
        properties[wireKey],
        `${pointer}/properties/${escapeJsonPointer(wireKey)}`,
      );
      descriptor.properties[canonicalKey] = {
        wire: wireKey,
        ...(child === undefined ? {} : { value: child }),
      };
    }

    if (hasExplicitAdditionalProperties) {
      descriptor.additional = simplifyAdditionalProperties(
        schema.additionalProperties,
        `${pointer}/additionalProperties`,
      );
    }
    return descriptor;
  }

  return undefined;
}

function simplifyAdditionalProperties(additionalProperties, pointer) {
  if (additionalProperties === false) return { kind: "opaque" };
  if (additionalProperties === true || !isRecord(additionalProperties)) return { kind: "opaque" };
  return simplifySchema(additionalProperties, pointer) ?? { kind: "opaque" };
}

function getComponentSchemaName(reference) {
  if (typeof reference !== "string") return undefined;
  const prefix = "#/components/schemas/";
  return reference.startsWith(prefix) ? reference.slice(prefix.length) : undefined;
}

function toCanonicalKey(key) {
  return key.replace(/_([a-z0-9])/g, (_match, character) => character.toUpperCase());
}

function escapeJsonPointer(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
