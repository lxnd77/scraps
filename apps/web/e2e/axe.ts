import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Fails the test with a readable summary if axe finds any violation on the page. */
export async function expectNoAxeViolations(page: Page, label: string): Promise<void> {
  // the theme cross-fade takes --dur-slow; measuring mid-fade reports blended colours
  await expect(page.locator("html")).not.toHaveClass(/sc-theme-fading/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 5).map((n) => ({
      target: n.target.join(" "),
      why: (n.any[0]?.message ?? n.failureSummary ?? "").slice(0, 240),
    })),
  }));
  expect(summary, `axe violations (${label})`).toEqual([]);
}
