import {
  REQUEST_CASING_SCHEMAS,
  type RequestCasingSchemaName,
} from "./generated/request-casing.js";
import type { ValidationIssue } from "./result.js";
import { defineOwnDataProperty, isPlainJsonRecord } from "./transform.js";

type CasingStyle = "camelCase" | "wire";

type CasingNode =
  | { readonly kind: "opaque" }
  | { readonly kind: "ref"; readonly name: string }
  | { readonly kind: "array"; readonly item: CasingNode }
  | { readonly kind: "dictionary"; readonly value: CasingNode }
  | ObjectCasingNode;

interface ObjectCasingNode {
  readonly kind: "object";
  readonly properties: Readonly<
    Record<string, { readonly wire: string; readonly value?: CasingNode }>
  >;
  readonly additional?: CasingNode;
}

type RequestCasingSchemas = Readonly<Record<string, ObjectCasingNode>>;

export type RequestBodyEncoding<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

interface EncodingContext {
  readonly active: WeakSet<object>;
  style?: CasingStyle;
  styleSource?: { readonly key: string; readonly path: string };
}

class RequestBodyEncodingError extends Error {
  constructor(readonly issue: ValidationIssue) {
    super(issue.message);
    this.name = "RequestBodyEncodingError";
  }
}

const schemas = REQUEST_CASING_SCHEMAS as unknown as RequestCasingSchemas;
const wirePropertyIndexes = new WeakMap<
  ObjectCasingNode,
  ReadonlyMap<string, readonly [canonicalKey: string, property: ObjectProperty]>
>();

type ObjectProperty = ObjectCasingNode["properties"][string];

/** Convert a canonical managed JSON body to the exact mixed-case Intervals.icu wire schema. */
export function encodeRequestBody<TWire>(
  body: unknown,
  schemaName: RequestCasingSchemaName,
  array = false,
): RequestBodyEncoding<TWire> {
  const schema = getSchema(schemaName);
  if (schema === undefined) {
    return {
      ok: false,
      issues: [
        {
          path: "body",
          message: `No request casing schema is available for ${schemaName}`,
          expected: "generated request casing schema",
          received: schemaName,
        },
      ],
    };
  }

  const context: EncodingContext = { active: new WeakSet() };
  const rootNode: CasingNode = array ? { kind: "array", item: schema } : schema;
  try {
    return { ok: true, value: encodeNode(body, rootNode, "body", context) as TWire };
  } catch (error) {
    if (error instanceof RequestBodyEncodingError) {
      return { ok: false, issues: [error.issue] };
    }
    throw error;
  }
}

function encodeNode(
  value: unknown,
  node: CasingNode,
  path: string,
  context: EncodingContext,
): unknown {
  switch (node.kind) {
    case "ref": {
      const referenced = getSchema(node.name);
      return referenced === undefined
        ? cloneOpaque(value, path, context)
        : encodeNode(value, referenced, path, context);
    }
    case "array":
      if (!Array.isArray(value)) return cloneOpaque(value, path, context);
      return encodeArray(value, node.item, path, context);
    case "object":
      if (!isPlainJsonRecord(value)) return cloneOpaque(value, path, context);
      return encodeObject(value, node, path, context);
    case "dictionary":
      if (!isPlainJsonRecord(value)) return cloneOpaque(value, path, context);
      return encodeDictionary(value, node.value, path, context);
    case "opaque":
      return cloneOpaque(value, path, context);
  }
}

function getSchema(name: string): ObjectCasingNode | undefined {
  return Object.hasOwn(schemas, name) ? schemas[name] : undefined;
}

function encodeArray(
  value: readonly unknown[],
  itemNode: CasingNode,
  path: string,
  context: EncodingContext,
): unknown[] {
  enter(value, path, context);
  try {
    return value.map((item, index) => encodeNode(item, itemNode, `${path}.${index}`, context));
  } finally {
    context.active.delete(value);
  }
}

