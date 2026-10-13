// Renders the social card (og:image, 1200x630) in both themes into apps/web/public/og.
//
//   pnpm social-cards
//
// Colours, type, radius, border and shadow come from packages/ui/src/tokens.css, so the cards
// follow the design tokens. The font is the app's own self-hosted Bricolage Grotesque.
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { chromium } = createRequire(join(root, "apps/web/package.json"))("@playwright/test");

const tokens = readFileSync(join(root, "packages/ui/src/tokens.css"), "utf8");

const fontUrl = pathToFileURL(
  join(root, "apps/web/src/app/fonts/bricolage-grotesque-latin.woff2"),
).href;

const html = (theme) => `<!doctype html>
<html data-theme="${theme}"><head><meta charset="utf-8"><style>
${tokens}
@font-face { font-family: "Bricolage Grotesque"; font-weight: 200 800; src: url("${fontUrl}") format("woff2"); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; background: var(--bg); color: var(--ink);
  font-family: var(--ff-display); position: relative; }
.word { position: absolute; left: 72px; top: 150px; font-size: 190px; font-weight: 800;
  letter-spacing: -0.05em; line-height: 1; }
.word span { color: var(--c-pink); }
.tag { position: absolute; left: 78px; top: 380px; font-size: 38px; font-weight: 700;
  letter-spacing: -0.03em; white-space: nowrap; }
.chip { position: absolute; left: 78px; top: 462px; padding: 10px 22px; font-size: 24px; font-weight: 700;
  background: var(--inverse-bg); color: var(--inverse-ink); border-radius: var(--radius-pill); }
.card { position: absolute; padding: 22px 26px; border: var(--border) solid var(--line);
  border-radius: var(--radius-card); box-shadow: var(--shadow-xl) var(--shadow-ink);
  color: var(--on-accent); font-weight: 800; letter-spacing: -0.03em; }
.a { left: 690px; top: 40px; width: 340px; background: var(--c-yellow); transform: rotate(var(--tilt-1));
  font-size: 31px; box-shadow: var(--shadow-xl) var(--card-shadow-yellow); }
.b { left: 905px; top: 300px; width: 245px; background: var(--c-lime); transform: rotate(var(--tilt-4));
  font-size: 26px; box-shadow: var(--shadow-xl) var(--card-shadow-lime); }
.c { left: 640px; top: 400px; width: 240px; background: var(--c-pink); transform: rotate(var(--tilt-2));
  font-size: 30px; box-shadow: var(--shadow-xl) var(--card-shadow-pink); }
.d { left: 960px; top: 490px; width: 170px; height: 110px; background: var(--c-blue); color: var(--on-blue);
  transform: rotate(var(--tilt-3)); font-size: 26px; box-shadow: var(--shadow-xl) var(--card-shadow-blue); }
.row { display: flex; align-items: center; gap: 12px; font-size: 24px; margin-top: 12px; font-weight: 700; }
.box { width: 26px; height: 26px; border: var(--border-sm) solid currentColor; border-radius: var(--radius-xs); flex: none; }
.box.on { background: currentColor; }
</style></head><body>
<div class="word">scraps<span>.</span></div>
<div class="tag">your brain, but organised-ish.</div>
<div class="chip">notes, but loud</div>
<div class="card a">3am thought: the group chat, but a spreadsheet</div>
<div class="card b"><div>weekend</div>
  <div class="row"><i class="box on"></i>laundry</div>
  <div class="row"><i class="box"></i>call mum</div></div>
<div class="card c">ideas for the zine</div>
<div class="card d">#later</div>
</body></html>`;

const out = join(root, "apps/web/public/og");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [theme, file] of [
  ["day", "scraps-day.png"],
  ["midnight", "scraps-midnight.png"],
]) {
  await page.setContent(html(theme), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, file) });
  console.log("wrote", join("apps/web/public/og", file));
}
await browser.close();
