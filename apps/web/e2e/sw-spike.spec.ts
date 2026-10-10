import { expect, test } from "@playwright/test";

// Phase 0 spike 0.9a: a Serwist service worker registers in a production build and
// controls the page. Runs on the desktop project only; the phone profile adds nothing.
test("serwist service worker registers and controls the page in a production build", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one project is enough for the spike");

  const swResponse = await page.request.get("/serwist/sw.js");
  expect(swResponse.status()).toBe(200);
  expect(swResponse.headers()["content-type"]).toContain("javascript");

  await page.goto("/spike/sw");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // clientsClaim means the worker takes control without a reload; reload anyway to be certain
  await page.reload();
  await expect(page.getByTestId("sw-state")).toHaveText("controlled");

  const workers = context.serviceWorkers();
  expect(workers.some((w) => w.url().endsWith("/serwist/sw.js"))).toBe(true);
});
