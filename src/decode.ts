import * as v from "valibot";
import { type Result, type ValidationIssue, ok, err, toValidationIssues } from "./result.js";

/** Validates unknown data against a Valibot schema. Returns Result. */
export function decode<T>(schema: v.GenericSchema<unknown, T>, data: unknown): Result<T, ValidationIssue[]> {
  const result = v.safeParse(schema, data);
  if (result.success) return ok(result.output);
  return err(toValidationIssues(result.issues));
}

/** Validates an array of items against a Valibot schema. Returns Result. */
export function decodeArray<T>(schema: v.GenericSchema<unknown, T>, data: unknown): Result<T[], ValidationIssue[]> {
  return decode(v.array(schema), data);
}
