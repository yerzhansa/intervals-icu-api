import { describe, it, expect, expectTypeOf } from "vitest";
import {
  KeyTransformCollisionError,
  KeyTransformCycleError,
  KeyTransformUnsupportedObjectError,
  toCamelCase,
  toSnakeCase,
  camelCaseKeys,
  snakeCaseKeys,
  type CamelCase,
  type SnakeCase,
} from "../src/transform.js";

describe("toCamelCase", () => {
  it("converts snake_case", () => expect(toCamelCase("start_date_local")).toBe("startDateLocal"));
  it("handles icu_ prefix", () => expect(toCamelCase("icu_training_load")).toBe("icuTrainingLoad"));
  it("leaves camelCase unchanged", () => expect(toCamelCase("startDate")).toBe("startDate"));
  it("handles single word", () => expect(toCamelCase("id")).toBe("id"));
  it("handles multiple underscores", () => expect(toCamelCase("a_b_c_d")).toBe("aBCD"));
  it("handles numbers", () => expect(toCamelCase("zone_1_time")).toBe("zone1Time"));
  it("matches the type helper for unmatched underscores", () => {
    expect(toCamelCase("one__two_A")).toBe("one_Two_A");
    expectTypeOf<CamelCase<"one__two_A">>().toEqualTypeOf<"one_Two_A">();
  });
});

describe("toSnakeCase", () => {
  it("converts camelCase", () => expect(toSnakeCase("startDateLocal")).toBe("start_date_local"));
  it("handles single word", () => expect(toSnakeCase("id")).toBe("id"));
  it("uses lexical acronym conversion at runtime and in types", () => {
    expect(toSnakeCase("avgSleepingHR")).toBe("avg_sleeping_h_r");
    expectTypeOf<SnakeCase<"avgSleepingHR">>().toEqualTypeOf<"avg_sleeping_h_r">();
  });
});

