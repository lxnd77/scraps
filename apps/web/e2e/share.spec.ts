import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { signUpAndOnboard, expectSynced } from "./helpers";

const FUNCTIONS = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"}/functions/v1`;

// 1x1 png
const PNG_1PX_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const cards = (page: Page) => page.locator("[data-note-id]");
const sheetOf = (page: Page) => page.getByRole("dialog", { name: "new scrap" });

/** The page is under service worker control, so a share POST is answered by the worker. */
async function controlled(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
}

/**
 * What the OS does when the installed app is picked in a share sheet: a multipart form POST to
 * the manifest's share_target action, as a top level navigation.
 */
async function share(
  page: Page,
  fields: { title?: string; text?: string; url?: string },
  pictures = 0,
) {
  await page.evaluate(
    ({ fields, pictures, png }) => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/share-target";
      form.enctype = "multipart/form-data";
      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value as string;
        form.append(input);
      }
      if (pictures > 0) {
        const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
        const transfer = new DataTransfer();
        for (let i = 0; i < pictures; i++) {
          transfer.items.add(new File([bytes], `shared-${i}.png`, { type: "image/png" }));
        }
        const files = document.createElement("input");
        files.type = "file";
        files.name = "files";
        files.multiple = true;
        files.files = transfer.files;
        form.append(files);
      }
      document.body.append(form);
      form.submit();
    },
    { fields, pictures, png: PNG_1PX_BASE64 },
  );
}

test.describe("share target and capture", () => {
  test.beforeEach(({ browserName }, testInfo) => {
    void browserName;
    test.skip(testInfo.project.name !== "desktop", "share flows run on desktop");
  });

  test("a shared link opens the capture sheet as a link scrap, and saving makes the card", async ({
    page,
  }) => {
    await signUpAndOnboard(page, "share-link", "sharer");
    await controlled(page);

    await share(page, { title: "worth a watch", text: "see this https://example.com/ today" });

    const sheet = sheetOf(page);
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(sheet.getByRole("radio", { name: "link", checked: true })).toBeVisible();
    await expect(sheet.getByLabel("paste a link")).toHaveValue("https://example.com/");
    await expect(sheet.getByRole("textbox", { name: "what's on your mind" })).toHaveValue(
      "worth a watch",
    );
    // the share id is gone from the address bar
    await expect(page).not.toHaveURL(/capture=/);

    await sheet.getByRole("button", { name: "save it" }).click();
    await expect(sheet).toBeHidden();
    await expect(cards(page).filter({ hasText: "worth a watch" })).toBeVisible();
  });

  test("three shared photos become one mood board scrap", async ({ page }) => {
    await signUpAndOnboard(page, "share-pics", "sharer");
    await controlled(page);
    const before = await cards(page).count();

    await share(page, { title: "roof trip" }, 3);

    const sheet = sheetOf(page);
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(sheet.getByText("3 pics, they'll land as a mood board")).toBeVisible();
    await sheet.getByRole("button", { name: "save it" }).click();
    await expect(sheet).toBeHidden({ timeout: 20_000 });

    await expect(cards(page)).toHaveCount(before + 1, { timeout: 20_000 });
    await expect(cards(page).filter({ hasText: "roof trip" })).toBeVisible();
    // the note itself holds a mood board block with three images
    await cards(page).filter({ hasText: "roof trip" }).getByRole("link").first().click();
    await expect(page.locator("[data-type='moodBoard']")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-type='moodBoard'] img")).toHaveCount(3, { timeout: 20_000 });
  });

  test("sharing while offline queues the scrap and it syncs later", async ({
    page,
    context,
  }: {
    page: Page;
    context: BrowserContext;
  }) => {
    await signUpAndOnboard(page, "share-offline", "sharer");
    await controlled(page);
    // let the persisted board and the cached page settle before the network goes
    await page.waitForTimeout(1500);

    await context.setOffline(true);
    await share(page, { title: "shared with no wifi", text: "remember the charger" });

    const sheet = sheetOf(page);
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(sheet.getByRole("textbox", { name: "what's on your mind" })).toHaveValue(
      /shared with no wifi/,
    );
    await sheet.getByRole("button", { name: "save it" }).click();
    await expect(sheet).toBeHidden();
    await expect(cards(page).filter({ hasText: "shared with no wifi" })).toBeVisible();

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expectSynced(page, 30_000);

    // a fresh load from the server has it
    await page.goto("/");
    await expect(cards(page).filter({ hasText: "shared with no wifi" })).toBeVisible();
  });

  test("dropping a picture on the app opens the sheet with it ready", async ({ page }) => {
    await signUpAndOnboard(page, "drop", "dropper");

    await page.evaluate((png) => {
      const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], "dropped.png", { type: "image/png" }));
      for (const type of ["dragenter", "dragover", "drop"]) {
        document.body.dispatchEvent(
          new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }),
        );
      }
    }, PNG_1PX_BASE64);

    const sheet = sheetOf(page);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("radio", { name: "pic", checked: true })).toBeVisible();
    await expect(sheet.getByText("dropped.png")).toBeVisible();
    await sheet.getByRole("button", { name: "save it" }).isEnabled();
  });

  test("capture tokens: make one, use it, revoke it, and the function says 401", async ({
    page,
    request,
  }) => {
    await signUpAndOnboard(page, "token", "tokener");
    await page.goto("/settings");

    await page.getByRole("textbox", { name: "name this token" }).fill("e2e phone");
    await page.getByRole("button", { name: "make a token" }).click();
    const value = page.locator(".token-fresh__value");
    await expect(value).toBeVisible();
    const token = (await value.innerText()).trim();
    expect(token).toMatch(/^scr_[0-9a-f]{64}$/);
    await page.getByRole("button", { name: "done" }).click();
    await expect(page.getByText("e2e phone")).toBeVisible();
    await expect(page.getByText("never used")).toBeVisible();

    const auth = { authorization: `Bearer ${token}` };

    // a good request saves a text scrap
    const saved = await request.post(`${FUNCTIONS}/capture`, {
      headers: auth,
      data: { title: "from the shortcut", text: "saved by a token" },
    });
    expect(saved.status()).toBe(201);
    const body = (await saved.json()) as { noteId: string; url: string };
    expect(body.noteId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.url).toContain(`/n/${body.noteId}`);

    // it is on the board
    await page.goto("/");
    await expect(
      page.locator("[data-note-id]").filter({ hasText: "from the shortcut" }),
    ).toBeVisible({ timeout: 15_000 });

    // validation
    const empty = await request.post(`${FUNCTIONS}/capture`, { headers: auth, data: {} });
    expect(empty.status()).toBe(400);
    const private_ = await request.post(`${FUNCTIONS}/capture`, {
      headers: auth,
      data: { url: "http://169.254.169.254/latest/meta-data" },
    });
    expect(private_.status()).toBe(422);
    const noAuth = await request.post(`${FUNCTIONS}/capture`, { data: { text: "x" } });
    expect(noAuth.status()).toBe(401);

    // revoke from settings; the same token is refused afterwards
    await page.goto("/settings");
    await expect(page.getByText(/last used/)).toBeVisible();
    await page.getByRole("button", { name: "revoke e2e phone" }).click();
    await page
      .getByRole("group", { name: "e2e phone" })
      .getByRole("button", { name: "revoke" })
      .click();
    await expect(page.getByText("no tokens yet.")).toBeVisible();

    const refused = await request.post(`${FUNCTIONS}/capture`, {
      headers: auth,
      data: { text: "should not land" },
    });
    expect(refused.status()).toBe(401);
  });
});
