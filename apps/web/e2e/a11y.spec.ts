import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { captureScrap, signUpAndOnboard } from "./helpers";

// Phase 9.5: axe on every route, in both themes. The cookie is what the server renders
// `data-theme` from, so setting it before navigating is the same as the person's saved choice.

// the worker would answer repeat visits from its page cache, with the other theme baked in
test.use({ serviceWorkers: "block" });

const THEMES = ["day", "midnight"] as const;

async function setTheme(page: Page, theme: (typeof THEMES)[number]) {
  const current = page.url();
  const origin = current.startsWith("http") ? new URL(current).origin : "http://localhost:3100";
  // a host-only cookie, like the one the app itself writes, so the two do not shadow each other
  await page.context().addCookies([{ name: "scraps-theme", value: theme, url: origin }]);
}

async function scan(page: Page, path: string, label: string, ready: () => Promise<void>) {
  for (const theme of THEMES) {
    await setTheme(page, theme);
    await page.goto(path);
    await ready();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      theme === "day" ? "day" : "midnight",
    );
    await expectNoAxeViolations(page, `${label}, ${theme}`);
  }
}

test.describe("accessibility: every route, both themes", () => {
  test("signed out routes", async ({ page }) => {
    await page.goto("/sign-in");
    await scan(page, "/sign-in", "sign-in", async () => {
      await expect(page.getByRole("button", { name: "send magic link" })).toBeVisible();
    });
    await scan(page, "/offline", "offline", async () => {
      await expect(page.getByRole("heading").first()).toBeVisible();
    });
    await scan(page, "/privacy", "privacy", async () => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
    await scan(page, "/terms", "terms", async () => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  });

  test("signed in routes", async ({ page }) => {
    test.setTimeout(180_000);
    await signUpAndOnboard(page, "a11y", "tester");
    await captureScrap(page, "a11y scrap");

    await scan(page, "/", "home", async () => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });

    // the first card's note, and this board's own space and trash pages
    await page.goto("/");
    const link = page.getByRole("link", { name: "a11y scrap", exact: true }).first();
    const noteHref = await link.getAttribute("href");
    await page.goto("/spaces");
    const spaceHref = await page
      .getByRole("main")
      .getByRole("link", { name: /brain dump/ })
      .first()
      .getAttribute("href");

    await scan(page, "/spaces", "spaces", async () => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
    await scan(page, "/lists", "lists", async () => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
    await scan(page, "/settings", "settings", async () => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
    if (spaceHref) {
      await scan(page, spaceHref, "space board", async () => {
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      });
      await scan(page, `${spaceHref}/trash`, "trash", async () => {
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      });
    }
    if (noteHref) {
      await scan(page, noteHref, "note", async () => {
        await expect(page.locator("h1[data-title]")).toBeVisible();
        await expect(page.getByRole("status").filter({ hasText: /saved/ })).toBeVisible();
      });
    }
  });
});

test.describe("motion and contrast preferences", () => {
  test("reduced motion removes card transitions and the checklist burst", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signUpAndOnboard(page, "reduced", "tester");
    const card = page.locator("[data-note-id]").first();
    await expect(card).toBeVisible();
    const style = await card.evaluate((el) => {
      const s = getComputedStyle(el);
      return { transition: s.transitionDuration, tilt: s.transform };
    });
    // durations come from --dur-* tokens, which are 0ms under reduced motion
    expect(style.transition.split(",").every((d) => d.trim() === "0s")).toBe(true);
  });

  test("more contrast thickens outlines and drops the tilt", async ({ page }) => {
    await signUpAndOnboard(page, "contrast", "tester");
    const before = await page
      .locator("[data-note-id]")
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopWidth);
    await page.emulateMedia({ contrast: "more" });
    const after = await page
      .locator("[data-note-id]")
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { width: s.borderTopWidth, transform: s.transform };
      });
    expect(parseFloat(after.width)).toBeGreaterThanOrEqual(parseFloat(before));
    expect(parseFloat(after.width)).toBeGreaterThanOrEqual(3);
    // no tilt: the rotation matrix is the identity (or none)
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(after.transform);
  });
});

test.describe("accessibility: dialogs", () => {
  test("delete account and the AI opt-in have no violations", async ({ page }) => {
    await signUpAndOnboard(page, "a11ydialogs", "tester", { freshAiPrompt: true });

    // the first capture asks about suggestions
    await captureScrap(page, "dialog scrap");
    const optIn = page.getByRole("dialog", { name: "turn on suggestions?" });
    await expect(optIn).toBeVisible();
    await expectNoAxeViolations(page, "ai opt-in, day");
    await optIn.getByRole("button", { name: "not now" }).click();

    await page.goto("/settings");
    await page.getByRole("button", { name: "delete account" }).click();
    await expect(page.getByRole("dialog", { name: "delete your account?" })).toBeVisible();
    await expectNoAxeViolations(page, "delete account, day");
    await page.keyboard.press("Escape");

    // midnight too
    await page.context().addCookies([
      { name: "scraps-theme", value: "midnight", url: new URL(page.url()).origin },
    ]);
    await page.reload();
    await page.getByRole("button", { name: "delete account" }).click();
    await expect(page.getByRole("dialog", { name: "delete your account?" })).toBeVisible();
    await expectNoAxeViolations(page, "delete account, midnight");
  });
});

test.describe("pickers", () => {
  test("the colour swatches in new space are actually coloured", async ({ page }) => {
    await signUpAndOnboard(page, "swatches", "tester");
    await page.goto("/spaces");
    await page.getByRole("main").getByRole("button", { name: "new space" }).click();
    const dialog = page.getByRole("dialog", { name: "new space" });
    await expect(dialog).toBeVisible();
    const colours = await dialog
      .locator(".picker__swatch")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    expect(colours).toHaveLength(6);
    // six different accents, not six copies of the plate colour
    expect(new Set(colours).size).toBe(6);
  });
});