function encodeObject(
  value: Record<string, unknown>,
  node: ObjectCasingNode,
  path: string,
  context: EncodingContext,
): Record<string, unknown> {
  enter(value, path, context);
  try {
    const output: Record<string, unknown> = {};
    const targetSources = new Map<string, string>();
    const wireIndex = getWirePropertyIndex(node);

    for (const [sourceKey, sourceValue] of Object.entries(value)) {
      const canonicalMatch = Object.hasOwn(node.properties, sourceKey)
        ? node.properties[sourceKey]
        : undefined;
      const wireMatch = wireIndex.get(sourceKey);
      const canonicalKey = canonicalMatch === undefined ? wireMatch?.[0] : sourceKey;
      const property = canonicalMatch ?? wireMatch?.[1];

      if (property === undefined || canonicalKey === undefined) {
        defineOwnDataProperty(
          output,
          sourceKey,
          node.additional === undefined
            ? cloneOpaque(sourceValue, appendPath(path, sourceKey), context)
            : encodeNode(sourceValue, node.additional, appendPath(path, sourceKey), context),
        );
        continue;
      }

      const targetKey = property.wire;
      const previousSource = targetSources.get(targetKey);
      if (previousSource !== undefined) {
        fail({
          path: appendPath(path, canonicalKey),
          message: `Request keys ${JSON.stringify(previousSource)} and ${JSON.stringify(sourceKey)} both map to wire key ${JSON.stringify(targetKey)}`,
          expected: "one request alias per field",
          received: [previousSource, sourceKey],
        });
      }
      targetSources.set(targetKey, sourceKey);

      if (sourceKey !== targetKey) {
        selectStyle("camelCase", sourceKey, appendPath(path, canonicalKey), context);
      } else if (canonicalKey !== targetKey) {
        selectStyle("wire", sourceKey, appendPath(path, canonicalKey), context);
      }

      defineOwnDataProperty(
        output,
        targetKey,
        property.value === undefined
          ? cloneOpaque(sourceValue, appendPath(path, canonicalKey), context)
          : encodeNode(sourceValue, property.value, appendPath(path, canonicalKey), context),
      );
    }

    return output;
  } finally {
    context.active.delete(value);
  }
}

function encodeDictionary(
  value: Record<string, unknown>,
  valueNode: CasingNode,
  path: string,
  context: EncodingContext,
): Record<string, unknown> {
  enter(value, path, context);
  try {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      defineOwnDataProperty(
        output,
        key,
        encodeNode(item, valueNode, appendPath(path, key), context),
      );
    }
    return output;
  } finally {
    context.active.delete(value);
  }
}

function cloneOpaque(value: unknown, path: string, context: EncodingContext): unknown {
  if (Array.isArray(value)) {
    enter(value, path, context);
    try {
      return value.map((item, index) => cloneOpaque(item, `${path}.${index}`, context));
    } finally {
      context.active.delete(value);
    }
  }

  if (!isPlainJsonRecord(value)) return value;

  enter(value, path, context);
  try {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      defineOwnDataProperty(output, key, cloneOpaque(item, appendPath(path, key), context));
    }
    return output;
  } finally {
    context.active.delete(value);
  }
}

function selectStyle(
  style: CasingStyle,
  key: string,
  path: string,
  context: EncodingContext,
): void {
  if (context.style === undefined) {
    context.style = style;
    context.styleSource = { key, path };
    return;
  }
  if (context.style === style) return;

  fail({
    path,
    message: "Request body mixes canonical camelCase and legacy wire-cased field names",
    expected: `${context.style} request body`,
    received: {
      first: context.styleSource,
      conflicting: { key, path },
    },
  });
}

function enter(value: object, path: string, context: EncodingContext): void {
  if (context.active.has(value)) {
    fail({
      path,
      message: "Request body contains a circular reference",
      expected: "acyclic JSON request body",
      received: "circular reference",
    });
  }
  context.active.add(value);
}

function getWirePropertyIndex(
  node: ObjectCasingNode,
): ReadonlyMap<string, readonly [canonicalKey: string, property: ObjectProperty]> {
  const cached = wirePropertyIndexes.get(node);
  if (cached !== undefined) return cached;

  const index = new Map<string, readonly [string, ObjectProperty]>();
  for (const [canonicalKey, property] of Object.entries(node.properties)) {
    index.set(property.wire, [canonicalKey, property]);
  }
  wirePropertyIndexes.set(node, index);
  return index;
}

function fail(issue: ValidationIssue): never {
  throw new RequestBodyEncodingError(issue);
}

function appendPath(path: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}
