export interface BinaryDownload {
  /** Bytes returned by Fetch. HTTP content encoding may already be decoded. */
  bytes: ArrayBuffer;
  /** Cross-platform-sanitized server filename suggestion; the caller still chooses its path. */
  filename: string | null;
  contentType: string | null;
  /** Wire-level Content-Length header, which may differ from `bytes.byteLength`. */
  contentLength: number | null;
  /** Transport-level Content-Encoding header; do not decompress the bytes again. */
  contentEncoding: string | null;
}

export interface BinaryOnlyOptions {
  includeMetadata?: false;
}

export interface BinaryMetadataOptions {
  includeMetadata: true;
}

export interface SensorDownloadOptions extends BinaryOnlyOptions {
  power?: boolean;
  hr?: boolean;
}

export interface SensorDownloadMetadataOptions extends BinaryMetadataOptions {
  power?: boolean;
  hr?: boolean;
}

export interface WorkoutZipOptions extends BinaryOnlyOptions {
  format: "zwo" | "mrc" | "erg" | "fit";
  oldest: string;
  newest: string;
  powerRange?: number;
  hrRange?: number;
  paceRange?: number;
  locale?: string;
}

export interface WorkoutZipMetadataOptions
  extends Omit<WorkoutZipOptions, "includeMetadata">, BinaryMetadataOptions {}
