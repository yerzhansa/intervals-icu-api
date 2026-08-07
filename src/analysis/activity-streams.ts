import { err, ok, type Result } from "../result.js";
import type { ActivityStream, ActivityStreamType } from "../schemas/activity-stream.js";

export type StreamNormalizationIssue =
  | { kind: "DuplicateType"; type: string; count: number }
  | {
      kind: "Data2LengthMismatch";
      type: string;
      descriptorIndex: number;
      dataLength: number;
      data2Length: number;
    }
  | {
      kind: "SampleCountMismatch";
      type: string;
      descriptorIndex: number;
      expected: number;
      actual: number;
      referenceType: string;
    };

export type StreamLookupError =
  | { kind: "MissingStream"; type: string }
  | { kind: "DuplicateStream"; type: string; count: number };

export interface NormalizedActivityStreams {
  readonly descriptors: readonly ActivityStream[];
  readonly byType: ReadonlyMap<string, readonly ActivityStream[]>;
  readonly sampleCounts: ReadonlyMap<string, readonly number[]>;
  readonly issues: readonly StreamNormalizationIssue[];
  getUnique(type: ActivityStreamType): Result<ActivityStream, StreamLookupError>;
}

/**
 * Index descriptors without dropping duplicate or custom streams. This performs structural
 * diagnostics only; it never coerces stream values or silently truncates arrays.
 */
export function normalizeActivityStreams(
  descriptors: readonly ActivityStream[],
): NormalizedActivityStreams {
  const descriptorSnapshot = [...descriptors];
  const mutableByType = new Map<string, ActivityStream[]>();
  const mutableSampleCounts = new Map<string, number[]>();
  const issues: StreamNormalizationIssue[] = [];

  descriptorSnapshot.forEach((descriptor, descriptorIndex) => {
    const streams = mutableByType.get(descriptor.type) ?? [];
    streams.push(descriptor);
    mutableByType.set(descriptor.type, streams);

    const counts = mutableSampleCounts.get(descriptor.type) ?? [];
    counts.push(descriptor.data.length);
    mutableSampleCounts.set(descriptor.type, counts);

    if (descriptor.data2 && descriptor.data2.length !== descriptor.data.length) {
      issues.push({
        kind: "Data2LengthMismatch",
        type: descriptor.type,
        descriptorIndex,
        dataLength: descriptor.data.length,
        data2Length: descriptor.data2.length,
      });
    }
  });

  for (const [type, streams] of mutableByType) {
    if (streams.length > 1) issues.push({ kind: "DuplicateType", type, count: streams.length });
  }

  const reference = chooseReference(descriptorSnapshot, mutableByType);
  if (reference) {
    descriptorSnapshot.forEach((descriptor, descriptorIndex) => {
      if (descriptor.data.length !== reference.sampleCount) {
        issues.push({
          kind: "SampleCountMismatch",
          type: descriptor.type,
          descriptorIndex,
          expected: reference.sampleCount,
          actual: descriptor.data.length,
          referenceType: reference.type,
        });
      }
    });
  }

  const byType = new Map<string, readonly ActivityStream[]>(
    [...mutableByType].map(([type, streams]) => [type, Object.freeze([...streams])]),
  );
  const sampleCounts = new Map<string, readonly number[]>(
    [...mutableSampleCounts].map(([type, counts]) => [type, Object.freeze([...counts])]),
  );

  return {
    descriptors: Object.freeze(descriptorSnapshot),
    byType,
    sampleCounts,
    issues: Object.freeze(issues),
    getUnique(type) {
      const matches = byType.get(type);
      if (!matches || matches.length === 0) return err({ kind: "MissingStream", type });
      if (matches.length > 1) {
        return err({ kind: "DuplicateStream", type, count: matches.length });
      }
      return ok(matches[0]);
    },
  };
}

function chooseReference(
  descriptors: readonly ActivityStream[],
  byType: ReadonlyMap<string, readonly ActivityStream[]>,
): { type: string; sampleCount: number } | undefined {
  const time = byType.get("time");
  if (time?.length === 1) return { type: "time", sampleCount: time[0].data.length };
  const first = descriptors[0];
  return first ? { type: first.type, sampleCount: first.data.length } : undefined;
}

export interface EfficiencyFactorDecouplingOptions {
  outputStream: ActivityStreamType;
  heartRateStream?: ActivityStreamType;
  /** Name of the required timestamp stream. Defaults to `time`. */
  timeStream?: ActivityStreamType;
  movingStream?: ActivityStreamType;
  startSeconds?: number;
  endSeconds?: number;
  /** Position of the time split inside the selected window. Defaults to 0.5. */
  splitFraction?: number;
  /** Strict alignment is the safe default; truncate must be explicitly requested. */
  lengthPolicy?: "strict" | "truncate";
}

export type StreamAnalysisIssue =
  | StreamLookupError
  | { kind: "InvalidOption"; option: string; message: string }
  | { kind: "LengthMismatch"; streams: Readonly<Record<string, number>> }
  | {
      kind: "InvalidTimeStream";
      type: string;
      index: number;
      reason: "NonFinite" | "NonIncreasing";
    }
  | {
      kind: "InvalidMovingStream";
      type: string;
      index: number;
      reason: "NonBoolean";
    }
  | { kind: "NoUsableSamples"; half?: "first" | "second" }
  | { kind: "ZeroEfficiencyFactor"; half: "first" | "second" };

