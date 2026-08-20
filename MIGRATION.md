# Migrating from 0.3.1 to 0.4.0

`Activity.type` and `ActivityWire.type` are now `string | null | undefined`, because Strava-sourced activities arrive as a five-key stub with no `type` and a required `type` rejected the whole response array; narrow the value before using it.

---

# Migrating from 0.2.0 to 0.3.0

`0.3.0` completes the request-casing, transport, retry, analytics, and stream-analysis work deferred from `0.2.0`. It remains compatible with `0.2` wire-shaped mutation inputs for the `0.3.x` line, but makes camelCase the canonical managed API.

## Managed request DTOs are camelCase

Use camelCase with managed mutations:

```ts
await client.events.create({
  startDateLocal: "2026-04-14T00:00:00",
  category: "WORKOUT",
  name: "Endurance",
  movingTime: 5_400,
  icuTrainingLoad: 72,
});
```

`AthleteUpdateWire`, `EventInputWire`, `WellnessUpdateWire`, and `WorkoutInputWire` preserve the `0.2` request surface and are deprecated through `0.3.x`. Do not mix a canonical property with its wire alias in the same object: managed methods resolve a local `Validation` error before sending a request. Generated request codecs preserve opaque dictionary keys exactly, including `workoutDoc` content and custom fields.

The standalone `camelCaseKeys()` and `snakeCaseKeys()` helpers now reject collisions and cycles instead of silently losing data. They recurse through plain records (including named interfaces) and arrays while preserving statically recognizable opaque values such as `Date`, `Map`, `Set`, typed arrays, and functions. Arbitrary class instances now throw `KeyTransformUnsupportedObjectError`: TypeScript cannot distinguish a public-field-only class instance from an equivalent named interface, so rejecting it is the only precise type/runtime contract. Convert custom class values to plain JSON first.

## Typed analytics move under activities

`client.activities` now covers all investigated analytics groups:

- best efforts and GAP, heart-rate, pace, and power histograms;
- per-activity heart-rate, pace, power, multi-power, and power-versus-heart-rate curves;
- activity-range and athlete heart-rate, pace, and power curve sets;
- athlete power-versus-heart-rate curves.

For example:

```ts
await client.activities.findBestEfforts(activityId, {
  stream: "watts",
  duration: 300,
});
await client.activities.listAthletePowerCurves({
  type: "Ride",
  curves: ["42d", "s0"],
});
```

`client.powerCurves.get()` remains as a deprecated delegate. Its old declaration described a single curve even though the endpoint returns an athlete curve set; `0.3.0` corrects that return type. Move new code to `client.activities.listAthletePowerCurves()`.

Analytics responses use loose, sanitized schemas: required semantic axes are validated, while additive upstream fields remain available. Filter arrays use the server's JSON query representation and ordinary arrays use comma-delimited query values.

## Normalized streams and local analysis

`activities.getStreamMap()` converts the stream array into a duplicate-safe `ReadonlyMap`, preserves custom descriptors, and reports malformed or duplicate streams instead of overwriting them. `normalizeActivityStreams()` provides the same pure operation for already-fetched values.

`calculateEfficiencyFactorDecoupling()` computes a transparent, time-weighted first-half versus second-half efficiency-factor drift. It is intentionally a local calculation, not a reimplementation of Intervals.icu's cleaned and lag-adjusted power-versus-heart-rate metric. A valid, strictly increasing `time` stream is required (or select one with `timeStream`); non-boolean moving samples now return `InvalidMovingStream` diagnostics.

## Retries are method-aware

Automatic retries now require both a retryable failure and a replayable request. In `auto` mode, GET, HEAD, OPTIONS, PUT, and DELETE are treated as idempotent; POST and PATCH are not. Network and per-attempt timeout failures are retryable by default, while caller aborts are never retried.

For an application-owned idempotent POST or PATCH, opt in explicitly through the Result-returning request API:

```ts
await client.request("/api/v1/custom-operation", {
  method: "POST",
  json: { exact_wire_key: true },
  retry: "idempotent",
});
```

Use `retry: "never"` to disable retries for one request. A `bodyFactory` can create a fresh body for each retry when a one-shot body cannot be replayed safely.

## Result-returning arbitrary requests

`client.request()` is the managed escape hatch for endpoints that do not yet have a resource method. It applies authentication boundaries, rate limiting, hooks, timeout, method-aware retries, response metadata, and normalized `Result` errors. It supports `json`, `text`, `arrayBuffer`, `blob`, `formData`, and `none` parsing plus optional Valibot validation for JSON.

Arbitrary JSON bodies and responses retain their exact wire keys; `client.request()` does not apply managed-resource casing. `client.raw` remains available for typed OpenAPI calls and streaming, with its existing openapi-fetch tuple and rejection behavior.

