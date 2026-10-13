import { expect, test, type Locator, type Page } from "@playwright/test";
import { captureScrap, settled, signUpAndOnboard } from "./helpers";

const card = (page: Page, text: string) =>
  page.locator(".canvas__card").filter({ has: page.locator("[data-note-id]", { hasText: text }) });

/** Where a canvas card sits, read from its transform (world px). */
async function position(item: Locator) {
  const style = (await item.getAttribute("style")) ?? "";
  const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(style);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

/** A real mouse drag from the card's title, which is a link (the browser would drag it natively). */
async function dragByTitle(
  page: Page,
  item: Locator,
  to: { dx: number; dy: number } | { x: number; y: number },
) {
  const box = (await item.locator(".sc-notecard__title").boundingBox())!;
  const start = { x: box.x + 12, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const end = "dx" in to ? { x: start.x + to.dx, y: start.y + to.dy } : to;
  await page.mouse.move(start.x + 10, start.y + 10, { steps: 3 });
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

test.describe("canvas board", () => {
  test("a card dragged by its title moves, snaps, stays put and does not open", async ({
    page,
  }) => {
    test.skip(test.info().project.name !== "desktop", "mouse drags are a desktop gesture");
    await signUpAndOnboard(page, "canvasdrag");
    const item = card(page, "welcome to scraps.");
    await expect(item).toBeVisible();
    const before = (await position(item))!;

    await dragByTitle(page, item, { dx: 150, dy: 100 });

    // no "drop it to make a scrap": the drag never left the page
    await expect(page.locator(".drop-overlay")).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "new scrap" })).toHaveCount(0);
    // the click that ends a drag does not open the scrap
    await expect(page).not.toHaveURL(/\/n\//);
    await expect.poll(async () => (await position(item))!.x).toBeGreaterThan(before.x + 100);
    const after = (await position(item))!;
    expect(after.x % 24).toBe(0);
    expect(after.y % 24).toBe(0);

    // shared and saved: the same place after a reload
    await page.waitForTimeout(800);
    await page.reload();
    await settled(page);
    await expect.poll(async () => position(card(page, "welcome to scraps."))).toEqual(after);
  });

  test("dropping a card on another space moves it there, and undo brings it back", async ({
    page,
  }) => {
    test.skip(test.info().project.name !== "desktop", "mouse drags are a desktop gesture");
    await signUpAndOnboard(page, "canvasmove");
    // a second space to drop into
    await page.goto("/spaces");
    await page.getByRole("main").getByRole("button", { name: "new space" }).click();
    const dialog = page.getByRole("dialog", { name: "new space" });
    await dialog.getByLabel("name").fill("side quests");
    await dialog.getByRole("button", { name: "save it" }).click();
    await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}$/);
    await page
      .getByRole("link", { name: /^brain dump/ })
      .first()
      .click();
    await expect(page.locator(".canvas")).toBeVisible();

    await captureScrap(page, "going places");
    const item = card(page, "going places");
    await expect(item).toBeVisible();

    // start the drag, then aim at the chip in the strip that slides up
    const box = (await item.locator(".sc-notecard__title").boundingBox())!;
    await page.mouse.move(box.x + 12, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 30, box.y + 30, { steps: 4 });
    const chip = page.locator(".drop-strip__chip", { hasText: "side quests" });
    await expect(chip).toBeVisible();
    const target = (await chip.boundingBox())!;
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect(page.locator(".board-toast")).toContainText("moved to side quests.");
    await expect(item).toHaveCount(0);
    await page.locator(".board-toast").getByRole("button", { name: "undo" }).click();
    await expect(card(page, "going places")).toBeVisible({ timeout: 15_000 });
  });
});
