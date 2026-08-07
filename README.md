# intervals-icu-api

TypeScript client for the [Intervals.icu](https://intervals.icu) API. It combines types generated from the official OpenAPI 3.0.1 document with validated convenience resources and a typed raw escape hatch.

## Install

```bash
npm install intervals-icu-api
```

## Quick Start

```typescript
import { IntervalsClient, unwrap } from "intervals-icu-api";

const client = new IntervalsClient({
  apiKey: "your-api-key", // from Settings > Developer
});

// Fetch athlete profile
const result = await client.athlete.get();
if (result.ok) {
  console.log(result.value.icuFtp); // 280
  console.log(result.value.name); // "Your Name"
}

// List recent activities
const activities = unwrap(await client.activities.list({ oldest: "2026-01-01" }));
console.log(activities[0].icuTrainingLoad); // 65

// Get current fitness/fatigue
const wellness = unwrap(await client.wellness.get("2026-04-13"));
const ctl = wellness.ctl ?? 0;
const atl = wellness.atl ?? 0;
console.log(`CTL: ${ctl}, ATL: ${atl}, TSB: ${ctl - atl}`);

// Push a workout to calendar (syncs to Garmin/Wahoo automatically)
await client.events.create({
  startDateLocal: "2026-04-14T00:00:00",
  category: "WORKOUT",
  name: "Sweet Spot 2x20",
  type: "Ride",
  movingTime: 5400,
  icuTrainingLoad: 85,
});
```

## Features

- **Current OpenAPI snapshot** — reproducible types generated from the official Intervals.icu document
- **Resource-based API** — `client.athlete`, `.activities`, `.wellness`, `.events`, `.workouts`, `.powerCurves`, `.folders`, `.gear`
- **Result type** — managed resource operations resolve `Result<T, ApiError>` for HTTP, validation, timeout, and network failures
- **Runtime validation** — responses validated with [Valibot](https://valibot.dev) schemas using `looseObject` (forward-compatible with API changes)
- **camelCase keys** — API returns `icu_training_load`, you get `icuTrainingLoad`
- **camelCase managed inputs** — typed mutations map canonical DTOs to the API's exact mixed-case wire schema
- **Rate limiting** — token bucket (10 req/s default, burst 30) with queue-based concurrency safety
- **Method-aware retry** — safe replayable calls retry HTTP, network, and timeout failures with bounded backoff
- **Hooks** — `onRequest`, `onResponse`, `onError`, `onRetry` for logging/monitoring
- **Typed activity streams** — known-name autocomplete without rejecting custom or future streams
- **Typed analytics** — best efforts, histograms, curves, power-vs-HR, stream normalization, and transparent decoupling
- **File downloads** — backward-compatible bytes/strings plus opt-in response metadata
- **Two escape hatches** — `client.request()` returns `Result`; `client.raw` preserves openapi-fetch behavior

## Authentication

### API Key (personal use)

Generate a key in intervals.icu Settings > Developer.

```typescript
const client = new IntervalsClient({ apiKey: "your-key" });
```

### Bearer Token (OAuth apps)

```typescript
const client = new IntervalsClient({ bearerToken: "oauth-access-token" });
```

## Error Handling

Managed resource methods return `Result<T, ApiError>` instead of rejecting for operational failures.

```typescript
const result = await client.athlete.get();

if (result.ok) {
  // result.value is fully typed
  console.log(result.value.icuFtp);
} else {
  // result.error.kind narrows the error type
  switch (result.error.kind) {
    case "Unauthorized": // 401 — bad API key
    case "Forbidden": // 403
    case "NotFound": // 404
    case "RateLimit": // 429 — result.error.retryAfterMs
    case "Validation": // response didn't match schema — result.error.issues
    case "Http": // other HTTP error — result.error.status
    case "Timeout":
    case "Network":
    case "Unknown":
  }
}
```

For quick scripts where you don't want to check every result:

```typescript
import { unwrap } from "intervals-icu-api";

const athlete = unwrap(await client.athlete.get()); // throws if error
```

Invalid constructor configuration and `unwrap()` are programmer-controlled throws. The raw client preserves `openapi-fetch` behavior and may reject on transport or parsing failures.

## Resources

### Athlete

```typescript
client.athlete.get(); // GET /athlete/{id}
client.athlete.getProfile(); // GET /athlete/{id}/profile
client.athlete.update(body); // PUT /athlete/{id}
```

### Activities

```typescript
client.activities.list({ oldest: "2026-01-01" }); // GET /athlete/{id}/activities (oldest is required)
client.activities.get(activityId); // GET /activity/{id}
client.activities.getStreams(activityId, {
  types: ["watts", "heartrate", "athlete_custom_stream"],
  includeDefaults: false,
});
client.activities.getStreamMap(activityId); // duplicate-safe ReadonlyMap + diagnostics
client.activities.getIntervals(activityId); // typed camelCase intervals/groups
client.activities.findBestEfforts(activityId, { stream: "watts", duration: 300 });
client.activities.getHeartRateCurve(activityId);
client.activities.getPaceCurve(activityId, { gap: true });
client.activities.getPowerCurve(activityId);
client.activities.getPowerVsHeartRate(activityId); // Intervals' server-owned metric
client.activities.listAthletePowerCurves({ type: "Ride", curves: ["42d", "s0"] });
client.activities.downloadFitFile(activityId); // → ArrayBuffer
client.activities.downloadGpxFile(activityId); // → ArrayBuffer
client.activities.downloadFile(activityId); // → ArrayBuffer (original file)
client.activities.exportCsv({ oldest: "2026-01-01" }); // → string
```

The legacy `getStreams(activityId, string[])` overload still works. Omitting `types` asks Intervals.icu for its default streams; it is not converted into an empty list.

Normalized streams retain duplicate and custom descriptors rather than silently overwriting them. The pure helper below calculates a transparent, time-weighted efficiency-factor drift; it is intentionally distinct from Intervals' lag-adjusted and cleaned power-vs-HR metric. It requires a valid, strictly increasing `time` stream (or the configured `timeStream`) and reports non-boolean moving samples instead of inventing timing or movement data.

```typescript
import { calculateEfficiencyFactorDecoupling } from "intervals-icu-api";

const streams = unwrap(await client.activities.getStreamMap(activityId));
const drift = calculateEfficiencyFactorDecoupling(streams, {
  outputStream: "watts",
});
```

Download metadata is additive:

```typescript
const fit = await client.activities.downloadFitFile(activityId, {
  power: true,
  hr: true,
  includeMetadata: true,
});

if (fit.ok) {
  console.log(fit.value.filename, fit.value.contentType, fit.value.bytes.byteLength);
}
```

`contentEncoding` is transport metadata. Fetch may already have decoded the body, so do not decompress returned bytes again.

`filename` is sanitized as a cross-platform suggestion. The caller still chooses the destination directory and should not treat server metadata as a full output path.

### Wellness

```typescript
client.wellness.list({ oldest: "2026-04-01", newest: "2026-04-13" });
client.wellness.get("2026-04-13"); // single day
client.wellness.update(body); // PUT
client.wellness.updateByDate("2026-04-13", body);
client.wellness.updateBulk(records); // bulk update
```

### Events (Calendar / Training Plans)

```typescript
client.events.list({ oldest: "2026-04-14" });
client.events.get(eventId);
client.events.create(body); // push workout to calendar
client.events.update(eventId, body);
client.events.delete(eventId);
client.events.downloadWorkout(eventId, "zwo"); // .zwo, .mrc, .erg, .fit → ArrayBuffer
```

### Workouts (Library)

```typescript
client.workouts.list();
client.workouts.get(workoutId);
client.workouts.create(body);
client.workouts.delete(workoutId);
client.workouts.downloadZip({
  format: "zwo",
  oldest: "2025-01-01",
  newest: "2025-01-31",
}); // → ArrayBuffer
```

Intervals.icu requires the ZIP format and date range. A no-argument call remains source-compatible but resolves a local `Validation` error instead of sending a request that is guaranteed to fail.

### Power Curves

```typescript
client.activities.listAthletePowerCurves({ type: "Ride", curves: ["42d"] });
```

`client.powerCurves.get()` remains as a deprecated delegate. Its pre-0.3 declaration described the wrong single-curve shape; it now returns the actual athlete curve set.

### Folders & Gear

```typescript
client.folders.list();
client.gear.list();
```

## Managed Request Casing

Managed mutation DTOs are canonical camelCase. The client uses generated, schema-aware codecs because Intervals request schemas mix snake_case with names such as `avgSleepingHR`, `spO2`, and `pMax`.

```typescript
await client.wellness.update({
  id: "2026-04-13",
  restingHR: 48,
  hrvSDNN: 62,
});
```

Named `*Wire` aliases remain available for 0.2 callers and are deprecated through the 0.3 line. Do not mix canonical and wire aliases in one body: the call resolves a local `Validation` error before any request. Opaque maps such as `workoutDoc` content keep their keys exactly.

## Configuration

```typescript
const client = new IntervalsClient({
  apiKey: "...",
  athleteId: "0", // "0" = authenticated athlete (default)
  baseUrl: "https://intervals.icu",
  rateLimit: {
    requestsPerSecond: 10,
    burst: 30,
  },
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    jitterFactor: 0.2,
    retryableStatuses: [429, 500, 502, 503, 504],
    retryOnNetworkError: true,
    retryOnTimeout: true,
  },
  timeoutMs: 30_000, // optional per-attempt deadline; omitted = no client deadline
  hooks: {
    onRequest: ({ method, path }) => console.log(`→ ${method} ${path}`),
    onResponse: ({ method, path, status, durationMs }) =>
      console.log(`← ${status} ${path} (${durationMs}ms)`),
    onRetry: ({ attempt, delayMs, reason }) =>
      console.log(`↻ retry #${attempt} in ${delayMs}ms: ${reason}`),
  },
});
```

Invalid timeout, retry, and rate-limit values throw during construction. Explicitly `undefined` fields in partial retry/rate-limit options are treated as omitted and retain their defaults.

Automatic retries apply to replayable GET, HEAD, OPTIONS, PUT, and DELETE calls. POST and PATCH require an explicit idempotency assertion through `client.request(..., { retry: "idempotent" })`; `retry: "never"` disables retries for one call.

## Result-returning Arbitrary Requests

Use `client.request()` when an endpoint is not modeled yet but you still want normalized errors, rate limiting, retries, timeouts, hooks, parsing, and response metadata.

```typescript
const result = await client.request("/api/v1/athlete/0/chats", {
  query: { limit: 20 },
});

