import { describe, expect, it } from "vitest";
import {
  calculateEfficiencyFactorDecoupling,
  normalizeActivityStreams,
} from "../src/analysis/activity-streams.js";
import type { ActivityStream } from "../src/schemas/activity-stream.js";

function stream(type: string, data: unknown[], data2?: unknown[]): ActivityStream {
  return { type, data, ...(data2 === undefined ? {} : { data2 }) };
}

describe("normalizeActivityStreams", () => {
  it("preserves custom and duplicate descriptors without last-write-wins data loss", () => {
    const descriptors = [
      stream("time", [0, 1, 2, 3]),
      stream("watts", [100, 110, 120, 130]),
      stream("athlete_custom", [1, 2, 3, 4]),
      stream("athlete_custom", [5, 6, 7, 8]),
    ];

    const normalized = normalizeActivityStreams(descriptors);

    expect(normalized.descriptors).toHaveLength(4);
    expect(normalized.byType.get("athlete_custom")).toHaveLength(2);
    expect(normalized.sampleCounts.get("athlete_custom")).toEqual([4, 4]);
    expect(normalized.issues).toContainEqual({
      kind: "DuplicateType",
      type: "athlete_custom",
      count: 2,
    });
    expect(normalized.getUnique("watts")).toEqual({ ok: true, value: descriptors[1] });
    expect(normalized.getUnique("missing")).toEqual({
      ok: false,
      error: { kind: "MissingStream", type: "missing" },
    });
    expect(normalized.getUnique("athlete_custom")).toEqual({
      ok: false,
      error: { kind: "DuplicateStream", type: "athlete_custom", count: 2 },
    });
  });

  it("reports paired and cross-stream length mismatches explicitly", () => {
    const normalized = normalizeActivityStreams([
      stream("time", [0, 1, 2, 3]),
      stream("latlng", [43.1, 43.2, 43.3, 43.4], [76.1, 76.2, 76.3]),
      stream("heartrate", [120, 125, 130]),
    ]);

    expect(normalized.issues).toContainEqual({
      kind: "Data2LengthMismatch",
      type: "latlng",
      descriptorIndex: 1,
      dataLength: 4,
      data2Length: 3,
    });
    expect(normalized.issues).toContainEqual({
      kind: "SampleCountMismatch",
      type: "heartrate",
      descriptorIndex: 2,
      expected: 4,
      actual: 3,
      referenceType: "time",
    });
  });
});

