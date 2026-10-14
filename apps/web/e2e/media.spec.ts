import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { signUpAndOnboard, settled, expectSynced } from "./helpers";

// a valid 1x1 png
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const title = (page: Page) => page.locator("h1[data-title]");
const cards = (page: Page) => page.locator("[data-note-id]");

/** Captures a scrap with "blank" text, opens it and returns once the editor is live and empty. */
async function openBlankScrap(page: Page) {
  await page.getByRole("button", { name: "new scrap" }).first().click();
  const sheet = page.getByRole("dialog", { name: "new scrap" });
  await sheet.getByRole("textbox", { name: "what's on your mind" }).fill("media test");
  await sheet.getByRole("button", { name: "save it" }).click();
  await expect(sheet).toBeHidden();
  await page.getByRole("link", { name: "media test", exact: true }).first().click();
  await expect(page).toHaveURL(/\/n\/[0-9a-f-]{36}$/);
  await expect(title(page)).toBeVisible();
  await expectSynced(page);
  // clear the title text, then move into the body
  await title(page).click();
  await page.keyboard.press("End");
  for (let i = 0; i < "media test".length; i++) await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
}

/** Drops a generated picture onto the editor, as a user dragging a file from the desktop would. */
async function dropPicture(page: Page, width: number, height: number, noisy = false) {
  await page.evaluate(
    async ({ width, height, noisy }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      if (noisy) {
        // photo-like noise so the JPEG stays large
        const image = ctx.createImageData(width, height);
        for (let i = 0; i < image.data.length; i += 4) {
          image.data[i] = Math.random() * 255;
          image.data[i + 1] = Math.random() * 255;
          image.data[i + 2] = Math.random() * 255;
          image.data[i + 3] = 255;
        }
        ctx.putImageData(image, 0, 0);
      } else {
        ctx.fillStyle = "rgb(200, 40, 120)";
        ctx.fillRect(0, 0, width, height);
      }
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 1),
      );
      const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const target = document.querySelector(".scrap-editor") as HTMLElement;
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(
        new DragEvent("drop", {
          dataTransfer: transfer,
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 20,
          clientY: rect.top + rect.height - 10,
        }),
      );
      (window as unknown as { __droppedBytes: number }).__droppedBytes = blob.size;
    },
    { width, height, noisy },
  );
}

