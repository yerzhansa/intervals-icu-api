# Changelog

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
