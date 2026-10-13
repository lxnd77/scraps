import { expect, type Page } from "@playwright/test";

// Local Supabase mail catcher (Mailpit, started by `pnpm db:start`).
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function uniqueEmail(label: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `e2e-${label}-${Date.now()}-${rand}@scraps.test`;
}

interface MailpitSearch {
  messages?: Array<{ ID: string }>;
}
interface MailpitMessage {
  HTML?: string;
  Text?: string;
}

/** Waits for the newest mail to `email` and returns the sign-in link in it. */
async function magicLinkFor(email: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const found = (await res.json()) as MailpitSearch;
    const id = found.messages?.[0]?.ID;
    if (id) {
      const message = (await (
        await fetch(`${MAILPIT}/api/v1/message/${id}`)
      ).json()) as MailpitMessage;
      const body = `${message.HTML ?? ""} ${message.Text ?? ""}`;
      const match = /https?:\/\/[^\s"'<>]*\/auth\/confirm\?[^\s"'<>]+/.exec(body);
      if (match) return match[0].replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`no magic link arrived for ${email}`);
}

/** Requests a magic link on /sign-in and follows it, on the app under test. */
export async function signInWithMagicLink(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("your email").fill(email);
  await page.getByRole("button", { name: "send magic link" }).click();
  await expect(page.getByRole("heading", { name: "check your inbox" })).toBeVisible();

  const link = new URL(await magicLinkFor(email));
  // the email points at the site_url from Supabase config; open it on whatever origin runs the test
  const base = new URL(page.url());
  await page.goto(`${base.origin}${link.pathname}${link.search}`);
}

export interface OnboardingInput {
  name: string;
  birthYear: string;
  sticker?: string;
}

export async function completeOnboarding(page: Page, input: OnboardingInput): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("what should we call you?").fill(input.name);
  await page.getByLabel("what year were you born?").fill(input.birthYear);
  if (input.sticker) await page.getByRole("radio", { name: input.sticker }).check();
  await page.getByRole("button", { name: "let's go" }).click();
}

/**
 * Signs in a brand new user and finishes onboarding; lands on the board.
 *
 * A new user's first capture asks about AI suggestions. Most specs are not about that, so by
 * default the question is answered (on, then off, through settings) before the test starts.
 * Pass `{ freshAiPrompt: true }` to leave it unanswered.
 */
export async function signUpAndOnboard(
  page: Page,
  label: string,
  name = "tester",
  options: { freshAiPrompt?: boolean } = {},
) {
  const email = uniqueEmail(label);
  await signInWithMagicLink(page, email);
  await completeOnboarding(page, { name, birthYear: "2000", sticker: "heart" });
  await expect(page).toHaveURL(/\/$/);
  if (!options.freshAiPrompt) {
    await page.goto("/settings");
    const toggle = page.getByRole("switch", { name: "suggest where scraps go" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await page.goto("/");
  }
  return email;
}

/** Resolves once the next server action POST has finished (used after toggling the theme). */
export function waitForServerAction(page: Page) {
  return page.waitForResponse(
    (res) =>
      res.request().method() === "POST" && res.request().headers()["next-action"] !== undefined,
  );
}

/** Opens quick capture from the board, types `text`, saves it and waits for the sheet to close. */
export async function captureScrap(page: Page, text: string, options: { list?: boolean } = {}) {
  await page.getByRole("button", { name: "new scrap" }).first().click();
  const sheet = page.getByRole("dialog", { name: "new scrap" });
  await expect(sheet).toBeVisible();
  if (options.list) await sheet.getByRole("radio", { name: "list" }).click();
  await sheet.getByRole("textbox", { name: "what's on your mind" }).fill(text);
  await sheet.getByRole("button", { name: "save it" }).click();
  await expect(sheet).toBeHidden();
}

/** Requests a magic link from the sign-in page the browser is already on and follows it. */
export async function signInFromCurrentPage(page: Page, email: string): Promise<void> {
  await page.getByLabel("your email").fill(email);
  await page.getByRole("button", { name: "send magic link" }).click();
  await expect(page.getByRole("heading", { name: "check your inbox" })).toBeVisible();
  const link = new URL(await magicLinkFor(email));
  const base = new URL(page.url());
  await page.goto(`${base.origin}${link.pathname}${link.search}`);
}

/**
 * After a full load of a board or scrap: their loading.tsx means the page streams in behind a
 * skeleton, and React reveals it a moment after `load`. Until then a hidden copy (div#S:0) is in
 * the DOM and text locators see two matches.
 */
export async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.querySelector("div[hidden][id^='S:']"));
}
