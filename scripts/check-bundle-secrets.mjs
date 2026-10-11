// Phase 9.7: fails if anything secret ended up in the browser bundle.
//
//   pnpm --filter @scraps/web build && pnpm check:bundle
//
// Scans apps/web/.next/static (everything that is served to browsers) for:
//   * the value of any secret named in the environment or a .env file (service role key, internal
//     secret, API keys),
//   * Supabase secret keys (`sb_secret_…`),
//   * JWTs whose role claim is `service_role`,
//   * PEM private keys.
// It prints file names and the kind of finding, never the secret itself.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const staticDir = join(root, "apps/web/.next/static");
if (!existsSync(staticDir)) {
  console.error("no build found: run `pnpm --filter @scraps/web build` first");
  process.exit(2);
}

const SECRET_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "INTERNAL_SECRET",
  "ANTHROPIC_API_KEY",
  "TRANSCRIPTION_API_KEY",
  "SUPABASE_JWT_SECRET",
  "SENTRY_AUTH_TOKEN",
];

/** KEY=value lines from the env files the apps and functions read. */
function envFileValues() {
  const files = [
    "apps/web/.env.local",
    "apps/collab/.env.local",
    "supabase/functions/.env",
    ".env",
    ".env.local",
  ];
  const out = new Map();
  for (const file of files) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out.set(m[1], m[2].replace(/^["']|["']$/g, ""));
    }
  }
  return out;
}

const fromFiles = envFileValues();
const secrets = [];
for (const name of SECRET_NAMES) {
  const value = process.env[name] ?? fromFiles.get(name);
  // short values would match by accident; real secrets are long
  if (value && value.length >= 16) secrets.push({ name, value });
}

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

function jwtRole(token) {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    return JSON.parse(json).role;
  } catch {
    return null;
  }
}

const findings = [];
let scanned = 0;
for (const file of files(staticDir)) {
  if (!/\.(js|css|html|json|map|txt)$/.test(file)) continue;
  scanned += 1;
  const text = readFileSync(file, "utf8");
  const rel = file.slice(root.length + 1).replaceAll("\\", "/");

  for (const secret of secrets) {
    if (text.includes(secret.value)) findings.push({ file: rel, kind: `value of ${secret.name}` });
  }
  if (/sb_secret_[A-Za-z0-9_-]{16,}/.test(text)) {
    findings.push({ file: rel, kind: "supabase secret key (sb_secret_…)" });
  }
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) {
    findings.push({ file: rel, kind: "private key" });
  }
  for (const token of text.match(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g) ?? []) {
    if (jwtRole(token) === "service_role") {
      findings.push({ file: rel, kind: "JWT with role service_role" });
    }
  }
}

console.log(
  `scanned ${scanned} files in .next/static against ${secrets.length} known secret value(s)`,
);
if (findings.length > 0) {
  for (const f of findings) console.error(`FOUND ${f.kind} in ${f.file}`);
  process.exit(1);
}
console.log("no secrets in the client bundle");
