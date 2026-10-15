// Why are suggestions not showing up? Checks the pieces in order: the functions are being served,
// the ai-sort function answers, and it has an ANTHROPIC_API_KEY. It never sends note content.
//
//   pnpm ai:check                      local stack (reads apps/web/.env.local)
//   SUPABASE_URL=https://x.supabase.co SUPABASE_ANON_KEY=... pnpm ai:check   a hosted project
//
// Add --verify to also ask Anthropic whether the key is real and can use the model (a free
// metadata call, no tokens). It needs the internal secret: read from supabase/functions/.env
// locally, or INTERNAL_SECRET=... for a hosted project.
import { readFileSync } from "node:fs";

function fromEnvFile(name, file = "../apps/web/.env.local") {
  try {
    const text = readFileSync(new URL(file, import.meta.url), "utf8");
    return text.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const url =
  process.env.SUPABASE_URL ?? fromEnvFile("NEXT_PUBLIC_SUPABASE_URL") ?? "http://127.0.0.1:54321";
const anon =
  process.env.SUPABASE_ANON_KEY ??
  fromEnvFile("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
  fromEnvFile("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const local = /127\.0\.0\.1|localhost/.test(url);

const fail = (why, fix) => {
  console.log(`\n  no: ${why}\n  fix: ${fix}\n`);
  process.exit(1);
};

console.log(`checking ai-sort at ${url}`);
let response;
try {
  response = await fetch(`${url}/functions/v1/ai-sort`, {
    headers: anon ? { apikey: anon, authorization: `Bearer ${anon}` } : {},
    signal: AbortSignal.timeout(10_000),
  });
} catch (error) {
  fail(
    `could not reach ${url} (${error.message})`,
    local ? "start the local stack: pnpm db:start" : "check SUPABASE_URL",
  );
}

if (response.status === 404 || response.status === 503 || response.status === 502) {
  fail(
    `the functions gateway answered ${response.status}, so ai-sort is not being served`,
    local
      ? "run `pnpm functions` in another terminal (pnpm dev does not start it)"
      : "deploy it: supabase functions deploy ai-sort",
  );
}
const body = await response.json().catch(() => null);
if (!response.ok || body?.status !== "ok") {
  fail(`ai-sort answered ${response.status} ${JSON.stringify(body)}`, "read the function logs");
}
if (body.configured === undefined) {
  fail("ai-sort is an older build without the check", "restart `pnpm functions` or redeploy");
}
if (!body.configured) {
  fail(
    "ai-sort has no ANTHROPIC_API_KEY",
    local
      ? "add ANTHROPIC_API_KEY=... to supabase/functions/.env and restart `pnpm functions`"
      : "supabase secrets set ANTHROPIC_API_KEY=...",
  );
}
if (process.argv.includes("--verify")) {
  const secret =
    process.env.INTERNAL_SECRET ??
    (local ? fromEnvFile("INTERNAL_SECRET", "../supabase/functions/.env") : undefined);
  if (!secret) {
    fail("--verify needs the internal secret", "INTERNAL_SECRET=... pnpm ai:check --verify");
  }
  const checked = await fetch(`${url}/functions/v1/ai-sort?verify=1`, {
    headers: {
      ...(anon ? { apikey: anon, authorization: `Bearer ${anon}` } : {}),
      "x-internal-secret": secret,
    },
    signal: AbortSignal.timeout(20_000),
  }).catch((error) => fail(`could not reach ai-sort (${error.message})`, "try again"));
  if (checked.status === 403) {
    fail("the internal secret did not match", "use the value set with supabase secrets");
  }
  const key = await checked.json().catch(() => null);
  if (key?.keyValid === undefined) {
    fail(
      "ai-sort is an older build without --verify",
      "redeploy: supabase functions deploy ai-sort",
    );
  }
  if (key.status === null) {
    fail(`ai-sort could not reach Anthropic (${key.error})`, "check the function logs, try again");
  }
  if (!key.keyValid) {
    fail(
      `Anthropic rejected the key (${key.status} ${key.error ?? ""})`.trim(),
      "make a key in the Anthropic console, in the workspace you are watching, then " +
        (local
          ? "put it in supabase/functions/.env and restart `pnpm functions`"
          : "supabase secrets set ANTHROPIC_API_KEY=..."),
    );
  }
  if (!key.modelAvailable) {
    fail(
      `the key works but cannot use the sort model (${key.status} ${key.error ?? ""})`.trim(),
      "check the model id in supabase/functions/_shared/aiSort.ts and the key's workspace access",
    );
  }
  console.log("\n  yes: Anthropic accepts the key and the sort model is available.");
}

console.log(`
  yes: ai-sort is served and has a key.
  still nothing? check that suggestions are on in settings, then ask for one from a card's menu
  with the browser console open: every request that ends without a suggestion logs [ai-sort] and
  the reason (empty, model_error with the vendor status, bad_output, unsure).
`);
