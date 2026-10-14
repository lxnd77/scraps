import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  captureScrap,
  completeOnboarding,
  signInFromCurrentPage,
  signInWithMagicLink,
  signUpAndOnboard,
  uniqueEmail,
  settled,
  expectSynced,
} from "./helpers";

// 1x1 png for the picture capture
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const title = (page: Page) => page.locator("h1[data-title]");
const body = (page: Page) => page.getByRole("textbox", { name: "scrap" });
const cards = (page: Page) => page.locator("[data-note-id]");

test.describe("offline", () => {
  test.beforeEach(({ browserName }, testInfo) => {
    void browserName;
    test.skip(testInfo.project.name !== "desktop", "offline flows run on desktop");
  });

  /** The page is under service worker control, so cached copies can serve it offline. */
  async function controlled(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await settled(page);
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);
  }

  async function goOffline(context: BrowserContext) {
    await context.setOffline(true);
  }

  async function goOnline(context: BrowserContext, page: Page) {
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
  }

  async function savedChip(page: Page) {
    await expectSynced(page, 30_000);
  }

  test("the app is installable and the service worker controls the page", async ({
    page,
    context,
  }) => {
    await signUpAndOnboard(page, "pwa", "pwa");
    await controlled(page);

    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    const json = (await manifest.json()) as { display: string; icons: Array<{ sizes: string }> };
    expect(json.display).toBe("standalone");
    expect(json.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));

    // Chromium's own installability check, the same one Lighthouse reports
    const session = await context.newCDPSession(page);
    const result = (await session.send("Page.getInstallabilityErrors")) as {
      installabilityErrors: Array<{ errorId: string }>;
    };
    expect(result.installabilityErrors).toEqual([]);
  });

  test("a hard reload with no network shows the board from cache", async ({ page, context }) => {
    await signUpAndOnboard(page, "reload", "reload");
    await captureScrap(page, "still here offline");
    await controlled(page);
    await expect(cards(page).filter({ hasText: "still here offline" })).toBeVisible();
    // give the persisted query cache a moment to write
    await page.waitForTimeout(1500);

    await goOffline(context);
    await page.reload();
    await settled(page);
    await expect(cards(page).filter({ hasText: "still here offline" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "this page couldn't load" })).toHaveCount(0);
  });

  test("a note opened before can be edited offline, survives a reload, and syncs back", async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    const email = await signUpAndOnboard(page, "edit", "editor");
    await captureScrap(page, "offline notebook");
    await page.getByRole("link", { name: "offline notebook", exact: true }).first().click();
    await expect(title(page)).toBeVisible();
    await savedChip(page);
    await controlled(page);
    await expect(title(page)).toBeVisible();

    await goOffline(context);
    await title(page).click();
    await page.keyboard.press("Enter");
    await page.keyboard.type("written with no wifi");
    await expect(body(page)).toContainText("written with no wifi");

    // the chip admits it, and a reload still has the words
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /offline/ })
        .first(),
    ).toBeVisible({
      timeout: 10_000,
    });
    await page.reload();
    await settled(page);
    await expect(body(page)).toContainText("written with no wifi", { timeout: 20_000 });

    await goOnline(context, page);
    await savedChip(page);

    // another device (a fresh session for the same person) sees it, once
    const other = await signInElsewhere(browser, baseURL!, email);
    await other.page.getByRole("link", { name: "offline notebook", exact: true }).first().click();
    await expect(body(other.page)).toContainText("written with no wifi", { timeout: 20_000 });
    const text = await body(other.page).innerText();
    expect(text.match(/written with no wifi/g)).toHaveLength(1);
    await other.context.close();
  });

  test("scraps made offline (one with a picture) and a card tick all arrive exactly once", async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    const email = await signUpAndOnboard(page, "made", "maker");
    await captureScrap(page, "shopping\nmilk\neggs", { list: true });
    await expect(cards(page).filter({ hasText: "shopping" })).toBeVisible();
    // open it once so this device holds its document, then come back to the board
    await page.getByRole("link", { name: "shopping", exact: true }).first().click();
    await expect(title(page)).toBeVisible();
    await savedChip(page);
    await page.goBack();
    await controlled(page);
    await expect(cards(page).filter({ hasText: "shopping" })).toBeVisible();
    await page.waitForTimeout(1000);

    await goOffline(context);

    // two new scraps, one with a picture
    await captureScrap(page, "made offline one");
    const sheetPage = page;
    await sheetPage.getByRole("button", { name: "new scrap" }).first().click();
    const sheet = sheetPage.getByRole("dialog", { name: "new scrap" });
    await sheet.getByRole("radio", { name: "pic" }).click();
    await sheet.locator("input[type=file]").setInputFiles({
      name: "dot.png",
      mimeType: "image/png",
      buffer: PNG_1PX,
    });
    await sheet.getByRole("textbox", { name: "what's on your mind" }).fill("made offline two");
    await sheet.getByRole("button", { name: "save it" }).click();
    await expect(sheet).toBeHidden();
    await expect(cards(page).filter({ hasText: "made offline one" })).toBeVisible();
    await expect(cards(page).filter({ hasText: "made offline two" })).toBeVisible();

    // and tick a checklist item on a card
    const list = page.locator('[data-note-id][data-kind="list"]').filter({ hasText: "shopping" });
    await list.getByRole("button", { name: "milk, not done" }).click();
    await expect(list.getByRole("button", { name: "milk, done" })).toBeVisible();

    await goOnline(context, page);
    await savedChip(page);

    // a fresh session of the same person sees each scrap once, with the tick applied
    const other = await signInElsewhere(browser, baseURL!, email);
    await expect(cards(other.page).filter({ hasText: "made offline one" })).toHaveCount(1, {
      timeout: 20_000,
    });
    await expect(cards(other.page).filter({ hasText: "made offline two" })).toHaveCount(1);
    await expect(
      other.page
        .locator('[data-note-id][data-kind="list"]')
        .filter({ hasText: "shopping" })
        .getByRole("button", { name: "milk, done" }),
    ).toBeVisible({ timeout: 20_000 });
    await other.context.close();
  });

  test("a card cannot be ticked offline for a note this device never opened", async ({
    page,
    context,
  }) => {
    await signUpAndOnboard(page, "never", "never");
    // the starter checklist was created here, so it is cached; make one the device never held by
    // clearing the cached-note list, as a fresh browser profile would have
    await controlled(page);
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open("scraps-offline");
          open.onsuccess = () => {
            const tx = open.result.transaction("meta", "readwrite");
            tx.objectStore("meta").delete("cachedNotes");
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
          open.onerror = () => reject(open.error);
        }),
    );

    await goOffline(context);
    const list = page.locator('[data-note-id][data-kind="list"]').first();
    await list
      .getByRole("button", { name: /not done$/ })
      .first()
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: /open this scrap once online/ }),
    ).toBeVisible();
  });

  test("two people edit the same paragraph while one is offline and both edits survive", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signUpAndOnboard(page, "owner-off", "olive");
    await captureScrap(page, "shared offline");

    // olive invites maya as an editor
    await page.getByRole("button", { name: "share this space" }).click();
    const dialog = page.getByRole("dialog", { name: /^share /i });
    await dialog
      .getByRole("group", { name: "they can" })
      .getByRole("radio", { name: "editor" })
      .check();
    await dialog.getByRole("button", { name: "make a link" }).click();
    const invite = await dialog.getByLabel("new link (shown once)").inputValue();
    await dialog.getByRole("button", { name: "close" }).click();

    const mayaContext = await browser.newContext({ baseURL: baseURL! });
    const maya = await mayaContext.newPage();
    await maya.goto(invite);
    await signInFromCurrentPage(maya, uniqueEmail("maya"));
    await completeOnboarding(maya, { name: "maya", birthYear: "2000", sticker: "heart" });
    await maya.getByRole("button", { name: "join" }).click();
    await expect(maya).toHaveURL(/\/s\/[0-9a-f-]{36}$/);

    await page.getByRole("link", { name: "shared offline", exact: true }).first().click();
    await maya.getByRole("link", { name: "shared offline", exact: true }).first().click();
    await expect(title(page)).toBeVisible();
    await expect(title(maya)).toBeVisible();
    await savedChip(maya);

    // olive writes while maya is offline; maya writes the same paragraph offline
    await title(page).click();
    await page.keyboard.press("Enter");
    await page.keyboard.type("shared line");
    await expect(body(maya)).toContainText("shared line", { timeout: 10_000 });

    await mayaContext.setOffline(true);
    await title(maya).click();
    await maya.keyboard.press("ControlOrMeta+End");
    await maya.keyboard.type(" plus maya offline");
    await page.keyboard.type(" plus olive online");
    await page.waitForTimeout(500);

    await mayaContext.setOffline(false);
    await maya.evaluate(() => window.dispatchEvent(new Event("online")));

    for (const who of [page, maya]) {
      await expect(body(who)).toContainText("plus maya offline", { timeout: 20_000 });
      await expect(body(who)).toContainText("plus olive online", { timeout: 20_000 });
    }
    await mayaContext.close();
  });
});

/** The same person on a clean browser profile: nothing cached, signs in again. */
async function signInElsewhere(browser: Browser, baseURL: string, email: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await signInWithMagicLink(page, email);
  await expect(page).toHaveURL(/\/$/);
  return { context, page };
}
