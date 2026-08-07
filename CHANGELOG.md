# Changelog

## 0.3.0

### Added

- Typed methods for the complete investigated activity analytics surface: best efforts, histograms, activity and athlete curves, and power-versus-heart-rate data.
- Duplicate-safe stream normalization, `activities.getStreamMap()`, and a transparent time-weighted efficiency-factor decoupling helper.
- Canonical camelCase request DTOs backed by deterministic, schema-aware request codecs.
- A Result-returning `client.request()` escape hatch with exact wire JSON, six parse modes, optional validation, metadata, hooks, rate limiting, timeouts, and retries.
- Sanitized analytics, stream, casing, retry, and transport fixtures plus compatibility compilation for representative consumers.

### Changed

- Retries are method-aware and require replayable bodies; safe idempotent methods can retry HTTP, network, and timeout failures, while POST/PATCH require an explicit idempotency assertion.
- Retry waits and rate-limit queue acquisition honor aborts, Retry-After delays are bounded, and every attempt gets a fresh timeout and eligible body.
- Managed athlete, event, wellness, and workout mutations accept canonical camelCase inputs and map them to the API's exact mixed-case wire schemas.
- Generic key transforms detect collisions and cycles and preserve opaque object types instead of silently changing or losing values.
- Analytics filter arrays serialize as server-compatible JSON while ordinary arrays remain comma-delimited.
- The deprecated `powerCurves.get()` delegate now exposes the endpoint's actual athlete curve-set return shape.

### Compatibility

- Deprecated `*Wire` mutation aliases and their runtime inputs remain supported through `0.3.x`; mixed canonical/wire aliases resolve local validation errors.
- The legacy `getStreams(activityId, string[])` overload, managed response casing, raw OpenAPI tuple, and standalone wire decoders remain available.
- Arbitrary `client.request()` JSON is never implicitly recased, and opaque managed dictionaries preserve application-owned keys.
- Node.js `>=18` and TypeScript `>=5.4` remain the consumer support floor.

## 0.2.0-beta.1

### Added

- Reproducible official OpenAPI refresh, generation check, and upstream drift report.
- Typed, forward-compatible activity streams and the options overload for `includeDefaults`.
- `activities.getIntervals()` as the first typed analysis endpoint.
- Optional per-attempt request timeouts.
- Opt-in binary response metadata.
- Required workout ZIP format/date options.
- Consumer compile, package smoke, and canary coverage.

### Changed

- Managed response declarations now correctly describe their existing camelCase runtime values.
- Managed transport, parsing, timeout, HTTP, and validation failures resolve normalized `Result` errors.
- Raw verb calls share rate limiting, HTTP-status retries, and hooks while preserving their existing result shape.
- Raw calls no longer forward inherited Intervals.icu credentials to a request-local cross-origin `baseUrl`; explicit alternate credentials remain supported.
- Raw body deadlines no longer stop at response headers, hook paths no longer expose resolved identifiers, and raw middleware remains shared with convenience resources.
- Raw limiter waits and retry backoffs honor caller aborts without consuming a later token or sending another request.
- Concurrent rate-limit waiters use one FIFO scheduler instead of becoming stranded at a shared token boundary.
- Manual download URLs encode dynamic identifiers, normalize trailing-slash base URLs, and sanitize filename metadata for cross-platform use.
- Generated managed/raw paths protect dot-only parameters from URL path normalization.
- Recursive key transformation treats `__proto__` as data rather than mutating the returned object's prototype.
- The checked-in OpenAPI snapshot is refreshed to the current additive official schema.
- Invalid timeout, retry, and rate-limit settings fail synchronously as constructor configuration errors; explicitly undefined partial fields retain defaults.

### Compatibility

- Existing method names, request DTO casing, stream-array calls, raw result shape, and default download values are preserved.
- Standalone decoders remain wire-cased.
- Consumer declarations are verified with TypeScript 5.4.5 and 5.9.3; the current public dependency declarations do not compile on TypeScript 5.0-5.3 with `skipLibCheck: false`.
- Broad analytics convenience endpoints remain planned for `0.3.0`.