export interface EfficiencyFactorHalf {
  durationSeconds: number;
  sampleCount: number;
  outputMean: number;
  heartRateMean: number;
  efficiencyFactor: number;
}

export interface EfficiencyFactorCoverage {
  totalSamples: number;
  validSamples: number;
  includedDurationSeconds: number;
  windowDurationSeconds: number;
  fraction: number;
}

export interface EfficiencyFactorDecoupling {
  firstHalf: EfficiencyFactorHalf;
  secondHalf: EfficiencyFactorHalf;
  /** `(first efficiency factor - second efficiency factor) / first * 100`. */
  decouplingPercent: number;
  coverage: EfficiencyFactorCoverage;
}

interface WeightedAccumulator {
  duration: number;
  sampleIndexes: Set<number>;
  output: number;
  heartRate: number;
}

/**
 * Calculate transparent, time-weighted efficiency-factor drift from aligned streams.
 * This is deliberately not an implementation of Intervals.icu's cleaned, lag-adjusted
 * server-side power-versus-HR model.
 */
export function calculateEfficiencyFactorDecoupling(
  source: NormalizedActivityStreams | readonly ActivityStream[],
  options: EfficiencyFactorDecouplingOptions,
): Result<EfficiencyFactorDecoupling, StreamAnalysisIssue[]> {
  const invalidOptions = validateOptions(options);
  if (invalidOptions.length > 0) return err(invalidOptions);

  const streams = isNormalizedActivityStreams(source) ? source : normalizeActivityStreams(source);
  const heartRateType = options.heartRateStream ?? "heartrate";
  const timeType = options.timeStream ?? "time";
  const movingType = options.movingStream ?? "moving";

  const outputResult = streams.getUnique(options.outputStream);
  const heartRateResult = streams.getUnique(heartRateType);
  if (!outputResult.ok || !heartRateResult.ok) {
    return err([
      ...(!outputResult.ok ? [outputResult.error] : []),
      ...(!heartRateResult.ok ? [heartRateResult.error] : []),
    ]);
  }

  const timeResult = streams.getUnique(timeType);
  const movingResult = streams.getUnique(movingType);
  if (!timeResult.ok) {
    const lookupIssues: StreamLookupError[] = [timeResult.error];
    if (
      !movingResult.ok &&
      (movingResult.error.kind !== "MissingStream" || options.movingStream !== undefined)
    ) {
      lookupIssues.push(movingResult.error);
    }
    return err(lookupIssues);
  }
  if (
    !movingResult.ok &&
    (movingResult.error.kind !== "MissingStream" || options.movingStream !== undefined)
  ) {
    return err([movingResult.error]);
  }

  const time = timeResult.value;
  const moving = movingResult.ok ? movingResult.value : undefined;
  const lengths: Record<string, number> = {
    [options.outputStream]: outputResult.value.data.length,
    [heartRateType]: heartRateResult.value.data.length,
    [timeType]: time.data.length,
    ...(moving ? { [movingType]: moving.data.length } : {}),
  };
  const distinctLengths = new Set(Object.values(lengths));
  if ((options.lengthPolicy ?? "strict") === "strict" && distinctLengths.size > 1) {
    return err([{ kind: "LengthMismatch", streams: lengths }]);
  }

  const length = Math.min(...Object.values(lengths));
  if (!Number.isFinite(length) || length === 0) return err([{ kind: "NoUsableSamples" }]);

  const timestampResult = createTimestamps(time.data, length, timeType);
  if (!timestampResult.ok) return err([timestampResult.error]);
  if (moving) {
    const movingIssues = validateMovingStream(moving.data, length, movingType);
    if (movingIssues.length > 0) return err(movingIssues);
  }
  const timestamps = timestampResult.value;
  const fallbackDuration = medianPositiveDelta(timestamps) ?? 1;
  const durations = timestamps.map((timestamp, index) => {
    const next = timestamps[index + 1];
    return next !== undefined && next > timestamp ? next - timestamp : fallbackDuration;
  });
  const naturalStart = timestamps[0];
  const naturalEnd = timestamps[length - 1] + durations[length - 1];
  const windowStart = options.startSeconds ?? naturalStart;
  const windowEnd = options.endSeconds ?? naturalEnd;
  if (!(windowEnd > windowStart)) {
    return err([
      { kind: "InvalidOption", option: "endSeconds", message: "must be after startSeconds" },
    ]);
  }

  const split = windowStart + (windowEnd - windowStart) * (options.splitFraction ?? 0.5);
  const first = accumulator();
  const second = accumulator();
  let validSamples = 0;

  for (let index = 0; index < length; index++) {
    const output = finiteNumber(outputResult.value.data[index]);
    const heartRate = finiteNumber(heartRateResult.value.data[index]);
    const isMoving = moving ? moving.data[index] === true : true;
    const timestamp = timestamps[index];
    const sampleEnd = timestamp + durations[index];
    if (output === undefined || heartRate === undefined || heartRate <= 0 || !isMoving) continue;

    const clippedStart = Math.max(timestamp, windowStart);
    const clippedEnd = Math.min(sampleEnd, windowEnd);
    if (!(clippedEnd > clippedStart)) continue;
    validSamples++;

    addWeighted(
      first,
      index,
      output,
      heartRate,
      Math.max(0, Math.min(clippedEnd, split) - clippedStart),
    );
    addWeighted(
      second,
      index,
      output,
      heartRate,
      Math.max(0, clippedEnd - Math.max(clippedStart, split)),
    );
  }

  const firstHalf = finishHalf(first);
  const secondHalf = finishHalf(second);
  const issues: StreamAnalysisIssue[] = [];
  if (!firstHalf) issues.push({ kind: "NoUsableSamples", half: "first" });
  if (!secondHalf) issues.push({ kind: "NoUsableSamples", half: "second" });
  if (issues.length > 0 || !firstHalf || !secondHalf) return err(issues);
  if (firstHalf.efficiencyFactor === 0) {
    return err([{ kind: "ZeroEfficiencyFactor", half: "first" }]);
  }

  const includedDurationSeconds = firstHalf.durationSeconds + secondHalf.durationSeconds;
  const windowDurationSeconds = windowEnd - windowStart;
  return ok({
    firstHalf,
    secondHalf,
    decouplingPercent:
      ((firstHalf.efficiencyFactor - secondHalf.efficiencyFactor) / firstHalf.efficiencyFactor) *
      100,
    coverage: {
      totalSamples: length,
      validSamples,
      includedDurationSeconds,
      windowDurationSeconds,
      fraction: Math.min(1, includedDurationSeconds / windowDurationSeconds),
    },
  });
}

