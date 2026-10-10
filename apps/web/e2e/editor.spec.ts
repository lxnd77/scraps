import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { signUpAndOnboard } from "./helpers";

const title = (page: Page) => page.locator("h1[data-title]");
const body = (page: Page) => page.getByRole("textbox", { name: "scrap" });

/** From the board: start a blank scrap and wait for the editor to be live. */
async function startScrap(page: Page) {
  await page.getByRole("button", { name: "new scrap" }).first().click();
  await expect(page).toHaveURL(/\/n\/[0-9a-f-]{36}$/);
  await expect(title(page)).toBeVisible();
  // the connection is authenticated and nothing is pending
  await expect(page.getByRole("status").filter({ hasText: /saved/ })).toBeVisible();
}

/** Focus the first block after the title, ready to type. */
async function focusBody(page: Page) {
  await title(page).click();
  await page.keyboard.press("Enter");
}

test.describe("editor", () => {
  test("write, add a checklist and a callout, reload: content is intact", async ({ page }) => {
    await signUpAndOnboard(page, "editor");
    await startScrap(page);

    await title(page).click();
    await page.keyboard.type("before bed (lol)");
    await page.keyboard.press("Enter");
    await page.keyboard.type("things to do before sleeping");
    await page.keyboard.press("Enter");

    // markdown: [] starts a checklist; Enter adds items
    await page.keyboard.type("[] drink water");
    await page.keyboard.press("Enter");
    await page.keyboard.type("plug in phone");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter"); // an empty item leaves the list

    // slash menu: callout
    await page.keyboard.type("/call");
    await expect(page.getByRole("listbox", { name: "drop a block" })).toBeVisible();
    await page.keyboard.press("Enter");
    await page.keyboard.type("charger is in the kitchen");

    await expect(page.locator("[data-callout]")).toContainText("charger is in the kitchen");

    // tick the first item with the real checkbox
    await page.getByRole("button", { name: /mark done: drink water/ }).click();
    await expect(page.getByRole("button", { name: /mark not done: drink water/ })).toBeVisible();

    await expect(page.getByRole("status").filter({ hasText: /saved/ })).toBeVisible();
    await page.reload();

    await expect(title(page)).toHaveText("before bed (lol)");
    await expect(body(page)).toContainText("things to do before sleeping");
    await expect(body(page)).toContainText("plug in phone");
    await expect(page.locator("[data-callout]")).toContainText("charger is in the kitchen");
    await expect(page.getByRole("button", { name: /mark not done: drink water/ })).toBeVisible();
  });

  test("the card on the board reflects the saved content", async ({ page }) => {
    await signUpAndOnboard(page, "preview");
    await startScrap(page);

    await title(page).click();
    await page.keyboard.type("goa trip");
    await page.keyboard.press("Enter");
    await page.keyboard.type("book train tickets for the goa trip");
    await expect(page.getByRole("status").filter({ hasText: /saved/ })).toBeVisible();

    await page.goto("/");
    const row = page.getByRole("link", { name: /goa trip/ });
    // the board is rendered once per navigation, and the server stores a moment after the last
    // change, so reload until the stored card shows up
    await expect(async () => {
      await page.reload();
      await expect(row).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15_000 });
    await expect(row).toContainText("book train tickets");
    await expect(row).toContainText("9 words");
  });

  test("slash menu: filter, arrows, enter, and escape", async ({ page }) => {
    await signUpAndOnboard(page, "slash");
    await startScrap(page);
    await focusBody(page);

    await page.keyboard.type("/");
    const menu = page.getByRole("listbox", { name: "drop a block" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("option")).toHaveCount(12);

    await page.keyboard.type("head");
    await expect(menu.getByRole("option")).toHaveCount(3);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter"); // second match: "heading"
    await page.keyboard.type("a section");
    await expect(body(page).locator("h2")).toHaveText("a section");

    await page.keyboard.press("Enter");
    await page.keyboard.type("/");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("markdown shortcuts build the text blocks", async ({ page }) => {
    await signUpAndOnboard(page, "markdown");
    await startScrap(page);
    await focusBody(page);

    await page.keyboard.type("# big one");
    await page.keyboard.press("Enter");
    await page.keyboard.type("- apples");
    await page.keyboard.press("Enter");
    await page.keyboard.type("pears");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("1. first");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("> go to sleep.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("---");
    await page.keyboard.type("``` ");
    await page.keyboard.type("const nap = true;");

    const editor = body(page);
    await expect(editor.locator("h1:not([data-title])")).toHaveText("big one");
    await expect(editor.locator("ul:not([data-type]) li")).toHaveCount(2);
    await expect(editor.locator("ol li")).toHaveText("first");
    await expect(editor.locator("p[data-big]")).toHaveText("go to sleep.");
    await expect(editor.locator("hr")).toHaveCount(1);
    await expect(editor.locator("pre code")).toHaveText("const nap = true;");
  });

  test("keyboard only: the title hands off to the body and cannot be merged away", async ({
    page,
  }) => {
    await signUpAndOnboard(page, "keys");
    await startScrap(page);

    await title(page).click();
    await page.keyboard.type("my title");
    await page.keyboard.press("Enter");
    await page.keyboard.type("first line");

    // Backspace at the start of the first block must not pull it into the title
    for (let i = 0; i < "first line".length; i++) await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await expect(title(page)).toHaveText("my title");
    await expect(body(page).locator("p")).toHaveCount(1);
  });

  test("a stranger gets the not-yours page, not the note", async ({ page, browser }) => {
    await signUpAndOnboard(page, "owner-note");
    await startScrap(page);
    await title(page).click();
    await page.keyboard.type("private thoughts");
    const url = new URL(page.url()).pathname;

    const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const otherPage = await other.newPage();
    await signUpAndOnboard(otherPage, "stranger-note", "stranger");
    await otherPage.goto(url);
    await expect(
      otherPage.getByRole("heading", { name: "this scrap isn't yours to see" }),
    ).toBeVisible();
    await expect(otherPage.getByText("private thoughts")).toHaveCount(0);
    await other.close();
  });

  test("more menu: colour, pin and delete take effect", async ({ page }) => {
    await signUpAndOnboard(page, "menu");
    await startScrap(page);
    await title(page).click();
    await page.keyboard.type("menu test");
    await expect(page.getByRole("status").filter({ hasText: /saved/ })).toBeVisible();

    await page.getByRole("button", { name: "more" }).click();
    const dialog = page.getByRole("dialog", { name: "this scrap" });
    await dialog.getByRole("radio", { name: "lime" }).check();
    await dialog.getByRole("button", { name: "pin it" }).click();
    await expect(dialog.getByRole("button", { name: "unpin" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.reload();
    await page.getByRole("button", { name: "more" }).click();
    const again = page.getByRole("dialog", { name: "this scrap" });
    await expect(again.getByRole("radio", { name: "lime" })).toBeChecked();
    await expect(again.getByRole("button", { name: "unpin" })).toBeVisible();

    await again.getByRole("button", { name: "delete" }).click();
    await again.getByRole("button", { name: "delete it" }).click();
    await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("link", { name: /menu test/ })).toHaveCount(0);
  });

  test("tags and chips are saved with the note", async ({ page }) => {
    await signUpAndOnboard(page, "chips");
    await startScrap(page);

    await page.getByRole("button", { name: "add tag" }).click();
    await page.getByLabel("new tag").fill("travel");
    await page.keyboard.press("Enter");
    await expect(page.getByText("#travel")).toBeVisible();

    await page.getByLabel("vibe").fill("chaotic");
    await page.getByLabel("vibe").blur();
    await page.getByLabel("when").fill("2026-11-14");

    // let the writes land, then reload
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByText("#travel")).toBeVisible();
    await expect(page.getByLabel("vibe")).toHaveValue("chaotic");
    await expect(page.getByLabel("when")).toHaveValue("2026-11-14");
  });

  test("a checklist item toggles from the keyboard", async ({ page }) => {
    await signUpAndOnboard(page, "keys-box");
    await startScrap(page);
    await focusBody(page);
    await page.keyboard.type("[] a thing to tick");

    const box = page.getByRole("button", { name: /mark done: a thing to tick/ });
    await box.focus();
    await expect(box).toBeFocused();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("button", { name: /mark not done: a thing to tick/ }),
    ).toBeVisible();
  });

  test("the editor page has no axe violations in both themes", async ({ page }) => {
    await signUpAndOnboard(page, "axe-editor");
    await startScrap(page);
    await title(page).click();
    await page.keyboard.type("accessible scrap");
    await page.keyboard.press("Enter");
    await page.keyboard.type("[] one");
    await page.keyboard.press("Enter");
    await page.keyboard.type("two");

    await expectNoAxeViolations(page, "editor, daylight");
    // the phone note screen has no toggle (SPEC 3.4), so switch by the device setting
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
    await expect(title(page)).toBeVisible();
    await expectNoAxeViolations(page, "editor, midnight");
  });
});
