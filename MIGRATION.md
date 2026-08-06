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
