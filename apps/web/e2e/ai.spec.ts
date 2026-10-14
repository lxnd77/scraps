import { expect, test, type Page, type Route } from "@playwright/test";
import { captureScrap, signUpAndOnboard, bringIntoView, settled, expectSynced } from "./helpers";

// The model is never called here: ai-sort is answered by the page.route mocks below. The real
// function, the opt-in setting and the accept paths (outbox, RLS, collab) all run for real.

const FN = "**/functions/v1/ai-sort";

// the service worker would answer these requests itself, past page.route
test.use({ serviceWorkers: "block" });

/** Creates a space from /spaces and returns its id. */
async function createSpace(page: Page, name: string): Promise<string> {
  await page.goto("/spaces");
  await page.getByRole("main").getByRole("button", { name: "new space" }).click();
  const dialog = page.getByRole("dialog", { name: "new space" });
  await dialog.getByLabel("name").fill(name);
  await dialog.getByRole("button", { name: "save it" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

function suggestionFor(spaceId: string | null, tags: string[] = [], title: string | null = null) {
  return async (route: Route) => {
    const { noteId } = route.request().postDataJSON() as { noteId: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        suggestion: {
          id: crypto.randomUUID(),
          noteId,
          spaceId,
          tags,
          title,
          confidence: 0.9,
        },
      }),
    });
  };
}

const toast = (page: Page) => page.getByRole("status").filter({ hasText: "file under" });

