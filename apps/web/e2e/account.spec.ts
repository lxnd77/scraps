import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  captureScrap,
  completeOnboarding,
  signInFromCurrentPage,
  signInWithMagicLink,
  signUpAndOnboard,
  uniqueEmail,
} from "./helpers";

test.beforeEach(({ browserName }, testInfo) => {
  void browserName;
  test.skip(testInfo.project.name !== "desktop", "account flows run on desktop");
});

async function openDeleteDialog(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "delete account" }).click();
  const dialog = page.getByRole("dialog", { name: "delete your account?" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("account deletion", () => {
  test("a solo account is deleted after typing the name, and the email starts over", async ({
    page,
  }) => {
    const email = await signUpAndOnboard(page, "solo", "tester");
    await captureScrap(page, "my only scrap");

    const dialog = await openDeleteDialog(page);
    const confirm = dialog.getByRole("button", { name: "delete everything" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/type your name/).fill("tester");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page).toHaveURL(/\/sign-in/, { timeout: 30_000 });

    // the same email is a brand new person: onboarding, an empty board
    await signInWithMagicLink(page, email);
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("a shared space can be handed to an editor, who keeps everything", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signUpAndOnboard(page, "giver", "olive");
    await captureScrap(page, "keep this for maya");

    // invite maya as an editor
    await page.getByRole("button", { name: "share this space" }).click();
    const share = page.getByRole("dialog", { name: /^share /i });
    await share
      .getByRole("group", { name: "they can" })
      .getByRole("radio", { name: "editor" })
      .check();
    await share.getByRole("button", { name: "make a link" }).click();
    const invite = await share.getByLabel("new link (shown once)").inputValue();
    await share.getByRole("button", { name: "close" }).click();

    const maya = await joinAs(browser, baseURL!, invite, "maya");

    // olive leaves, giving the space to maya
    const dialog = await openDeleteDialog(page);
    await dialog.getByRole("radio", { name: "hand it to someone else" }).check();
    await expect(dialog.getByRole("combobox", { name: "who gets it" })).toContainText("maya");
    await dialog.getByLabel(/type your name/).fill("olive");
    await dialog.getByRole("button", { name: "delete everything" }).click();
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 30_000 });

    // maya still has the scrap and now owns the space
    await maya.page.reload();
    await expect(maya.page.getByRole("link", { name: "keep this for maya" }).first()).toBeVisible();
    await expect(maya.page.getByRole("button", { name: "edit space" })).toBeVisible();
    await maya.context.close();
  });

  test("a shared space needs an answer before anything is deleted", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signUpAndOnboard(page, "undecided", "olive");
    await page.getByRole("button", { name: "share this space" }).click();
    const share = page.getByRole("dialog", { name: /^share /i });
    await share.getByRole("button", { name: "make a link" }).click();
    const invite = await share.getByLabel("new link (shown once)").inputValue();
    await share.getByRole("button", { name: "close" }).click();
    const other = await joinAs(browser, baseURL!, invite, "sam");

    const dialog = await openDeleteDialog(page);
    await dialog.getByLabel(/type your name/).fill("olive");
    // no choice for the shared space yet: the button stays off
    await expect(dialog.getByRole("button", { name: "delete everything" })).toBeDisabled();
    await other.context.close();
  });
});

async function joinAs(browser: Browser, baseURL: string, invite: string, name: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto(invite);
  await expect(page).toHaveURL(/\/sign-in/);
  await signInFromCurrentPage(page, uniqueEmail(name));
  await completeOnboarding(page, { name, birthYear: "2000", sticker: "heart" });
  await expect(page.getByRole("button", { name: "join" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "join" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}$/);
  return { context, page };
}
