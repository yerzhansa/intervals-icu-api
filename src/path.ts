/** Encode an opaque identifier as exactly one RFC 3986 path segment. */
export function encodePathSegment(value: string | number): string {
  const segment = String(value);

  // WHATWG URL parsers also normalize percent-encoded dot segments, so retain
  // one encoded layer after parsing to prevent path traversal.
  if (segment === ".") return "%252E";
  if (segment === "..") return "%252E%252E";

  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