## Runtime support

Node.js `>=18` and TypeScript `>=5.4` remain the consumer floor. The package continues to compile representative `0.1.2`, `0.2.0`, and canonical `0.3.0` consumers.

---

# Migrating from 0.1.2 to 0.2.0

`0.2.0` corrects declarations to match existing runtime behavior and normalizes managed operational failures. Existing method names and common calls are preserved.

## Response names are now accurately camelCase

Managed resources already returned camelCase at runtime. Their declarations now agree:

```ts
const result = await client.activities.get("synthetic-activity");
if (result.ok) {
  result.value.startDateLocal;
  result.value.icuTrainingLoad;
}
```

Code that compiled against `start_date_local` or `icu_training_load` on a managed response must change to camelCase. Those keys were not present in the actual `0.1.2` value.

Request DTOs remain in Intervals.icu wire casing:

```ts
await client.events.create({
  start_date_local: "2025-01-15T08:00:00",
  category: "WORKOUT",
  name: "Endurance",
});
```

Standalone decoders and `client.raw` also retain wire casing. Explicit `ActivityWire`, `AthleteWire`, and related aliases are available when handling those values.

If an application deliberately converts managed values back to snake_case at an anti-corruption boundary, type that boundary with its own validated wire model (or the matching `*Wire` alias), not the managed `Activity`/`Athlete` type. This avoids relying on the inaccurate `0.1.2` declarations that the runtime never matched.

## Managed failures no longer escape

DNS, Fetch, body-read, timeout, malformed-success-JSON, and validation failures resolve an `ApiError` for resource operations. Add handling for `Network`, `Timeout`, `Validation`, and the `Unknown` fallback if the old code assumed only HTTP errors.

`timeoutMs` is optional and disabled by default:

```ts
const client = new IntervalsClient({ apiKey, timeoutMs: 30_000 });
```

Constructor configuration, `unwrap()`, and the legacy raw surface may still throw.

## Streams

The old form is preserved:

```ts
await client.activities.getStreams(id, ["time", "watts"]);
```

Prefer the options form:

```ts
await client.activities.getStreams(id, {
  types: ["time", "watts", "my_custom_stream"],
  includeDefaults: false,
});
```

The value is now declared as `ActivityStream[]`. Unknown names and row fields remain valid. Omitted `types` remains omitted and requests the server defaults.

## Downloads

Existing methods still return `ArrayBuffer`, and CSV still returns `string`. Pass `{ includeMetadata: true }` only when metadata and a `bytes` property are desired.

Workout ZIP downloads now expose the server-required query:

```ts
await client.workouts.downloadZip({
  format: "fit",
  oldest: "2025-01-01",
  newest: "2025-01-31",
});
```

Calling `downloadZip()` without options still compiles, but returns `Validation` locally because the server otherwise returns `422`.

Manual download paths now encode identifiers as opaque path segments, normalize trailing slashes on `baseUrl`, and return cross-platform-sanitized filename suggestions.

## Raw client

Raw calls keep their OpenAPI signatures, tuple result, and wire casing. They now pass through the limiter, configured HTTP-status retries, and hooks. Existing `client.raw.use()` and `eject()` middleware registrations continue to affect convenience resources. Raw hook paths are schema templates rather than resolved athlete/activity URLs. Raw calls are not converted to `Result` and can still reject.

With `timeoutMs` configured, the raw deadline surrounds the complete `openapi-fetch` attempt, including middleware and response parsing, while preserving the final transport or middleware `Response` identity. A `parseAs: "stream"` data stream retains the same deadline until it is consumed or cancelled.

For safety, a request-local `baseUrl` on another origin no longer receives the client's inherited Intervals.icu authorization. Supply an explicit request-local authorization header only when that alternate origin is trusted and requires its own credentials.

Queued raw calls and raw retry backoffs now reject promptly when their caller signal aborts. The original `signal.reason` is rethrown, while hooks receive the normalized `Network` abort variant.

## Configuration validation

Invalid rate-limit, retry, and timeout settings now throw during `IntervalsClient` construction instead of producing stalled queues, immediate overflowed timers, or late internal errors. Positive finite rates, positive integer bursts, positive integer retry attempts, non-negative finite retry delays within JavaScript's safe millisecond range, jitter from `0` through `1`, valid HTTP retry statuses, and `timeoutMs` up to `2_147_483_647` are accepted. Explicitly `undefined` fields in partial rate/retry options retain their defaults.

## Runtime support

The package keeps Node.js `>=18` runtime support. Contributors need Node.js `>=22.12` for the current test and formatting toolchain. Consumer declarations require TypeScript 5.4 or newer; an isolated `skipLibCheck: false` compile verifies the floor.
