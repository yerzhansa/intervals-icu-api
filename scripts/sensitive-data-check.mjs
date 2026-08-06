import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const listedFiles = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  },
);

if (listedFiles.status !== 0) {
  process.stderr.write("Sensitive-data scan could not enumerate repository files.\n");
  process.exit(1);
}

const placeholderPatterns = [
  /^(?:\.{3,}|x+)$/iu,
  /^<[^>]+>$/u,
  /^(?:dummy|example|fake|fixture|my|oauth|placeholder|sample|synthetic|test|your)(?:[-_ ].*)?$/iu,
  /^(?:process\.env\.|\$\{\{?\s*(?:env|secrets)\.)/iu,
];

function isPlaceholder(value) {
  const normalized = value.trim();
  return placeholderPatterns.some((pattern) => pattern.test(normalized));
}

const rules = [
  {
    name: "private-key-material",
    detects: (text) => /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u.test(text),
  },
  {
    name: "npm-access-token",
    detects: (text) => /\bnpm_[A-Za-z0-9]{36,}\b/u.test(text),
  },
  {
    name: "github-access-token",
    detects: (text) =>
      /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{40,})\b/u.test(text),
  },
  {
    name: "aws-access-key",
    detects: (text) => /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u.test(text),
  },
  {
    name: "intervals-athlete-id",
    detects: (text) => {
      const athleteIds = text.match(/\bi\d{5,}\b/gu) ?? [];
      return athleteIds.some((athleteId) => athleteId !== "i12345");
    },
  },
  {
    name: "jwt",
    detects: (text) =>
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u.test(text),
  },
  {
    name: "credential-assignment",
    detects: (text) => {
      const assignments = text.matchAll(
        /\b(?:api[_-]?key|apiKey|bearer[_-]?token|bearerToken|access[_-]?token|accessToken|auth[_-]?token|authToken|password|passwd|secret)\b\s*[:=]\s*["']([^"'\r\n]{8,})["']/giu,
      );
      return [...assignments].some((match) => !isPlaceholder(match[1]));
    },
  },
  {
    name: "credential-environment-value",
    detects: (text) => {
      const assignments = text.matchAll(
        /^(?:export\s+)?(?:INTERVALS_API_KEY|NPM_TOKEN|NODE_AUTH_TOKEN|API_KEY|BEARER_TOKEN|ACCESS_TOKEN|AUTH_TOKEN|PASSWORD|SECRET)\s*=\s*([^\s#]+)/gimu,
      );
      return [...assignments].some((match) => !isPlaceholder(match[1]));
    },
  },
  {
    name: "authorization-literal",
    detects: (text) => {
      const assignments = text.matchAll(
        /\bAuthorization\b\s*[:=]\s*["'](?:Basic|Bearer)\s+([^"'\s]{8,})["']/giu,
      );
      return [...assignments].some((match) => !isPlaceholder(match[1]));
    },
  },
  {
    name: "sensitive-log",
    detects: (text) =>
      text
        .split(/\r?\n/u)
        .some(
          (line) =>
            /\b(?:console|logger|log)\.(?:debug|error|info|log|trace|warn)\s*\(/u.test(line) &&
            /\b(?:apiKey|api_key|athleteId|athlete_id|authorization|bearerToken|password|secret|token)\b/iu.test(
              line,
            ),
        ),
  },
];

const files = listedFiles.stdout.split("\0").filter(Boolean).sort();
const violations = [];
let checkedFiles = 0;

for (const relativePath of files) {
  const absolutePath = resolve(repositoryRoot, relativePath);
  if (!existsSync(absolutePath) || !lstatSync(absolutePath).isFile()) continue;

  const bytes = readFileSync(absolutePath);
  if (bytes.includes(0)) continue;

  checkedFiles += 1;
  const text = bytes.toString("utf8");
  for (const rule of rules) {
    if (rule.detects(text)) violations.push({ path: relativePath, rule: rule.name });
  }
}

if (violations.length > 0) {
  process.stderr.write("Sensitive-data scan failed:\n");
  for (const violation of violations) {
    process.stderr.write(`- ${violation.rule}: ${violation.path}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `Sensitive-data scan passed (${checkedFiles} repository text files checked).\n`,
);
