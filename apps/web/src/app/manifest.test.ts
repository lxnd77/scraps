import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest, { MANIFEST_COLORS } from "./manifest";

const tokens = readFileSync(resolve(process.cwd(), "../../packages/ui/src/tokens.css"), "utf8");

describe("web app manifest", () => {
  it("uses the daylight background and brand yellow from the tokens", () => {
    const bg = /--bg:\s*(#[0-9a-fA-F]{6})/.exec(tokens)?.[1];
    const yellow = /--c-yellow:\s*(#[0-9a-fA-F]{6})/.exec(tokens)?.[1];
    expect(MANIFEST_COLORS.background).toBe(bg?.toLowerCase());
    expect(MANIFEST_COLORS.theme).toBe(yellow?.toLowerCase());
  });

  it("is installable: standalone, start url, 192 and 512 icons and a maskable one", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect((m.icons ?? []).some((i) => i.purpose === "maskable")).toBe(true);
    expect(m.shortcuts?.[0]?.name).toBe("new scrap");
  });

  it("declares a share target that posts links, text, images and audio", () => {
    const target = manifest().share_target;
    expect(target?.action).toBe("/share-target");
    expect(target?.method).toBe("POST");
    expect(target?.enctype).toBe("multipart/form-data");
    expect(target?.params).toMatchObject({ title: "title", text: "text", url: "url" });
    expect(target?.params?.files).toEqual([{ name: "files", accept: ["image/*", "audio/*"] }]);
  });
});
