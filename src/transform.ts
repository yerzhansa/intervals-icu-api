type LowerAsciiLetter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

type UpperAsciiLetter = Uppercase<LowerAsciiLetter>;
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type CamelFoldCharacter = LowerAsciiLetter | Digit;

/** Match the runtime `_([a-z0-9])` conversion exactly. */
export type CamelCase<S extends string> = string extends S
  ? string
  : S extends `${infer Prefix}_${infer Character}${infer Rest}`
    ? Character extends CamelFoldCharacter
      ? `${Prefix}${Uppercase<Character>}${CamelCase<Rest>}`
      : `${Prefix}_${CamelCase<`${Character}${Rest}`>}`
    : S;

/** Match the runtime `[A-Z]` conversion exactly. */
export type SnakeCase<S extends string> = string extends S
  ? string
  : S extends `${infer Character}${infer Rest}`
    ? Character extends UpperAsciiLetter
      ? `_${Lowercase<Character>}${SnakeCase<Rest>}`
      : `${Character}${SnakeCase<Rest>}`
    : S;

/** Non-plain object families that TypeScript can distinguish structurally. */
type OpaqueObject =
  | Date
  | RegExp
  | Error
  | Promise<unknown>
  | Map<unknown, unknown>
  | ReadonlyMap<unknown, unknown>
  | Set<unknown>
  | ReadonlySet<unknown>
  | WeakMap<object, unknown>
  | WeakSet<object>
  | ArrayBuffer
  | ArrayBufferView
  | Blob
  | FormData
  | URL
  | URLSearchParams
  | ReadableStream<unknown>;

export type CamelCaseKeys<T> = T extends OpaqueObject | ((...args: never[]) => unknown)
  ? T
  : T extends readonly unknown[]
    ? { [Index in keyof T]: CamelCaseKeys<T[Index]> }
    : T extends object
      ? { [Key in keyof T as Key extends string ? CamelCase<Key> : Key]: CamelCaseKeys<T[Key]> }
      : T;

export type SnakeCaseKeys<T> = T extends OpaqueObject | ((...args: never[]) => unknown)
  ? T
  : T extends readonly unknown[]
    ? { [Index in keyof T]: SnakeCaseKeys<T[Index]> }
    : T extends object
      ? { [Key in keyof T as Key extends string ? SnakeCase<Key> : Key]: SnakeCaseKeys<T[Key]> }
      : T;

export class KeyTransformCollisionError extends Error {
  readonly path: string;
  readonly targetKey: string;
  readonly sourceKeys: readonly [string, string];

  constructor(path: string, targetKey: string, sourceKeys: readonly [string, string]) {
    super(
      `Key transformation collision at ${path}: ${JSON.stringify(sourceKeys[0])} and ${JSON.stringify(sourceKeys[1])} both map to ${JSON.stringify(targetKey)}`,
    );
    this.name = "KeyTransformCollisionError";
    this.path = path;
    this.targetKey = targetKey;
    this.sourceKeys = sourceKeys;
  }
}

export class KeyTransformCycleError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(`Key transformation cannot process a circular reference at ${path}`);
    this.name = "KeyTransformCycleError";
    this.path = path;
  }
}

export class KeyTransformUnsupportedObjectError extends Error {
  readonly path: string;
  readonly objectType: string;

  constructor(path: string, objectType: string) {
    super(
      `Key transformation only accepts plain objects, arrays, and supported opaque values; received ${objectType} at ${path}`,
    );
    this.name = "KeyTransformUnsupportedObjectError";
    this.path = path;
    this.objectType = objectType;
  }
}

export function toCamelCase(str: string): string {
  if (!str.includes("_")) return str;
  return str.replace(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase());
}

/** Lexical helper only. API request bodies require a schema-aware wire encoder. */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);
}

/**
 * Transform arrays and plain-object keys. Supported built-in opaque values are preserved;
 * arbitrary class instances are rejected because TypeScript cannot distinguish their
 * structurally public instance type from an equivalent named interface.
 */
export function camelCaseKeys<T>(obj: T): CamelCaseKeys<T> {
  return transformKeys(obj, toCamelCase) as CamelCaseKeys<T>;
}

/**
 * Lexically transform arrays and plain-object keys. This is not a safe Intervals.icu request
 * encoder because the upstream schemas intentionally contain a mixture of snake_case and
 * camelCase keys. Arbitrary class instances are rejected; supported built-in opaque values
 * are preserved.
 */
export function snakeCaseKeys<T>(obj: T): SnakeCaseKeys<T> {
  return transformKeys(obj, toSnakeCase) as SnakeCaseKeys<T>;
}

export function isPlainJsonRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function transformKeys(
  obj: unknown,
  transform: (key: string) => string,
  path = "$",
  active = new WeakSet<object>(),
): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    enterObject(obj, path, active);
    try {
      return obj.map((item, index) => transformKeys(item, transform, `${path}[${index}]`, active));
    } finally {
      active.delete(obj);
    }
  }

  if (typeof obj !== "object") return obj;
  if (isSupportedOpaqueValue(obj)) return obj;
  if (!isPlainJsonRecord(obj)) {
    throw new KeyTransformUnsupportedObjectError(path, getObjectType(obj));
  }

  enterObject(obj, path, active);
  try {
    const result: Record<string, unknown> = {};
    const sources = new Map<string, string>();

    for (const [sourceKey, value] of Object.entries(obj)) {
      const targetKey = transform(sourceKey);
      const previousSource = sources.get(targetKey);
      if (previousSource !== undefined) {
        throw new KeyTransformCollisionError(path, targetKey, [previousSource, sourceKey]);
      }
      sources.set(targetKey, sourceKey);
      defineOwnDataProperty(
        result,
        targetKey,
        transformKeys(value, transform, appendPath(path, targetKey), active),
      );
    }

    return result;
  } finally {
    active.delete(obj);
  }
}

function isSupportedOpaqueValue(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null) return false;

  return (
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Error ||
    value instanceof Promise ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof WeakMap ||
    value instanceof WeakSet ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    (typeof Blob !== "undefined" && value instanceof Blob) ||
    (typeof FormData !== "undefined" && value instanceof FormData) ||
    (typeof URL !== "undefined" && value instanceof URL) ||
    (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) ||
    (typeof ReadableStream !== "undefined" && value instanceof ReadableStream)
  );
}

function getObjectType(value: object): string {
  const prototype = Object.getPrototypeOf(value) as object | null;
  const constructor =
    prototype === null
      ? undefined
      : Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
  const constructorName = typeof constructor === "function" ? constructor.name : undefined;
  return constructorName && constructorName.length > 0 ? constructorName : "non-plain object";
}

function enterObject(value: object, path: string, active: WeakSet<object>): void {
  if (active.has(value)) throw new KeyTransformCycleError(path);
  active.add(value);
}

export function defineOwnDataProperty(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function appendPath(path: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}
