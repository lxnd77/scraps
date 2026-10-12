import { describe, expect, it } from "vitest";
import { matchShortcut, type KeyInput } from "./shortcuts";

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  typing: false,
  inEditor: false,
  modal: false,
  onNote: false,
  ...extra,
});

describe("matchShortcut", () => {
  it.each([
    ["?", { type: "help" }],
    ["/", { type: "search" }],
    ["t", { type: "theme" }],
    ["T", { type: "theme" }],
    ["3", { type: "space", index: 2 }],
    ["]", { type: "space-step", by: 1 }],
    ["[", { type: "space-step", by: -1 }],
  ])("%s", (k, action) => {
    expect(matchShortcut(key(k), null)).toEqual({ action, pending: null });
  });

  it("runs g sequences", () => {
    const first = matchShortcut(key("g"), null);
    expect(first).toEqual({ action: null, pending: "g" });
    expect(matchShortcut(key("h"), first.pending).action).toEqual({ type: "go", to: "home" });
    expect(matchShortcut(key(","), "g").action).toEqual({ type: "go", to: "settings" });
    // an unknown second key ends the sequence without doing anything
    expect(matchShortcut(key("x"), "g")).toEqual({ action: null, pending: null });
  });

  it("keeps out of text fields, open dialogs and modifier chords", () => {
    expect(matchShortcut(key("t", { typing: true }), null).action).toBeNull();
    expect(matchShortcut(key("t", { modal: true }), null).action).toBeNull();
    expect(matchShortcut(key("t", { ctrlKey: true }), null).action).toBeNull();
    expect(matchShortcut(key("0"), null).action).toBeNull();
  });

  it("escape leaves the editor first, then goes back to the space", () => {
    const inEditor = key("Escape", { typing: true, inEditor: true, onNote: true });
    expect(matchShortcut(inEditor, null).action).toEqual({ type: "leave-editor" });
    expect(matchShortcut(key("Escape", { onNote: true }), null).action).toEqual({
      type: "back-to-space",
    });
    expect(matchShortcut(key("Escape", { onNote: true, modal: true }), null).action).toBeNull();
    expect(matchShortcut(key("Escape"), null).action).toBeNull();
  });
});