describe("camelCaseKeys", () => {
  it("recurses through named interface types consistently with plain-object runtime values", () => {
    interface NamedWireValue {
      readonly start_date_local: string;
      nested_value?: {
        inner_key: number;
      };
    }

    const input: NamedWireValue = {
      start_date_local: "2026-01-01",
      nested_value: { inner_key: 42 },
    };
    const result = camelCaseKeys(input);

    expectTypeOf(result).toEqualTypeOf<{
      readonly startDateLocal: string;
      nestedValue?: { innerKey: number };
    }>();
    expect(result).toEqual({
      startDateLocal: "2026-01-01",
      nestedValue: { innerKey: 42 },
    });
  });

  it("transforms flat object", () => {
    expect(camelCaseKeys({ start_date_local: "2026-01-01", icu_ftp: 280 })).toEqual({
      startDateLocal: "2026-01-01",
      icuFtp: 280,
    });
  });

  it("transforms nested objects", () => {
    expect(camelCaseKeys({ outer_key: { inner_key: 1 } })).toEqual({
      outerKey: { innerKey: 1 },
    });
  });

  it("transforms arrays of objects", () => {
    expect(camelCaseKeys([{ my_key: 1 }, { my_key: 2 }])).toEqual([{ myKey: 1 }, { myKey: 2 }]);
  });

  it("handles null and undefined", () => {
    expect(camelCaseKeys(null)).toBe(null);
    expect(camelCaseKeys(undefined)).toBe(undefined);
  });

  it("preserves Date objects", () => {
    const d = new Date("2026-01-01");
    expect(camelCaseKeys({ my_date: d })).toEqual({ myDate: d });
  });

  it("handles empty object", () => {
    expect(camelCaseKeys({})).toEqual({});
  });

  it("preserves readonly tuple structure in its return type", () => {
    const input = [{ my_key: 1 }, { other_key: "two" }] as const;
    const result = camelCaseKeys(input);

    expectTypeOf(result).toEqualTypeOf<
      readonly [{ readonly myKey: 1 }, { readonly otherKey: "two" }]
    >();
    expect(result).toEqual([{ myKey: 1 }, { otherKey: "two" }]);
  });

  it("preserves supported opaque values and rejects arbitrary class instances", () => {
    class DomainValue {
      constructor(readonly snake_key: number) {}
    }
    const map = new Map([["snake_key", 1]]);
    const set = new Set(["snake_key"]);
    const domain = new DomainValue(1);

    const result = camelCaseKeys({ map_value: map, set_value: set });

    expectTypeOf(result.mapValue).toEqualTypeOf<Map<string, number>>();
    expectTypeOf(result.setValue).toEqualTypeOf<Set<string>>();
    expect(result.mapValue).toBe(map);
    expect(result.setValue).toBe(set);
    expect(() => camelCaseKeys({ domain_value: domain })).toThrowError(
      KeyTransformUnsupportedObjectError,
    );
    try {
      camelCaseKeys({ domain_value: domain });
    } catch (error) {
      expect(error).toMatchObject({ path: "$.domainValue", objectType: "DomainValue" });
    }
  });

  it("works when optional web-platform constructors are unavailable", () => {
    const optionalGlobals = [
      "Blob",
      "FormData",
      "URL",
      "URLSearchParams",
      "ReadableStream",
    ] as const;
    const descriptors = optionalGlobals.map(
      (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
    );

    try {
      for (const name of optionalGlobals) Reflect.deleteProperty(globalThis, name);
      expect(camelCaseKeys({ outer_key: { inner_key: 1 } })).toEqual({
        outerKey: { innerKey: 1 },
      });
    } finally {
      for (const [name, descriptor] of descriptors) {
        if (descriptor !== undefined) Object.defineProperty(globalThis, name, descriptor);
      }
    }
  });

  it("rejects collisions instead of applying insertion-order precedence", () => {
    const input = { foo_bar: 1, fooBar: 2 };

    expect(() => camelCaseKeys(input)).toThrowError(KeyTransformCollisionError);
    try {
      camelCaseKeys(input);
    } catch (error) {
      expect(error).toMatchObject({
        path: "$",
        targetKey: "fooBar",
        sourceKeys: ["foo_bar", "fooBar"],
      });
    }
  });

  it("reports nested cycles but permits shared non-cyclic references", () => {
    const shared = { inner_key: 1 };
    expect(camelCaseKeys({ first_value: shared, second_value: shared })).toEqual({
      firstValue: { innerKey: 1 },
      secondValue: { innerKey: 1 },
    });

    const cyclic: Record<string, unknown> = {};
    cyclic.self_value = cyclic;
    expect(() => camelCaseKeys(cyclic)).toThrowError(KeyTransformCycleError);
    try {
      camelCaseKeys(cyclic);
    } catch (error) {
      expect(error).toMatchObject({ path: "$.selfValue" });
    }
  });

  it("keeps a normal prototype when transforming an own __proto__ key", () => {
    const input = JSON.parse('{"__proto__":{"polluted_value":true}}') as Record<string, unknown>;
    const result = camelCaseKeys(input) as Record<string, unknown>;

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.hasOwn(result, "_Proto__")).toBe(true);
    expect(result._Proto__).toEqual({ pollutedValue: true });
    expect(({} as Record<string, unknown>).pollutedValue).toBeUndefined();
  });
});

describe("snakeCaseKeys", () => {
  it("recurses through named interface types consistently with plain-object runtime values", () => {
    interface NamedCanonicalValue {
      readonly startDateLocal: string;
      nestedValue?: {
        innerKey: number;
      };
    }

    const input: NamedCanonicalValue = {
      startDateLocal: "2026-01-01",
      nestedValue: { innerKey: 42 },
    };
    const result = snakeCaseKeys(input);

    expectTypeOf(result).toEqualTypeOf<{
      readonly start_date_local: string;
      nested_value?: { inner_key: number };
    }>();
    expect(result).toEqual({
      start_date_local: "2026-01-01",
      nested_value: { inner_key: 42 },
    });
  });

  it("transforms for request bodies", () => {
    const result = snakeCaseKeys({ startDateLocal: "2026-01-01", icuFtp: 280 });
    expectTypeOf(result).toEqualTypeOf<{ start_date_local: string; icu_ftp: number }>();
    expect(result).toEqual({
      start_date_local: "2026-01-01",
      icu_ftp: 280,
    });
  });

  it("defines an own __proto__ data property without changing the result prototype", () => {
    const input = JSON.parse('{"__proto__":{"pollutedValue":true}}') as Record<string, unknown>;
    const result = snakeCaseKeys(input) as Record<string, unknown>;

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(result.__proto__).toEqual({ polluted_value: true });
    expect(({} as Record<string, unknown>).polluted_value).toBeUndefined();
  });

  it("uses the same collision-safe recursion as camelCaseKeys", () => {
    expect(() => snakeCaseKeys({ fooBar: 1, foo_bar: 2 })).toThrowError(KeyTransformCollisionError);
  });
});
