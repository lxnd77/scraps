import { expect, test, type Browser, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import {
  captureScrap,
  completeOnboarding,
  signInFromCurrentPage,
  signUpAndOnboard,
  uniqueEmail,
} from "./helpers";

const title = (page: Page) => page.locator("h1[data-title]");
const body = (page: Page) => page.getByRole("textbox", { name: "scrap" });

/** The text of the document without the other person's caret labels. */
const documentText = (page: Page) =>
  body(page).evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll(".scrap-caret").forEach((node) => node.remove());
    return copy.innerText.replace(/s+/g, " ").trim();
  });

/** Opens the share dialog from the board, makes a link and returns it. */
async function makeInvite(
  page: Page,
  options: { role?: "editor" | "viewer"; maxUses?: number } = {},
): Promise<string> {
  await page.getByRole("button", { name: "share this space" }).click();
  const dialog = page.getByRole("dialog", { name: /^share /i });
  await expect(dialog).toBeVisible();
  if (options.role) {
    await dialog
      .getByRole("group", { name: "they can" })
      .getByRole("radio", { name: options.role })
      .check();
  }
  if (options.maxUses) await dialog.getByLabel("max people").fill(String(options.maxUses));
  await dialog.getByRole("button", { name: "make a link" }).click();
  const link = dialog.getByLabel("new link (shown once)");
  await expect(link).toBeVisible();
  const value = await link.inputValue();
  await dialog.getByRole("button", { name: "close" }).click();
  return value;
}

