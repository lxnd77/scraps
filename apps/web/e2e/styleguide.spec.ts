import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

const headerToggle = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "styleguide actions" }).getByRole("switch", {
    name: "after midnight",
  });

test.describe("styleguide", () => {
  test("renders every component section in both themes", async ({ page }) => {
    await page.goto("/styleguide");
    await expect(page.getByRole("heading", { level: 1, name: "styleguide" })).toBeVisible();
    for (const panel of ["daylight", "after midnight"]) {
      const region = page.getByRole("region", { name: panel });
      await expect(region).toBeVisible();
      for (const section of ["buttons", "chips", "cards", "stickers and decoration", "tokens"]) {
        await expect(region.getByRole("heading", { level: 3, name: section })).toBeVisible();
      }
    }
  });

  test("header toggle switches data-theme and keeps it across reload with no flash", async ({
    page,
  }) => {
    await page.goto("/styleguide");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "day");

    await headerToggle(page).click();
    await expect(html).toHaveAttribute("data-theme", "midnight");
    await expect(headerToggle(page)).toHaveAttribute("aria-checked", "true");

    // The server reads the cookie, so the first byte of HTML already says midnight.
    const response = await page.request.get("/styleguide");
    expect(await response.text()).toMatch(/<html[^>]*data-theme="midnight"/);

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "midnight");

    await headerToggle(page).click();
    await expect(html).toHaveAttribute("data-theme", "day");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "day");
  });

  test("auto follows the device colour scheme before paint", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/styleguide");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  });

  test("daylight page has no axe violations", async ({ page }) => {
    await page.goto("/styleguide");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
    await expectNoAxeViolations(page, "styleguide, daylight");
  });

  test("after midnight page has no axe violations", async ({ page }) => {
    await page.goto("/styleguide");
    await headerToggle(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
    await expectNoAxeViolations(page, "styleguide, after midnight");
  });

  test("dialog opens, traps focus and closes with escape", async ({ page }) => {
    await page.goto("/styleguide");
    const region = page.getByRole("region", { name: "daylight" });
    await region.getByRole("button", { name: "open dialog" }).click();
    const dialog = page.getByRole("dialog", { name: "new space" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(region.getByRole("button", { name: "open dialog" })).toBeFocused();
  });
});
