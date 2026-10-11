import { expect, test, type Page } from "@playwright/test";
import { captureScrap, signUpAndOnboard } from "./helpers";

const card = (page: Page, text: string) =>
  page.locator("[data-note-id]").filter({ hasText: text });

/** Deletes a scrap from the board through its card menu. */
async function trashFromBoard(page: Page, title: string) {
  await page.getByRole("button", { name: `more for ${title}` }).click();
  const menu = page.getByRole("dialog", { name: "this scrap" });
  await menu.getByRole("button", { name: "delete" }).click();
  await menu.getByRole("button", { name: "delete it" }).click();
  await expect(card(page, title)).toHaveCount(0);
}

test.describe("trash", () => {
  test("a deleted scrap can be restored", async ({ page }) => {
    await signUpAndOnboard(page, "trashrestore");
    await captureScrap(page, "trash me please");
    await trashFromBoard(page, "trash me please");

    await page.getByRole("link", { name: "trash" }).click();
    await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/trash$/);
    const row = card(page, "trash me please");
    await expect(row).toBeVisible();
    await expect(row).toContainText("30 days left");
    await row.getByRole("button", { name: "restore" }).click();
    await expect(card(page, "trash me please")).toHaveCount(0);
    await expect(page.getByText("nothing in the trash")).toBeVisible();

    await page.getByRole("link", { name: /back to/ }).click();
    await expect(card(page, "trash me please")).toBeVisible({ timeout: 15_000 });
  });

  test("the owner deletes forever after a confirm, and it stays gone", async ({ page }) => {
    await signUpAndOnboard(page, "trashforever");
    await captureScrap(page, "gone for good");
    await trashFromBoard(page, "gone for good");

    await page.getByRole("link", { name: "trash" }).click();
    const row = card(page, "gone for good");
    await row.getByRole("button", { name: "delete forever" }).click();
    const dialog = page.getByRole("dialog", { name: "delete forever?" });
    await expect(dialog).toContainText("gone for good");
    // cancelling keeps it
    await dialog.getByRole("button", { name: "cancel" }).click();
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "delete forever" }).click();
    await page
      .getByRole("dialog", { name: "delete forever?" })
      .getByRole("button", { name: "delete forever" })
      .click();
    await expect(card(page, "gone for good")).toHaveCount(0);

    await page.reload();
    await expect(page.getByText("nothing in the trash")).toBeVisible();
  });

  test("empty trash removes everything at once", async ({ page }) => {
    await signUpAndOnboard(page, "trashempty");
    await captureScrap(page, "first to go");
    await captureScrap(page, "second to go");
    await trashFromBoard(page, "first to go");
    await trashFromBoard(page, "second to go");

    await page.getByRole("link", { name: "trash" }).click();
    await expect(page.locator("[data-note-id]")).toHaveCount(2);
    await page.getByRole("button", { name: "empty trash" }).click();
    await page
      .getByRole("dialog", { name: "delete forever?" })
      .getByRole("button", { name: "delete forever" })
      .click();
    await expect(page.getByText("nothing in the trash")).toBeVisible();
  });
});
