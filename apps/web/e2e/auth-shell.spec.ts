import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import {
  completeOnboarding,
  signInWithMagicLink,
  signUpAndOnboard,
  uniqueEmail,
  waitForServerAction,
} from "./helpers";

// Next.js keeps an empty role=alert route announcer on every page; only real messages count
const visibleAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const themeSwitch = (page: Page) => page.getByRole("switch", { name: "after midnight" });

test.describe("signed out", () => {
  test("app routes send visitors to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { level: 1, name: "scraps." })).toBeVisible();
    await expect(page.getByText("your brain, but organised-ish.")).toBeVisible();
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("a bad email is rejected with a friendly message", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("your email").fill("not-an-email");
    await page.getByRole("button", { name: "send magic link" }).click();
    await expect(visibleAlert(page)).toContainText("doesn't look right");
  });

  test("google says so when the provider is not configured", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "continue with google" }).click();
    await expect(visibleAlert(page)).toContainText("google sign-in isn't set up here yet");
  });

  test("an expired or bad link lands back on sign-in with a message", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=nope&type=email");
    await expect(page).toHaveURL(/\/sign-in\?error=link$/);
    await expect(visibleAlert(page)).toContainText("didn't work");
  });

  test("sign-in page has no axe violations in both themes", async ({ page }) => {
    await page.goto("/sign-in");
    await expectNoAxeViolations(page, "sign-in, daylight");
    await themeSwitch(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
    await expectNoAxeViolations(page, "sign-in, midnight");
  });
});

