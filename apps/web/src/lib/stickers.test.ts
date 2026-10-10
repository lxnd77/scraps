import { STICKER_IDS as dbStickers } from "@scraps/db";
import { STICKER_IDS as uiStickers } from "@scraps/ui";
import { describe, expect, it } from "vitest";

describe("sticker ids", () => {
  it("are the same list in the UI pack and the database schema", () => {
    // profiles.avatar_sticker has a check constraint on this list; the picker renders the pack
    expect([...dbStickers].sort()).toEqual([...uiStickers].sort());
  });
});
