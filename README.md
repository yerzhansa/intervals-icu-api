# intervals-icu-api

TypeScript client for the [Intervals.icu](https://intervals.icu) API. It combines types generated from the official OpenAPI 3.0.1 document with validated convenience resources and a typed raw escape hatch.

## Install

```bash
npm install intervals-icu-api@beta
```

The prerelease uses the `beta` npm tag. After stable `0.2.0` is published, the untagged install will select it through `latest`.

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
  start_date_local: "2026-04-14T00:00:00",
  category: "WORKOUT",
  name: "Sweet Spot 2x20",
  type: "Ride",
  moving_time: 5400,
  icu_training_load: 85,
});
```

## Features

- **Current OpenAPI snapshot** — reproducible types generated from the official Intervals.icu document
- **Resource-based API** — `client.athlete`, `.activities`, `.wellness`, `.events`, `.workouts`, `.powerCurves`, `.folders`, `.gear`
- **Result type** — managed resource operations resolve `Result<T, ApiError>` for HTTP, validation, timeout, and network failures
- **Runtime validation** — responses validated with [Valibot](https://valibot.dev) schemas using `looseObject` (forward-compatible with API changes)
- **camelCase keys** — API returns `icu_training_load`, you get `icuTrainingLoad`
- **Rate limiting** — token bucket (10 req/s default, burst 30) with queue-based concurrency safety
- **Retry** — exponential backoff with jitter on 429/5xx, respects `Retry-After` header
- **Hooks** — `onRequest`, `onResponse`, `onError`, `onRetry` for logging/monitoring
- **Typed activity streams** — known-name autocomplete without rejecting custom or future streams
- **File downloads** — backward-compatible bytes/strings plus opt-in response metadata
- **Raw escape hatch** — `client.raw` preserves OpenAPI wire types while sharing rate limiting, HTTP retries, and hooks

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
client.activities.getIntervals(activityId); // typed camelCase intervals/groups
client.activities.downloadFitFile(activityId); // → ArrayBuffer
client.activities.downloadGpxFile(activityId); // → ArrayBuffer
client.activities.downloadFile(activityId); // → ArrayBuffer (original file)
client.activities.exportCsv({ oldest: "2026-01-01" }); // → string
```

The legacy `getStreams(activityId, string[])` overload still works. Omitting `types` asks Intervals.icu for its default streams; it is not converted into an empty list.

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
client.powerCurves.get({ type: "Ride", f1: [], f2: [], f3: [] });
```

### Folders & Gear

```typescript
client.folders.list();
client.gear.list();
```

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

## Raw Client

For endpoints not covered by convenience methods, use the typed `openapi-fetch` client:

```typescript
const { data, error, response } = await client.raw.GET("/api/v1/athlete/{id}/chats", {
  params: { path: { id: "0" } },
});
```

Autocomplete works on paths, params, and response types. Raw responses retain upstream wire casing and the `{ data, error, response }` shape. Raw verb calls share the package limiter, configured HTTP-status retry policy, middleware registrations, and hooks, but they are not converted to `Result` and may reject. Hook paths use OpenAPI templates, so resolved athlete and activity identifiers are not exposed to loggers.

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

See [RFC-0001](docs/RFC-0001-v0.2-correctness-contract.md), the [investigation matrix](docs/v0.2-investigation-matrix.md), and [the 0.2 migration guide](MIGRATION.md). All three documents ship with the package.

## License

MIT
