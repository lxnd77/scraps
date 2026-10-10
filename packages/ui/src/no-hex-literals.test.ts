import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const SRC = join(__dirname);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("design tokens only", () => {
  // tokens.css is the one place hex colours live. Stickers draw with var(--c-*) and
  // may use literals if a future sticker needs one, so they are allowed too.
  const files = walk(SRC).filter(
    (file) =>
      /\.(tsx?|css)$/.test(file) &&
      !file.endsWith("tokens.css") &&
      !file.endsWith("Sticker.tsx") &&
      !file.endsWith(".test.ts") &&
      !file.endsWith(".test.tsx"),
  );

  it("finds component sources to check", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((file) => [relative(SRC, file), file]))(
    "%s has no hex colour literals",
    (_name, file) => {
      const text = readFileSync(file as string, "utf8");
      const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, "");
      expect(withoutComments).not.toMatch(HEX);
    },
  );
});