if (result.ok) {
  console.log(result.value.data, result.value.response.status);
}
```

Supported parsers are `json`, `text`, `arrayBuffer`, `blob`, `formData`, and `none`. A Valibot `schema` can validate and transform JSON. Arbitrary JSON keys are sent and returned exactly as supplied; only typed managed resources apply API-specific casing. Streaming remains on `client.raw`.

## Raw Client

For endpoints not covered by convenience methods, use the typed `openapi-fetch` client:

```typescript
const { data, error, response } = await client.raw.GET("/api/v1/athlete/{id}/chats", {
  params: { path: { id: "0" } },
});
```

Autocomplete works on paths, params, and response types. Raw responses retain upstream wire casing and the `{ data, error, response }` shape. Raw verb calls share the package limiter, method-aware retry policy, middleware registrations, and hooks, but they are not converted to `Result` and may reject. Hook paths use OpenAPI templates, so resolved athlete and activity identifiers are not exposed to loggers.

When `timeoutMs` is enabled, the per-attempt raw deadline surrounds the complete `openapi-fetch` operation, including middleware and response parsing, and aborts the underlying request. The final `result.response` preserves the transport or middleware `Response` identity. For `parseAs: "stream"`, the returned data stream retains the same deadline until it is consumed or cancelled.

If a raw call overrides `baseUrl` to another origin, the client's inherited Intervals.icu authorization is removed. An explicit request-local authorization header is preserved for callers intentionally targeting that origin.

## Schemas

Valibot schemas are exported for external validation (e.g., webhook payloads):

```typescript
import { decodeActivity, decodeWellness, ActivitySchema } from "intervals-icu-api";

const result = decodeActivity(unknownWebhookPayload);
if (result.ok) {
  // Standalone decoders intentionally preserve Intervals.icu wire casing.
  console.log(result.value.icu_training_load);
}
```

Managed resources return camelCase. Generated `paths`, `components`, and `operations` (also exported as `WirePaths`, `WireComponents`, and `WireOperations`) and standalone decoders retain upstream casing.

## Runtime and development support

- Packed runtime: Node.js 18 or newer.
- Package development, generation, and unit tests: Node.js 22.12 or newer.
- Consumer types: TypeScript 5.4 or newer.

The CI runtime smoke matrix verifies the packed artifact separately from the newer development toolchain.

## Schema maintenance

The checked-in `openapi.json` is the immutable generation input. The canonical upstream document is `https://intervals.icu/api/v1/docs`.

```bash
npm run schema:generate       # generate from the checked-in snapshot
npm run schema:check          # fail if generated declarations are stale
npm run schema:fetch          # explicitly update the normalized snapshot
npm run schema:upstream-diff  # report live drift without changing the snapshot
```

See the [migration guide](MIGRATION.md) for the 0.3 request, retry, transport, and analytics changes.

## License

MIT