describe("calculateEfficiencyFactorDecoupling", () => {
  it("weights irregular samples by duration and splits samples at the time midpoint", () => {
    const result = calculateEfficiencyFactorDecoupling(
      [
        stream("time", [0, 1, 3, 6]),
        stream("watts", [100, 200, 300, 400]),
        stream("heartrate", [100, 100, 100, 200]),
        stream("moving", [true, true, true, true]),
      ],
      { outputStream: "watts" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.firstHalf.durationSeconds).toBe(4);
    expect(result.value.firstHalf.outputMean).toBe(200);
    expect(result.value.firstHalf.heartRateMean).toBe(100);
    expect(result.value.secondHalf.durationSeconds).toBe(4);
    expect(result.value.secondHalf.outputMean).toBe(350);
    expect(result.value.secondHalf.heartRateMean).toBe(150);
    expect(result.value.decouplingPercent).toBeCloseTo(-16.666_666, 5);
    expect(result.value.coverage.fraction).toBe(1);
  });

  it("excludes null, non-finite, stopped, and nonpositive-HR samples from coverage", () => {
    const result = calculateEfficiencyFactorDecoupling(
      [
        stream("time", [0, 1, 2, 3, 4, 5]),
        stream("velocity_smooth", [1, 2, null, 3, 4, Number.NaN]),
        stream("heartrate", [100, 100, 100, 100, 0, 100]),
        stream("moving", [true, true, true, false, true, true]),
      ],
      {
        outputStream: "velocity_smooth",
        startSeconds: 0,
        endSeconds: 6,
        splitFraction: 0.5,
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContainEqual({ kind: "NoUsableSamples", half: "second" });
    }
  });

  it("supports a custom numeric output stream and explicit moving/time names", () => {
    const result = calculateEfficiencyFactorDecoupling(
      [
        stream("custom_clock", [0, 2, 4, 6]),
        stream("custom_output", [200, 200, 180, 180]),
        stream("custom_hr", [100, 100, 100, 100]),
        stream("custom_moving", [true, true, true, true]),
      ],
      {
        outputStream: "custom_output",
        heartRateStream: "custom_hr",
        timeStream: "custom_clock",
        movingStream: "custom_moving",
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.decouplingPercent).toBeCloseTo(10, 8);
  });

  it("rejects missing, duplicate, and strictly misaligned required streams", () => {
    const missing = calculateEfficiencyFactorDecoupling([stream("watts", [100, 100])], {
      outputStream: "watts",
    });
    const duplicate = calculateEfficiencyFactorDecoupling(
      [
        stream("watts", [100, 100]),
        stream("heartrate", [100, 100]),
        stream("heartrate", [100, 100]),
      ],
      { outputStream: "watts" },
    );
    const mismatch = calculateEfficiencyFactorDecoupling(
      [stream("watts", [100, 100, 100]), stream("heartrate", [100, 100])],
      { outputStream: "watts" },
    );

    expect(missing).toEqual({
      ok: false,
      error: [{ kind: "MissingStream", type: "heartrate" }],
    });
    expect(duplicate).toEqual({
      ok: false,
      error: [{ kind: "DuplicateStream", type: "heartrate", count: 2 }],
    });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.error[0].kind).toBe("LengthMismatch");
  });

  it("rejects duplicate optional time streams instead of silently using index time", () => {
    const result = calculateEfficiencyFactorDecoupling(
      [
        stream("time", [0, 1, 2, 3]),
        stream("time", [0, 2, 4, 6]),
        stream("watts", [100, 100, 80, 80]),
        stream("heartrate", [100, 100, 100, 100]),
      ],
      { outputStream: "watts" },
    );

    expect(result).toEqual({
      ok: false,
      error: [{ kind: "DuplicateStream", type: "time", count: 2 }],
    });
  });

  it("rejects duplicate optional moving streams instead of treating all samples as moving", () => {
    const result = calculateEfficiencyFactorDecoupling(
      [
        stream("watts", [100, 100, 80, 80]),
        stream("heartrate", [100, 100, 100, 100]),
        stream("moving", [true, true, true, true]),
        stream("moving", [false, false, false, false]),
      ],
      { outputStream: "watts" },
    );

    expect(result).toEqual({
      ok: false,
      error: [{ kind: "DuplicateStream", type: "moving", count: 2 }],
    });
  });

  it("rejects non-finite and non-increasing timestamps", () => {
    const nonFinite = calculateEfficiencyFactorDecoupling(
      [
        stream("time", [0, Number.NaN, 2, 3]),
        stream("watts", [100, 100, 80, 80]),
        stream("heartrate", [100, 100, 100, 100]),
      ],
      { outputStream: "watts" },
    );
    const nonIncreasing = calculateEfficiencyFactorDecoupling(
      [
        stream("time", [0, 2, 1, 3]),
        stream("watts", [100, 100, 80, 80]),
        stream("heartrate", [100, 100, 100, 100]),
      ],
      { outputStream: "watts" },
    );

    expect(nonFinite).toEqual({
      ok: false,
      error: [{ kind: "InvalidTimeStream", type: "time", index: 1, reason: "NonFinite" }],
    });
    expect(nonIncreasing).toEqual({
      ok: false,
      error: [{ kind: "InvalidTimeStream", type: "time", index: 2, reason: "NonIncreasing" }],
    });
  });

  it("rejects explicitly named missing time and moving streams", () => {
    const missingTime = calculateEfficiencyFactorDecoupling(
      [stream("watts", [100, 100, 80, 80]), stream("heartrate", [100, 100, 100, 100])],
      { outputStream: "watts", timeStream: "custom_clock" },
    );
    const missingMoving = calculateEfficiencyFactorDecoupling(
      [stream("watts", [100, 100, 80, 80]), stream("heartrate", [100, 100, 100, 100])],
      { outputStream: "watts", movingStream: "custom_moving" },
    );

    expect(missingTime).toEqual({
      ok: false,
      error: [{ kind: "MissingStream", type: "custom_clock" }],
    });
    expect(missingMoving).toEqual({
      ok: false,
      error: [{ kind: "MissingStream", type: "custom_moving" }],
    });
  });

  it("validates split/cut options and a zero first-half efficiency factor", () => {
    const invalid = calculateEfficiencyFactorDecoupling(
      [stream("watts", [100, 100]), stream("heartrate", [100, 100])],
      { outputStream: "watts", splitFraction: 1 },
    );
    const zero = calculateEfficiencyFactorDecoupling(
      [
        stream("time", [0, 1, 2, 3]),
        stream("watts", [0, 0, 100, 100]),
        stream("heartrate", [100, 100, 100, 100]),
      ],
      { outputStream: "watts" },
    );

    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error[0].kind).toBe("InvalidOption");
    expect(zero).toEqual({
      ok: false,
      error: [{ kind: "ZeroEfficiencyFactor", half: "first" }],
    });
  });

  it("allows truncation only when explicitly requested", () => {
    const result = calculateEfficiencyFactorDecoupling(
      [
        stream("time", [0, 1, 2, 3, 4]),
        stream("watts", [100, 100, 80, 80]),
        stream("heartrate", [100, 100, 100, 100]),
      ],
      { outputStream: "watts", lengthPolicy: "truncate" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.coverage.totalSamples).toBe(4);
  });
});
