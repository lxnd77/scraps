// Phase 9.6: measures the board and note routes against SPEC 14.
//
//   pnpm build (apps/web) && start it:  pnpm --filter @scraps/web exec next start --port 3100
//   pnpm perf                           (needs the local stack, collab and Mailpit like the e2e)
//
// Signs up a throwaway user, then reports (a) gzip size of the JavaScript the board route loads,
// against the 180 KB budget, and (b) Lighthouse scores (mobile profile, simulated 4G) for the board
// and a note. Lighthouse attaches to the same Chromium over CDP, so it sees the signed-in app.
// Numbers from a laptop against a local server are a signal, not the hosted result.
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import lighthouse from "lighthouse";

// Playwright lives in apps/web
const { chromium } = createRequire(new URL("../apps/web/package.json", import.meta.url))(
  "@playwright/test",
);

const BASE = process.env.PERF_BASE_URL ?? "http://localhost:3100";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const PORT = 9333;
const JS_BUDGET_KB = 180;

async function magicLink(email) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const found = await (
      await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
    ).json();
    const id = found.messages?.[0]?.ID;
    if (id) {
      const message = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
      const body = `${message.HTML ?? ""} ${message.Text ?? ""}`;
      const match = /https?:\/\/[^\s"'<>]*\/auth\/confirm\?[^\s"'<>]+/.exec(body);
      if (match) return match[0].replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("no magic link arrived");
}

const email = `perf-${Date.now()}@scraps.test`;
const browser = await chromium.launchPersistentContext("", {
  headless: true,
  args: [`--remote-debugging-port=${PORT}`],
  viewport: { width: 412, height: 915 },
});
const page = browser.pages()[0] ?? (await browser.newPage());

// ---- sign up and onboard ----
await page.goto(`${BASE}/sign-in`);
await page.getByLabel("your email").fill(email);
await page.getByRole("button", { name: "send magic link" }).click();
await page.getByRole("heading", { name: "check your inbox" }).waitFor();
const link = new URL(await magicLink(email));
await page.goto(`${BASE}${link.pathname}${link.search}`);
await page.getByLabel("what should we call you?").fill("perf");
await page.getByLabel("what year were you born?").fill("2000");
await page.getByRole("radio", { name: "heart" }).check();
await page.getByRole("button", { name: "let's go" }).click();
await page.waitForURL(`${BASE}/`);
await page.getByRole("heading", { level: 1 }).waitFor();

// ---- JavaScript weight of the board route (cold load, caches cleared) ----
const scripts = new Map();
page.on("response", async (res) => {
  const url = res.url();
  if (!url.startsWith(BASE) || res.request().resourceType() !== "script") return;
  try {
    scripts.set(url, gzipSync(await res.body()).length);
  } catch {
    // redirected or aborted
  }
});
const cdp = await browser.newCDPSession(page);
await cdp.send("Network.clearBrowserCache");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const jsKb = [...scripts.values()].reduce((a, b) => a + b, 0) / 1024;
const top = [...scripts].sort((a, b) => b[1] - a[1]).slice(0, 8);
const editorLoaded = [...scripts.keys()].some((u) => /tiptap|prosemirror/i.test(u));
console.log(
  `board JS (gzip): ${jsKb.toFixed(0)} KB of ${JS_BUDGET_KB} KB budget ` +
    `(${scripts.size} scripts${editorLoaded ? ", editor chunk present by name" : ""})`,
);

for (const [url, bytes] of top) console.log(`  ${(bytes / 1024).toFixed(0).padStart(4)} KB  ${url.replace(BASE, "")}`);

// ---- a note to measure ----
const noteHref = await page.locator("[data-note-id] a").first().getAttribute("href");

// ---- Lighthouse ----
async function audit(path, label) {
  const result = await lighthouse(`${BASE}${path}`, {
    port: PORT,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices"],
  });
  const lhr = result.lhr;
  const score = (k) => Math.round((lhr.categories[k]?.score ?? 0) * 100);
  const a = lhr.audits;
  console.log(
    `${label}: performance ${score("performance")}, accessibility ${score("accessibility")}, ` +
      `best practices ${score("best-practices")} | LCP ${a["largest-contentful-paint"].displayValue}, ` +
      `TBT ${a["total-blocking-time"].displayValue}, CLS ${a["cumulative-layout-shift"].displayValue}`,
  );
  return { performance: score("performance"), accessibility: score("accessibility") };
}

const board = await audit("/", "board (mobile)");
if (noteHref) await audit(noteHref, "note (mobile)");

await browser.close();
if (jsKb > JS_BUDGET_KB || board.performance < 90 || board.accessibility < 100) {
  console.log("below target: see numbers above");
  process.exit(1);
}
