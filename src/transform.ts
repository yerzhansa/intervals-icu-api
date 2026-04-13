export type CamelCase<S extends string> = S extends `${infer P}_${infer C}${infer R}`
  ? `${P}${Uppercase<C>}${CamelCase<R>}`
  : S;

export type CamelCaseKeys<T> = T extends (infer U)[]
  ? CamelCaseKeys<U>[]
  : T extends object
    ? { [K in keyof T as K extends string ? CamelCase<K> : K]: CamelCaseKeys<T[K]> }
    : T;

export function toCamelCase(str: string): string {
  if (!str.includes("_")) return str;
  return str.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function camelCaseKeys<T>(obj: T): CamelCaseKeys<T> {
  return transformKeys(obj, toCamelCase) as CamelCaseKeys<T>;
}

export function snakeCaseKeys<T>(obj: T): T {
  return transformKeys(obj, toSnakeCase) as T;
}

function transformKeys(obj: unknown, fn: (key: string) => string): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((item) => transformKeys(item, fn));
  if (obj instanceof Date) return obj;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.hasOwn(obj as object, key)) {
        result[fn(key)] = transformKeys((obj as Record<string, unknown>)[key], fn);
      }
    }
    return result;
  }
  return obj;
}
