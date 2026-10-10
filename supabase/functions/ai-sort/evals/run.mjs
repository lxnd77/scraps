// Eval for the ai-sort prompt: runs the 30 fixture scraps through the same input builder, prompt
// and validation the function uses, against the real model, and reports accuracy.
//
//   ANTHROPIC_API_KEY=... node --experimental-strip-types supabase/functions/ai-sort/evals/run.mjs
//   add --min 0.8 to fail below that accuracy, --verbose for every row
//
// A scrap counts as right when the suggested space (at confidence 0.5 or more) equals the expected
// one, or when it expects null and the model suggests no space. Nothing here touches the database.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  SYSTEM_PROMPT,
  buildSortInput,
  buildUserMessage,
  parseModelOutput,
  MIN_CONFIDENCE,
} from "../../_shared/aiSort.ts";
import { askClaude } from "../../_shared/aiSortService.ts";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("set ANTHROPIC_API_KEY to run the evals");
  process.exit(2);
}

const args = process.argv.slice(2);
const min = Number(args[args.indexOf("--min") + 1] || 0);
const verbose = args.includes("--verbose");

const fixtures = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures.json", import.meta.url)), "utf8"),
);
const spaces = fixtures.spaces.map((name, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  name,
}));
const nameOf = new Map(spaces.map((s) => [s.id, s.name]));

let right = 0;
let invalid = 0;
const confusion = new Map();
const rows = [];

for (const scrap of fixtures.scraps) {
  const input = buildSortInput({
    note: {
      title: scrap.title,
      text: scrap.text,
      linkTitle: scrap.linkTitle,
      linkDomain: scrap.linkDomain,
      transcript: scrap.transcript,
    },
    spaces,
    tags: fixtures.tags,
  });
  const answer = await askClaude(SYSTEM_PROMPT, buildUserMessage(input), { apiKey });
  const output = parseModelOutput(answer);
  if (!output) invalid += 1;
  const predicted =
    output && output.confidence >= MIN_CONFIDENCE && output.spaceId
      ? (nameOf.get(output.spaceId) ?? null)
      : null;
  const ok = predicted === scrap.expect;
  if (ok) right += 1;
  else {
    const key = `${scrap.expect ?? "(stay)"} -> ${predicted ?? "(none)"}`;
    confusion.set(key, (confusion.get(key) ?? 0) + 1);
  }
  rows.push({ ok, expect: scrap.expect, predicted, tags: output?.tags ?? [], text: scrap.text ?? scrap.linkTitle ?? scrap.transcript });
}

if (verbose) {
  for (const r of rows) {
    console.log(`${r.ok ? "ok  " : "MISS"} ${String(r.expect)} | ${String(r.predicted)} | ${r.tags.join(",")} | ${String(r.text).slice(0, 50)}`);
  }
}
const accuracy = right / fixtures.scraps.length;
console.log(`accuracy ${right}/${fixtures.scraps.length} = ${(accuracy * 100).toFixed(0)}%, unparsable answers ${invalid}`);
for (const [key, count] of [...confusion].sort((a, b) => b[1] - a[1])) console.log(`  ${count} x ${key}`);
if (accuracy < min) process.exit(1);