function isNormalizedActivityStreams(
  source: NormalizedActivityStreams | readonly ActivityStream[],
): source is NormalizedActivityStreams {
  return !Array.isArray(source) && "getUnique" in source;
}

function validateOptions(options: EfficiencyFactorDecouplingOptions): StreamAnalysisIssue[] {
  const issues: StreamAnalysisIssue[] = [];
  const split = options.splitFraction ?? 0.5;
  if (!Number.isFinite(split) || split <= 0 || split >= 1) {
    issues.push({
      kind: "InvalidOption",
      option: "splitFraction",
      message: "must be a finite number greater than 0 and less than 1",
    });
  }
  for (const name of ["startSeconds", "endSeconds"] as const) {
    const value = options[name];
    if (value !== undefined && !Number.isFinite(value)) {
      issues.push({ kind: "InvalidOption", option: name, message: "must be finite" });
    }
  }
  return issues;
}

function createTimestamps(
  data: readonly unknown[],
  length: number,
  type: string,
): Result<number[], StreamAnalysisIssue> {
  const timestamps: number[] = [];
  for (let index = 0; index < length; index++) {
    const timestamp = finiteNumber(data[index]);
    if (timestamp === undefined) {
      return err({ kind: "InvalidTimeStream", type, index, reason: "NonFinite" });
    }
    const previous = timestamps[index - 1];
    if (previous !== undefined && timestamp <= previous) {
      return err({ kind: "InvalidTimeStream", type, index, reason: "NonIncreasing" });
    }
    timestamps.push(timestamp);
  }
  return ok(timestamps);
}

function validateMovingStream(
  data: readonly unknown[],
  length: number,
  type: string,
): StreamAnalysisIssue[] {
  const issues: StreamAnalysisIssue[] = [];
  for (let index = 0; index < length; index++) {
    if (typeof data[index] !== "boolean") {
      issues.push({ kind: "InvalidMovingStream", type, index, reason: "NonBoolean" });
    }
  }
  return issues;
}

function medianPositiveDelta(timestamps: readonly number[]): number | undefined {
  const deltas = timestamps
    .slice(1)
    .map((value, index) => value - timestamps[index])
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (deltas.length === 0) return undefined;
  const middle = Math.floor(deltas.length / 2);
  return deltas.length % 2 === 0 ? (deltas[middle - 1] + deltas[middle]) / 2 : deltas[middle];
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function accumulator(): WeightedAccumulator {
  return { duration: 0, sampleIndexes: new Set(), output: 0, heartRate: 0 };
}

function addWeighted(
  target: WeightedAccumulator,
  index: number,
  output: number,
  heartRate: number,
  duration: number,
): void {
  if (!(duration > 0)) return;
  target.duration += duration;
  target.sampleIndexes.add(index);
  target.output += output * duration;
  target.heartRate += heartRate * duration;
}

function finishHalf(value: WeightedAccumulator): EfficiencyFactorHalf | undefined {
  if (!(value.duration > 0)) return undefined;
  const outputMean = value.output / value.duration;
  const heartRateMean = value.heartRate / value.duration;
  return {
    durationSeconds: value.duration,
    sampleCount: value.sampleIndexes.size,
    outputMean,
    heartRateMean,
    efficiencyFactor: outputMean / heartRateMean,
  };
}
