import { describe, expect, it } from "vitest";
import { isPlainKey, isTypingTarget } from "./hotkeys";

describe("isTypingTarget", () => {
  it("is true for text inputs, textareas and editable content", () => {
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    const text = document.createElement("input");
    text.type = "text";
    expect(isTypingTarget(text)).toBe(true);
    const search = document.createElement("input");
    search.type = "search";
    expect(isTypingTarget(search)).toBe(true);
  });

  it("is false for buttons, checkboxes and the body", () => {
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    const box = document.createElement("input");
    box.type = "checkbox";
    expect(isTypingTarget(box)).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("isPlainKey", () => {
  it("matches the key without modifiers only", () => {
    expect(isPlainKey(new KeyboardEvent("keydown", { key: "n" }), "n")).toBe(true);
    expect(isPlainKey(new KeyboardEvent("keydown", { key: "N", shiftKey: true }), "n")).toBe(true);
    expect(isPlainKey(new KeyboardEvent("keydown", { key: "n", metaKey: true }), "n")).toBe(false);
    expect(isPlainKey(new KeyboardEvent("keydown", { key: "p" }), "n")).toBe(false);
  });
});
