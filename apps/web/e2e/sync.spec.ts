import { expect, test } from "@playwright/test";
import { captureScrap, signUpAndOnboard } from "./helpers";

// the worker would answer these requests itself, past page.route
test.use({ serviceWorkers: "block" });

test.describe("sync errors", () => {
  test("a refused write turns the chip into a button that says what went wrong", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the sidebar chip is desktop only");
    await signUpAndOnboard(page, "syncerr", "tester");

    // the sync server answers 404 to creates, as it would at a wrong address
    await page.route("**/notes", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ error: "not_found" }),
      });
    });

    await captureScrap(page, "this one will be refused");

    const chip = page.getByRole("button", { name: /couldn't sync/ });
    await expect(chip).toBeVisible({ timeout: 20_000 });
    await chip.click();

    const dialog = page.getByRole("dialog", { name: "couldn't sync these" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("a new scrap");
    await expect(dialog).toContainText("(404)");
    await expect(dialog).toContainText("sync server:");

    await dialog.getByRole("button", { name: "ok, got it" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: /couldn't sync/ })).toHaveCount(0);
  });
});
