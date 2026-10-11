import { expect, test } from "@playwright/test";
import { captureScrap, signUpAndOnboard } from "./helpers";

test.describe("export", () => {
  test("export everything builds a zip with one markdown file per scrap", async ({
    page,
    request,
  }) => {
    await signUpAndOnboard(page, "export", "tester");
    await captureScrap(page, "pack the blue bag");
    await captureScrap(page, "plan\nbuy tent\nbuy stove", { list: true });

    await page.goto("/settings");
    await page.getByRole("button", { name: "export everything" }).click();
    const download = page.getByRole("link", { name: /download zip/ });
    await expect(download).toBeVisible({ timeout: 30_000 });
    // the starter scraps and the two captured ones
    await expect(download).toContainText(/\d+ scraps/);

    const url = await download.getAttribute("href");
    const res = await request.get(url!);
    expect(res.status()).toBe(200);
    const bytes = await res.body();
    // a zip: "PK" magic, and file names are stored uncompressed in the headers
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
    const names = bytes.toString("latin1");
    expect(names).toContain("README.txt");
    expect(names).toContain("notes/brain-dump/pack-the-blue-bag.md");
  });

  test("the fourth export in a day is refused politely", async ({ page }) => {
    await signUpAndOnboard(page, "exportlimit", "tester");
    await page.goto("/settings");
    for (let i = 0; i < 3; i += 1) {
      await page.getByRole("button", { name: /export everything|packing/ }).click();
      await expect(page.getByRole("link", { name: /download zip/ })).toBeVisible({
        timeout: 30_000,
      });
    }
    await page.getByRole("button", { name: "export everything" }).click();
    await expect(page.getByText("exported a lot today")).toBeVisible();
  });
});