/** A second person in their own browser context: follows the invite, signs up and joins. */
async function joinAs(browser: Browser, baseURL: string, invite: string, name: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto(invite);
  await expect(page).toHaveURL(/\/sign-in/);
  await signInFromCurrentPage(page, uniqueEmail(name));
  await completeOnboarding(page, { name, birthYear: "2000", sticker: "heart" });
  // onboarding sends them back to the invite they came for
  await expect(page.getByRole("button", { name: "join" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "join" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}$/);
  return { context, page };
}

test.describe("sharing and live editing", () => {
  test.beforeEach(({ browserName }, testInfo) => {
    void browserName;
    test.skip(testInfo.project.name !== "desktop", "two-person flows run on desktop");
  });

  test("two people type into one note and see each other, with named carets", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signUpAndOnboard(page, "olive", "olive");
    await captureScrap(page, "shared note");
    const invite = await makeInvite(page, { role: "editor" });
    const maya = await joinAs(browser, baseURL!, invite, "maya");

    // olive opens the note; maya opens the same one from her board
    await page.getByRole("link", { name: "shared note", exact: true }).first().click();
    await maya.page.getByRole("link", { name: "shared note", exact: true }).first().click();
    await expect(title(page)).toBeVisible();
    await expect(title(maya.page)).toBeVisible();

    await title(page).click();
    await page.keyboard.press("Enter");
    await page.keyboard.type("from olive");
    await expect(body(maya.page)).toContainText("from olive", { timeout: 2000 });

    await title(maya.page).click();
    await maya.page.keyboard.press("Control+End");
    await maya.page.keyboard.press("Enter");
    await maya.page.keyboard.type("from maya");
    await expect(body(page)).toContainText("from maya", { timeout: 2000 });

    // both texts end up identical on both screens
    await expect(async () => {
      expect(await documentText(page)).toBe(await documentText(maya.page));
    }).toPass({ timeout: 5000 });

    // presence: the other person's avatar and a labelled caret
    await expect(page.getByRole("group", { name: "2 people" })).toBeVisible();
    await maya.page.keyboard.type(" more");
    await expect(page.locator(".scrap-caret__label", { hasText: "maya" })).toBeVisible();

    await maya.context.close();
  });

  test("a viewer can look but not type, tick or change anything", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signUpAndOnboard(page, "owner-view", "olive");
    await captureScrap(page, "groceries\nmilk\neggs", { list: true });
    const invite = await makeInvite(page, { role: "viewer" });
    const viewer = await joinAs(browser, baseURL!, invite, "vee");

    const card = viewer.page
      .locator('[data-note-id][data-kind="list"]')
      .filter({ hasText: "groceries" });
    await expect(card).toBeVisible();
    // no menu button for a viewer
    await expect(card.getByRole("button", { name: /^more for/ })).toHaveCount(0);

    await card.getByRole("link", { name: "groceries" }).click();
    await expect(title(viewer.page)).toBeVisible();
    await expect(viewer.page.getByText("view only")).toBeVisible();
    await expect(body(viewer.page)).toHaveAttribute("contenteditable", "false");
    await expect(viewer.page.getByRole("button", { name: /^mark done: milk/ })).toBeDisabled();

    await viewer.context.close();
  });

  test("removing a member shows them the no-access state within five seconds", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signUpAndOnboard(page, "owner-kick", "olive");
    await captureScrap(page, "kick test");
    const invite = await makeInvite(page, { role: "editor" });
    const guest = await joinAs(browser, baseURL!, invite, "gus");

    await guest.page.getByRole("link", { name: "kick test", exact: true }).first().click();
    await expect(title(guest.page)).toBeVisible();
    await expect(guest.page.getByRole("status").filter({ hasText: /saved/ })).toBeVisible();

    await page.getByRole("button", { name: "share this space" }).click();
    const dialog = page.getByRole("dialog", { name: /^share /i });
    await dialog.getByRole("button", { name: "remove gus" }).click();
    await expect(dialog.getByRole("button", { name: "remove gus" })).toHaveCount(0);

    await expect(
      guest.page.getByRole("heading", { name: "you no longer have access" }),
    ).toBeVisible({ timeout: 6000 });

    await guest.context.close();
  });

  test("an invite stops working after its max uses and when revoked", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signUpAndOnboard(page, "owner-invite", "olive");
    const single = await makeInvite(page, { role: "viewer", maxUses: 1 });
    const first = await joinAs(browser, baseURL!, single, "uno");

    // a second person finds the same link used up
    const other = await browser.newContext({ baseURL: baseURL! });
    const otherPage = await other.newPage();
    await otherPage.goto(single);
    await signInFromCurrentPage(otherPage, uniqueEmail("dos"));
    await completeOnboarding(otherPage, { name: "dos", birthYear: "2000", sticker: "heart" });
    await expect(otherPage.getByRole("heading", { name: "this link isn't working" })).toBeVisible({
      timeout: 20_000,
    });

    // a revoked link is just as dead
    const revocable = await makeInvite(page, { role: "viewer" });
    await page.getByRole("button", { name: "share this space" }).click();
    const dialog = page.getByRole("dialog", { name: /^share /i });
    // revoke until none are left; the list refreshes after each one
    for (let i = 0; i < 5; i++) {
      const left = dialog.getByRole("button", { name: "revoke" });
      if ((await left.count()) === 0) break;
      await left.first().click();
      await page.waitForTimeout(300);
    }
    await expect(dialog.getByText("no active links.")).toBeVisible();
    await dialog.getByRole("button", { name: "close" }).click();
    await otherPage.goto(revocable);
    await expect(otherPage.getByRole("heading", { name: "this link isn't working" })).toBeVisible();

    await first.context.close();
    await other.close();
  });

  test("a card created by someone else appears on the board live", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signUpAndOnboard(page, "owner-live", "olive");
    const invite = await makeInvite(page, { role: "editor" });
    const maya = await joinAs(browser, baseURL!, invite, "maya");

    const posted = maya.page.locator("[data-note-id]").filter({ hasText: "posted live" });
    await expect(posted).toHaveCount(0);
    await captureScrap(page, "posted live");
    await expect(posted).toBeVisible({ timeout: 8000 });
    await maya.context.close();
  });

  test("the share dialog has no axe violations", async ({ page }) => {
    await signUpAndOnboard(page, "owner-axe", "olive");
    await page.getByRole("button", { name: "share this space" }).click();
    await expect(page.getByRole("dialog", { name: /^share /i })).toBeVisible();
    await expectNoAxeViolations(page, "share dialog, day");
  });
});
