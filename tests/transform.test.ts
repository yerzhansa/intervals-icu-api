import { describe, it, expect } from "vitest";
import { toCamelCase, toSnakeCase, camelCaseKeys, snakeCaseKeys } from "../src/transform.js";

describe("toCamelCase", () => {
  it("converts snake_case", () => expect(toCamelCase("start_date_local")).toBe("startDateLocal"));
  it("handles icu_ prefix", () => expect(toCamelCase("icu_training_load")).toBe("icuTrainingLoad"));
  it("leaves camelCase unchanged", () => expect(toCamelCase("startDate")).toBe("startDate"));
  it("handles single word", () => expect(toCamelCase("id")).toBe("id"));
  it("handles multiple underscores", () => expect(toCamelCase("a_b_c_d")).toBe("aBCD"));
  it("handles numbers", () => expect(toCamelCase("zone_1_time")).toBe("zone1Time"));
});

describe("toSnakeCase", () => {
  it("converts camelCase", () => expect(toSnakeCase("startDateLocal")).toBe("start_date_local"));
  it("handles single word", () => expect(toSnakeCase("id")).toBe("id"));
});

describe("camelCaseKeys", () => {
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
});

describe("snakeCaseKeys", () => {
  it("transforms for request bodies", () => {
    expect(snakeCaseKeys({ startDateLocal: "2026-01-01", icuFtp: 280 })).toEqual({
      start_date_local: "2026-01-01",
      icu_ftp: 280,
    });
  });
});