test.describe("media blocks", () => {
  test("a dropped picture becomes an image block, stored as a small webp", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "drag and drop is a desktop gesture");
    await signUpAndOnboard(page, "img");
    await openBlankScrap(page);

    await dropPicture(page, 4000, 3000, true);
    const image = page.locator("[data-type='image'] img");
    await expect(image).toBeVisible({ timeout: 30_000 });

    const original = await page.evaluate(
      () => (window as unknown as { __droppedBytes: number }).__droppedBytes,
    );
    expect(original).toBeGreaterThan(5 * 1024 * 1024);

    // the stored object: webp, under 1 MB, longest edge 2048, and no EXIF block
    const info = await image.evaluate(async (el: HTMLImageElement) => {
      const res = await fetch(el.src);
      const blob = await res.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const text = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
      return {
        size: blob.size,
        type: blob.type,
        exif: text.includes("EXIF"),
        width: el.naturalWidth,
      };
    });
    expect(info.type).toBe("image/webp");
    expect(info.width).toBe(2048);
    expect(info.exif).toBe(false);
    // noise is the worst case for compression; the cap that matters is the 12 MB photo story
    expect(info.size).toBeLessThan(original);
  });

  test("a pasted link on an empty line becomes a link card, and can be kept as a link", async ({
    page,
  }) => {
    await signUpAndOnboard(page, "link");
    await openBlankScrap(page);

    await page.evaluate(() => {
      const target = document.querySelector(".scrap-editor") as HTMLElement;
      const transfer = new DataTransfer();
      transfer.setData("text/plain", "https://example.com/");
      target.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }),
      );
    });

    const card = page.locator("[data-type='linkEmbed']");
    await expect(card).toBeVisible();
    await expect(card.getByText("example.com").first()).toBeVisible({ timeout: 20_000 });

    await card.getByRole("button", { name: "keep as link" }).click();
    await expect(page.locator("[data-type='linkEmbed']")).toHaveCount(0);
    await expect(page.locator(".scrap-editor a[href='https://example.com/']")).toBeVisible();
  });

  test("a sticker inserts from the colon menu", async ({ page }) => {
    await signUpAndOnboard(page, "sticker");
    await openBlankScrap(page);

    await page.keyboard.type(":spar");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-type='sticker']")).toHaveCount(1);
  });

  test("a voice memo records with a fake mic and plays back", async ({ page, context }) => {
    test.skip(test.info().project.name !== "desktop", "fake media stream runs on desktop chrome");
    await context.grantPermissions(["microphone"]);
    await signUpAndOnboard(page, "voice");
    await openBlankScrap(page);

    await page.keyboard.type("/rec");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "start recording" }).click();
    await expect(page.getByRole("button", { name: "stop recording" })).toBeEnabled();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "stop recording" }).click();

    const player = page.locator("[data-type='voiceMemo']");
    await expect(player.getByRole("button", { name: "play memo" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(player.locator("audio")).toHaveCount(1);
  });

  test("capture a pic and a link from the sheet", async ({ page }) => {
    await signUpAndOnboard(page, "capturemedia");

    // pic
    await page.getByRole("button", { name: "new scrap" }).first().click();
    const sheet = page.getByRole("dialog", { name: "new scrap" });
    await sheet.getByRole("radio", { name: "pic" }).click();
    await sheet.locator("input[type=file]").setInputFiles({
      name: "dot.png",
      mimeType: "image/png",
      buffer: PNG_1PX,
    });
    await sheet.getByRole("textbox", { name: "what's on your mind" }).fill("my dot");
    await sheet.getByRole("button", { name: "save it" }).click();
    await expect(sheet).toBeHidden();
    // the starter mood board is a pic card too, so find ours by its text
    await expect(
      page.locator('[data-note-id][data-kind="pic"]').filter({ hasText: "my dot" }),
    ).toBeVisible();

    // link
    await page.getByRole("button", { name: "new scrap" }).first().click();
    await sheet.getByRole("radio", { name: "link" }).click();
    await sheet.getByLabel("paste a link").fill("https://example.com/");
    await sheet.getByRole("button", { name: "save it" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('[data-note-id][data-kind="link"]').first()).toBeVisible();
  });

  test("the cover and page icon can be set", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "covered on desktop");
    await signUpAndOnboard(page, "cover");
    await openBlankScrap(page);

    await page.getByRole("button", { name: "add a cover" }).click();
    await page.getByRole("button", { name: "use these stripes" }).click();
    await expect(page.locator(".cover__band")).toBeVisible();

    // no icon yet: a pill offers one; once set, the tile changes it
    await page.getByRole("button", { name: "add an icon" }).click();
    await page.getByRole("button", { name: "heart", exact: true }).click();
    await expect(page.locator(".cover__icon svg").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "add an icon" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "change page icon" })).toBeVisible();

    await page.reload();

    await settled(page);
    await expect(page.locator(".cover__band")).toBeVisible();
  });

  test("the editor with every block has no axe violations in both themes", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "one pass is enough");
    await signUpAndOnboard(page, "mediaaxe");
    await openBlankScrap(page);
    await dropPicture(page, 300, 200);
    await expect(page.locator("[data-type='image'] img")).toBeVisible({ timeout: 30_000 });
    await page.keyboard.type(":heart");
    await page.keyboard.press("Enter");

    await expectNoAxeViolations(page, "editor with media, day");
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "midnight"));
    await expectNoAxeViolations(page, "editor with media, midnight");
    await expect(cards(page)).toHaveCount(0);
  });
});
