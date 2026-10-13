import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { bringIntoView, captureScrap, signUpAndOnboard, settled } from "./helpers";

const cards = (page: Page) => page.locator("[data-note-id]");
const listCards = (page: Page) => page.locator('[data-note-id][data-kind="list"]');

async function openSearch(page: Page) {
  if (test.info().project.name === "iphone-14") {
    await page.getByRole("button", { name: "find that one thing…" }).click();
  } else {
    await page.keyboard.press("ControlOrMeta+K");
  }
  await expect(page.getByRole("combobox", { name: "search" })).toBeVisible();
}

test.describe("board", () => {
  test("new users start with four scraps and a streak of one", async ({ page }) => {
    await signUpAndOnboard(page, "starters");
    await expect(cards(page)).toHaveCount(4);
    await expect(page.locator('[data-kind="list"]')).toContainText("try ticking these");
    await expect(page.locator('[data-kind="quote"]')).toContainText("organised-ish");
    // the sidebar streak card is desktop only; the count still has to be right there
    if (test.info().project.name === "desktop") {
      await expect(page.getByLabel(/streak/).first()).toContainText("1 day");
    }
  });

  test("capture a text and a list, filter to lists, pin one to the top", async ({ page }) => {
    await signUpAndOnboard(page, "capture");

    await captureScrap(page, "call the landlord\nabout the boiler");
    await expect(cards(page).filter({ hasText: "call the landlord" })).toContainText(
      "about the boiler",
    );

    await captureScrap(page, "groceries\nmilk\neggs", { list: true });
    await expect(listCards(page).filter({ hasText: "groceries" })).toContainText("milk");

    // filter chips carry counts; on the canvas the others dim and stay where they are
    const lists = page.getByRole("button", { name: /^lists/ });
    await expect(lists).toContainText("2");
    await lists.click();
    await expect(lists).toHaveAttribute("aria-pressed", "true");
    await expect(cards(page)).toHaveCount(6);
    await expect(page.locator(".canvas__card--dim")).toHaveCount(4);
    await page.getByRole("button", { name: /^everything/ }).click();
    await expect(page.locator(".canvas__card--dim")).toHaveCount(0);

    // pin the welcome scrap from its menu
    const welcome = cards(page).filter({ hasText: "welcome to scraps." });
    await bringIntoView(welcome);
    await welcome.getByRole("button", { name: /^more for/ }).click();
    await page.getByRole("button", { name: "pin it" }).click();
    await page.getByRole("button", { name: "close" }).click();
    await expect(welcome.getByLabel("pinned")).toBeVisible();
  });

  test("search finds a word inside a checklist item and opens the scrap", async ({ page }) => {
    await signUpAndOnboard(page, "search");
    await captureScrap(page, "errands\nbuy stamps\npost the parcel", { list: true });
    await expect(listCards(page).filter({ hasText: "errands" })).toContainText("buy stamps");

    await openSearch(page);
    const field = page.getByRole("combobox", { name: "search" });
    const hit = page.getByRole("option").filter({ hasText: "errands" });
    // the server indexes a new scrap when the collab server stores it, a moment after capture
    await expect(async () => {
      await field.fill("");
      await field.fill("stamps");
      await expect(hit).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(hit.locator("mark")).toHaveText("stamps");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/n\/[0-9a-f-]{36}$/);
    await expect(page.locator("h1[data-title]")).toHaveText("errands");
  });

  test("arrow keys move between cards and P pins", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "keyboard navigation is a desktop feature");
    await signUpAndOnboard(page, "keys");
    const links = page.locator(
      ".sc-notecard__title .sc-notecard__link, .sc-notecard__quote .sc-notecard__link",
    );
    await links.first().focus();
    const first = await links.first().textContent();
    await page.keyboard.press("ArrowRight");
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    expect(focused).not.toBe(first);
    await page.keyboard.press("ArrowLeft");
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe(first);

    // P pins the focused card
    await page.keyboard.press("p");
    await expect(
      page.locator("[data-note-id]", { has: page.locator(":focus") }).getByLabel("pinned"),
    ).toBeVisible();
  });

  test("N opens capture and Ctrl+Enter saves", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "hotkeys are a desktop feature");
    await signUpAndOnboard(page, "hotkey");
    await page.locator("body").press("n");
    const sheet = page.getByRole("dialog", { name: "new scrap" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("textbox", { name: "what's on your mind" })).toBeFocused();
    await page.keyboard.type("typed with the keyboard only");
    await page.keyboard.press("Control+Enter");
    await expect(sheet).toBeHidden();
    await expect(cards(page).filter({ hasText: "typed with the keyboard only" })).toBeVisible();
  });

  test("ticking a checklist item on a card shows up in the editor", async ({ page }) => {
    await signUpAndOnboard(page, "tick");
    await captureScrap(page, "packing\ntent\nstove", { list: true });
    const card = listCards(page).filter({ hasText: "packing" });
    await bringIntoView(card);
    await card.getByRole("button", { name: "tent, not done" }).click();
    await expect(card.getByRole("button", { name: "tent, done" })).toBeVisible();
    await expect(card).toContainText("1/2");

    await card.getByRole("link", { name: "packing" }).click();
    await expect(page).toHaveURL(/\/n\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("button", { name: /mark not done: tent/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /mark done: stove/ })).toBeVisible();
  });

  test("layout toggle switches to a compact list and is remembered", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "the switch layout button is desktop only");
    await signUpAndOnboard(page, "layout");
    await page.getByRole("button", { name: "switch to list view" }).click();
    await expect(page.locator(".board__rows")).toBeVisible();
    await page.reload();
    await settled(page);
    await expect(page.locator(".board__rows")).toBeVisible();
    await page.getByRole("button", { name: "switch to card view" }).click();
    await expect(page.locator(".canvas")).toBeVisible();
  });

  test("the board and the capture sheet have no axe violations in both themes", async ({
    page,
  }) => {
    await signUpAndOnboard(page, "axe");
    await expect(cards(page)).toHaveCount(4);
    await expectNoAxeViolations(page, "board, day");

    await page.getByRole("button", { name: "new scrap" }).first().click();
    await expect(page.getByRole("dialog", { name: "new scrap" })).toBeVisible();
    await expectNoAxeViolations(page, "capture sheet, day");
    await page.getByRole("button", { name: "close" }).click();

    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "midnight"));
    await expectNoAxeViolations(page, "board, midnight");
  });
});