test.describe("ai suggestions", () => {
  test("the first capture asks, then suggests, and yes files the scrap", async ({ page }) => {
    await signUpAndOnboard(page, "aisort", "tester", { freshAiPrompt: true });
    const quests = await createSpace(page, "side quests");
    await page.goto("/");

    let calls = 0;
    await page.route(FN, async (route) => {
      calls += 1;
      await suggestionFor(quests, ["travel"])(route);
    });

    await captureScrap(page, "book train tickets for goa trip");

    // nothing is sent until the person says yes
    const dialog = page.getByRole("dialog", { name: "turn on suggestions?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("never pictures or voice memos");
    expect(calls).toBe(0);
    await dialog.getByRole("button", { name: "turn on" }).click();

    await expect(toast(page)).toContainText("side quests");
    await expect(toast(page)).toContainText("#travel");
    // the first suggestion carries the one-line notice
    await expect(page.getByText("ai looked at the text of this scrap")).toBeVisible();
    await toast(page).getByRole("button", { name: "yes" }).click();

    // accepted: the scrap now lives in side quests with the tag
    await page.goto(`/s/${quests}`);
    await settled(page);
    const card = page.locator("[data-note-id]").filter({ hasText: "book train tickets" });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await bringIntoView(card);
    await card.getByRole("link").first().click();
    await expect(page.getByText("#travel")).toBeVisible();
  });

  test("nah dismisses and moves nothing", async ({ page }) => {
    await signUpAndOnboard(page, "aidismiss", "tester", { freshAiPrompt: true });
    const quests = await createSpace(page, "side quests");
    await page.goto("/");
    await page.route(FN, suggestionFor(quests, ["travel"]));

    await captureScrap(page, "pack the blue bag");
    await page
      .getByRole("dialog", { name: "turn on suggestions?" })
      .getByRole("button", { name: "turn on" })
      .click();
    await toast(page).getByRole("button", { name: "nah" }).click();
    await expect(toast(page)).toBeHidden();

    await page.goto(`/s/${quests}`);
    await expect(
      page.locator("[data-note-id]").filter({ hasText: "pack the blue bag" }),
    ).toHaveCount(0);
  });

  test("with suggestions off no function call is made", async ({ page }) => {
    await signUpAndOnboard(page, "aioff", "tester", { freshAiPrompt: true });
    let calls = 0;
    await page.route(FN, async (route) => {
      calls += 1;
      await route.abort();
    });

    await captureScrap(page, "first scrap");
    await page
      .getByRole("dialog", { name: "turn on suggestions?" })
      .getByRole("button", { name: "not now" })
      .click();
    // asked once: the next capture goes straight through
    await captureScrap(page, "second scrap");
    await expect(page.getByRole("dialog", { name: "turn on suggestions?" })).toBeHidden();
    await page.waitForTimeout(1500);
    expect(calls).toBe(0);
    await expect(toast(page)).toHaveCount(0);
  });

  test("malformed or failing model answers show nothing and no error", async ({ page }) => {
    await signUpAndOnboard(page, "aibad", "tester", { freshAiPrompt: true });
    const answers = [
      { status: 200, body: "this is not json" },
      { status: 200, body: JSON.stringify({ suggestion: { id: 5 } }) },
      { status: 200, body: JSON.stringify({ suggestion: null }) },
      { status: 500, body: JSON.stringify({ error: "boom" }) },
    ];
    let n = 0;
    await page.route(FN, async (route) => {
      const answer = answers[n % answers.length]!;
      n += 1;
      await route.fulfill({
        status: answer.status,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: answer.body,
      });
    });

    await captureScrap(page, "scrap one");
    await page
      .getByRole("dialog", { name: "turn on suggestions?" })
      .getByRole("button", { name: "turn on" })
      .click();
    for (const text of ["scrap two", "scrap three", "scrap four"]) await captureScrap(page, text);

    await expect.poll(() => n, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
    await page.waitForTimeout(500);
    await expect(toast(page)).toHaveCount(0);
    await expect(page.getByText("something broke")).toHaveCount(0);
    // the scraps themselves are fine
    await expect(page.locator("[data-note-id]").filter({ hasText: "scrap four" })).toBeVisible();
  });

  test("the setting lives in settings and the note menu can ask for a suggestion", async ({
    page,
  }) => {
    await signUpAndOnboard(page, "aimenu", "tester", { freshAiPrompt: true });
    await page.goto("/settings");
    const toggle = page.getByRole("switch", { name: "suggest where scraps go" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await page.route(FN, suggestionFor(null, ["money"]));
    await page.goto("/");
    await captureScrap(page, "split the rent");
    await expect(toast(page).or(page.getByRole("status").filter({ hasText: "add" }))).toBeVisible();
  });
});

test.describe("voice transcripts", () => {
  test("a memo gets a transcript in the block and search finds a word from it", async ({
    page,
    context,
  }) => {
    test.skip(test.info().project.name !== "desktop", "fake media stream runs on desktop chrome");
    await context.grantPermissions(["microphone"]);
    await signUpAndOnboard(page, "transcript", "tester", { freshAiPrompt: true });

    await page.getByRole("button", { name: "new scrap" }).first().click();
    const sheet = page.getByRole("dialog", { name: "new scrap" });
    await sheet.getByRole("textbox", { name: "what's on your mind" }).fill("memo host");
    await sheet.getByRole("button", { name: "save it" }).click();
    await expect(sheet).toBeHidden();
    // the first capture asks about suggestions; this test is about transcripts
    await page
      .getByRole("dialog", { name: "turn on suggestions?" })
      .getByRole("button", { name: "not now" })
      .click();
    await page.getByRole("link", { name: "memo host", exact: true }).first().click();
    await expect(page).toHaveURL(/\/n\/[0-9a-f-]{36}$/);
    await expectSynced(page);

    const heading = page.locator("h1[data-title]");
    await expect(heading).toBeVisible();
    await heading.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/rec");
    await page.keyboard.press("Enter");
    await expect(page.getByText("voice memos are turned into text by groq")).toBeVisible();
    await page.getByRole("button", { name: "start recording" }).click();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "stop recording" }).click();

    // the fake provider answers within seconds (the real one is held to 30)
    const block = page.locator("[data-type='voiceMemo']");
    await expect(block.getByText("remember to book the train tickets")).toBeVisible({
      timeout: 30_000,
    });
    await expect(block.getByRole("button", { name: "copy into note" })).toBeVisible();

    // searchable
    await page.goto("/");
    // wait for the board to hydrate, or the shortcut goes nowhere
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-note-id]").first()).toBeVisible();
    await page.keyboard.press("ControlOrMeta+K");
    const search = page.getByRole("combobox", { name: "search" });
    await search.fill("goa");
    await expect(page.getByRole("option").filter({ hasText: "memo host" })).toBeVisible({
      timeout: 15_000,
    });
  });
});
