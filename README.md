# intervals-icu-api

TypeScript client for the [intervals.icu](https://intervals.icu) API. Generated from the official OpenAPI 3.0.1 spec — full type safety, runtime validation, and zero `as any`.

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
  console.log(result.value.name);   // "Your Name"
}

// List recent activities
const activities = unwrap(await client.activities.list({ oldest: "2026-01-01" }));
console.log(activities[0].icuTrainingLoad); // 65

// Get current fitness/fatigue
const wellness = unwrap(await client.wellness.get("2026-04-13"));
console.log(`CTL: ${wellness.ctl}, ATL: ${wellness.atl}, TSB: ${wellness.ctl - wellness.atl}`);

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

- **Full type safety** — 9,125 lines of types generated from the official OpenAPI spec (113 paths, 143 operations)
- **Resource-based API** — `client.athlete`, `.activities`, `.wellness`, `.events`, `.workouts`, `.powerCurves`, `.folders`, `.gear`
- **Result type** — no exceptions thrown. Every method returns `Result<T, ApiError>` with a 9-variant discriminated union for precise error handling
- **Runtime validation** — responses validated with [Valibot](https://valibot.dev) schemas using `looseObject` (forward-compatible with API changes)
- **camelCase keys** — API returns `icu_training_load`, you get `icuTrainingLoad`
- **Rate limiting** — token bucket (10 req/s default, burst 30) with queue-based concurrency safety
- **Retry** — exponential backoff with jitter on 429/5xx, respects `Retry-After` header
- **Hooks** — `onRequest`, `onResponse`, `onError`, `onRetry` for logging/monitoring
- **File downloads** — FIT, GPX, ZIP as `ArrayBuffer`, CSV export as `string`
- **Raw escape hatch** — `client.raw` gives direct access to the typed openapi-fetch client for any of the 143 endpoints

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

Every method returns `Result<T, ApiError>` — a discriminated union, not exceptions.

```typescript
const result = await client.athlete.get();

if (result.ok) {
  // result.value is fully typed
  console.log(result.value.icuFtp);
} else {
  // result.error.kind narrows the error type
  switch (result.error.kind) {
    case "Unauthorized":  // 401 — bad API key
    case "Forbidden":     // 403
    case "NotFound":      // 404
    case "RateLimit":     // 429 — result.error.retryAfterMs
    case "Validation":    // response didn't match schema — result.error.issues
    case "Http":          // other HTTP error — result.error.status
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

## Resources

### Athlete

```typescript
client.athlete.get()                // GET /athlete/{id}
client.athlete.getProfile()         // GET /athlete/{id}/profile
client.athlete.update(body)         // PUT /athlete/{id}
```

### Activities

```typescript
client.activities.list({ oldest: "2026-01-01" })  // GET /athlete/{id}/activities (oldest is required)
client.activities.get(activityId)                  // GET /activity/{id}
client.activities.getStreams(activityId, ["watts", "heartrate"])
client.activities.downloadFitFile(activityId)      // → ArrayBuffer
client.activities.downloadGpxFile(activityId)      // → ArrayBuffer
client.activities.downloadFile(activityId)         // → ArrayBuffer (original file)
client.activities.exportCsv({ oldest: "2026-01-01" }) // → string
```

### Wellness

```typescript
client.wellness.list({ oldest: "2026-04-01", newest: "2026-04-13" })
client.wellness.get("2026-04-13")            // single day
client.wellness.update(body)                 // PUT
client.wellness.updateByDate("2026-04-13", body)
client.wellness.updateBulk(records)          // bulk update
```

### Events (Calendar / Training Plans)

```typescript
client.events.list({ oldest: "2026-04-14" })
client.events.get(eventId)
client.events.create(body)                   // push workout to calendar
client.events.update(eventId, body)
client.events.delete(eventId)
client.events.downloadWorkout(eventId, "zwo") // .zwo, .mrc, .erg, .fit → ArrayBuffer
```

### Workouts (Library)

```typescript
client.workouts.list()
client.workouts.get(workoutId)
client.workouts.create(body)
client.workouts.delete(workoutId)
client.workouts.downloadZip()                // → ArrayBuffer
```

### Power Curves

```typescript
client.powerCurves.get({ type: "Ride", f1: [], f2: [], f3: [] })
```

### Folders & Gear

```typescript
client.folders.list()
client.gear.list()
```

## Configuration

```typescript
const client = new IntervalsClient({
  apiKey: "...",
  athleteId: "0",       // "0" = authenticated athlete (default)
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
  hooks: {
    onRequest: ({ method, path }) => console.log(`→ ${method} ${path}`),
    onResponse: ({ method, path, status, durationMs }) => console.log(`← ${status} ${path} (${durationMs}ms)`),
    onRetry: ({ attempt, delayMs, reason }) => console.log(`↻ retry #${attempt} in ${delayMs}ms: ${reason}`),
  },
});
```

## Raw Client

For endpoints not covered by convenience methods, use the typed openapi-fetch client directly:

```typescript
const { data, error, response } = await client.raw.GET("/api/v1/athlete/{id}/chats", {
  params: { path: { id: "0" } },
});
```

All 143 API operations are fully typed — autocomplete works on paths, params, and response types.

## Schemas

Valibot schemas are exported for external validation (e.g., webhook payloads):

```typescript
import { decodeActivity, decodeWellness, ActivitySchema } from "intervals-icu-api";

const result = decodeActivity(unknownWebhookPayload);
if (result.ok) {
  console.log(result.value.icuTrainingLoad);
}
```

## License

MIT