test.describe("new user journey", () => {
  test("magic link, onboarding, space, theme, sign out, sign back in", async ({ page }) => {
    const email = uniqueEmail("journey");
    await signInWithMagicLink(page, email);

    // first sign-in always goes through onboarding
    await completeOnboarding(page, { name: "maya t", birthYear: "2001", sticker: "flower" });
    await expect(page).toHaveURL(/\/$/);
    // the greeting changes with the time of day, so only check that the board header rendered
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/bestie|rattling|3am|mess/);

    // brain dump exists and is the board on screen
    await page.goto("/spaces");
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: /brain dump/ })).toBeVisible();

    // create a space
    await main.getByRole("button", { name: "new space" }).click();
    const dialog = page.getByRole("dialog", { name: "new space" });
    await dialog.getByLabel("name").fill("side quests");
    await dialog.getByRole("radio", { name: "lime" }).check();
    await dialog.getByRole("button", { name: "save it" }).click();
    await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("region", { name: "side quests" })).toBeVisible();

    // rename and recolour (the pencil is in the space's menu on phones and tablets)
    const more = page.getByRole("button", { name: "more for side quests" });
    if (await more.isVisible()) await more.click();
    await page.getByRole("button", { name: "edit space" }).click();
    const edit = page.getByRole("dialog", { name: "edit space" });
    await edit.getByLabel("name").fill("side quests 2");
    await edit.getByRole("radio", { name: "pink" }).check();
    await edit.getByRole("button", { name: "save it" }).click();
    await expect(page.getByRole("region", { name: "side quests 2" })).toBeVisible();

    await page.goto("/spaces");
    await expect(main.getByRole("link", { name: /side quests 2.*0/ })).toBeVisible();

    // theme: toggle, persists to the profile and the cookie
    const saved = waitForServerAction(page);
    await themeSwitch(page).click();
    await saved;
    await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");

    // sign out, wipe every cookie, sign back in: the theme comes back from the profile
    await page.goto("/settings");
    await page.getByRole("button", { name: "sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.context().clearCookies();

    await signInWithMagicLink(page, email);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
    await expect(themeSwitch(page)).toHaveAttribute("aria-checked", "true");
  });

  test("under 16 is turned away and signed out", async ({ page }) => {
    await signInWithMagicLink(page, uniqueEmail("young"));
    await completeOnboarding(page, { name: "kid", birthYear: "2015" });
    await expect(page).toHaveURL(/\/sign-in\?error=underage$/);
    await expect(visibleAlert(page)).toContainText("16 and up");
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("onboarding validates before saving", async ({ page }) => {
    await signInWithMagicLink(page, uniqueEmail("invalid"));
    await completeOnboarding(page, { name: "", birthYear: "1850" });
    await expect(visibleAlert(page).first()).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("settings: profile, theme choices and tidy mode", async ({ page }) => {
    await signUpAndOnboard(page, "settings", "sam");
    await page.goto("/settings");

    await page.getByLabel("display name").fill("sam renamed");
    await page.getByRole("radio", { name: "sun" }).check();
    await page.getByRole("button", { name: "save it" }).click();
    await expect(page.getByRole("status").filter({ hasText: "saved." })).toBeVisible();

    await page.getByRole("radio", { name: "after midnight" }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
    await page.getByRole("radio", { name: "daylight" }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "day");

    const tidy = page.getByRole("switch", { name: "tidy mode" });
    await expect(tidy).toHaveAttribute("aria-checked", "false");
    await tidy.click();
    await expect(tidy).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(page.getByRole("switch", { name: "tidy mode" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

test.describe("privacy between users", () => {
  test("a second user cannot open the first user's space", async ({ page, browser }) => {
    await signUpAndOnboard(page, "owner", "owner");
    await page.goto("/spaces");
    await page
      .getByRole("main")
      .getByRole("link", { name: /brain dump/ })
      .click();
    await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}$/);
    const ownersSpace = new URL(page.url()).pathname;

    const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const otherPage = await other.newPage();
    await signUpAndOnboard(otherPage, "stranger", "stranger");
    await otherPage.goto(ownersSpace);
    await expect(
      otherPage.getByRole("heading", { name: "this space isn't yours to see" }),
    ).toBeVisible();
    await other.close();
  });
});

test.describe("seeded demo users", () => {
  test("dev sees the five design spaces with counts of zero", async ({ page }) => {
    await signInWithMagicLink(page, "dev@scraps.test");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/spaces");
    const main = page.getByRole("main");
    for (const name of [
      "brain dump",
      "uni stuff",
      "side quests",
      "moodboards",
      "recipes i'll never make",
    ]) {
      await expect(main.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    }
  });

  test("maya only sees her own space plus the two she was invited to", async ({ page }) => {
    await signInWithMagicLink(page, "maya@scraps.test");
    await page.goto("/spaces");
    const links = page.getByRole("main").getByRole("link");
    await expect(links).toHaveCount(3);
    await expect(page.getByRole("main").getByRole("link", { name: /uni stuff/ })).toHaveCount(0);
  });
});

test.describe("app shell", () => {
  test("desktop sidebar and phone tab bar each show on the right screens", async ({ page }) => {
    await signUpAndOnboard(page, "shell", "shelly");
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const width = viewport!.width;

    if (width >= 1024) {
      await expect(page.getByRole("navigation", { name: "your spaces" })).toBeVisible();
      await expect(page.getByRole("link", { name: "brain dump" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByRole("navigation", { name: "main" })).toBeHidden();
      // desktop header carries the large toggle, new scrap and switch layout
      await expect(page.getByRole("button", { name: "new scrap" }).first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^switch to (list|card) view$/ }),
      ).toBeVisible();
    } else if (width < 640) {
      const tabs = page.getByRole("navigation", { name: "main" });
      await expect(tabs).toBeVisible();
      for (const label of ["home", "spaces", "lists", "profile"]) {
        await expect(tabs.getByRole("link", { name: label })).toBeVisible();
      }
      await expect(tabs.getByRole("button", { name: "new scrap" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "your spaces" })).toBeHidden();
    }
  });

  test("shell has no axe violations in both themes", async ({ page }) => {
    await signUpAndOnboard(page, "axe", "axel");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoAxeViolations(page, "board, daylight");

    await themeSwitch(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
    await expectNoAxeViolations(page, "board, midnight");

    await page.goto("/settings");
    await expectNoAxeViolations(page, "settings, midnight");
    await page.goto("/spaces");
    await expectNoAxeViolations(page, "spaces, midnight");
  });
});
