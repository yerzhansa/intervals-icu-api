import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
export const SNAPSHOT_PATH = resolve(ROOT_DIR, "openapi.json");
export const GENERATED_PATH = resolve(ROOT_DIR, "src/generated/schema.ts");
export const UPSTREAM_URL = "https://intervals.icu/api/v1/docs";

const execFileAsync = promisify(execFile);
const formatterPath = resolve(ROOT_DIR, "node_modules/oxfmt/bin/oxfmt");

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateOpenApiDocument(document, source) {
  if (!isRecord(document)) {
    throw new Error(`${source} is not a JSON object`);
  }
  if (typeof document.openapi !== "string" || !document.openapi.startsWith("3.")) {
    throw new Error(`${source} does not declare a supported OpenAPI 3.x version`);
  }
  if (!isRecord(document.info) || typeof document.info.title !== "string") {
    throw new Error(`${source} does not contain a valid info object`);
  }
  if (!isRecord(document.paths)) {
    throw new Error(`${source} does not contain a paths object`);
  }
}

export function normalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeJson);
  }
  if (!isRecord(value)) {
    return value;
  }

  const normalized = {};
  for (const key of Object.keys(value).sort()) {
    normalized[key] = normalizeJson(value[key]);
  }
  return normalized;
}

export function serializeNormalized(document) {
  return `${JSON.stringify(normalizeJson(document), null, 2)}\n`;
}

export function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

export async function readSnapshot() {
  const contents = await readFile(SNAPSHOT_PATH, "utf8");
  const document = parseJson(contents, SNAPSHOT_PATH);
  validateOpenApiDocument(document, SNAPSHOT_PATH);

  if (JSON.stringify(document) !== JSON.stringify(normalizeJson(document))) {
    throw new Error("openapi.json is not normalized; run npm run schema:fetch");
  }
  await checkFormatting(SNAPSHOT_PATH);
  return { contents, document };
}

export async function fetchUpstream() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(UPSTREAM_URL, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`upstream returned HTTP ${response.status} ${response.statusText}`);
    }

    const contents = await response.text();
    const document = parseJson(contents, UPSTREAM_URL);
    validateOpenApiDocument(document, UPSTREAM_URL);
    return { contents: serializeNormalized(document), document: normalizeJson(document) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`timed out after 30000ms fetching ${UPSTREAM_URL}`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function writeAtomically(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, contents, "utf8");
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function generateSchema(outputPath = GENERATED_PATH) {
  await readSnapshot();
  const cliPath = resolve(ROOT_DIR, "node_modules/openapi-typescript/bin/cli.js");
  await mkdir(dirname(outputPath), { recursive: true });
  await execFileAsync(process.execPath, [cliPath, SNAPSHOT_PATH, "--output", outputPath], {
    cwd: ROOT_DIR,
    maxBuffer: 10 * 1024 * 1024,
  });
  await formatFile(outputPath);
}

export async function formatFile(path) {
  await execFileAsync(process.execPath, [formatterPath, path], {
    cwd: ROOT_DIR,
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function checkFormatting(path) {
  try {
    await execFileAsync(process.execPath, [formatterPath, "--check", path], {
      cwd: ROOT_DIR,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`${path} is not formatted; run npm run schema:fetch`, { cause: error });
  }
}

function parseJson(contents, source) {
  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`${source} is not valid JSON`, { cause: error });
  }
}
