import { describe, expect, it } from "vitest";
import { asUrl, buildCapture } from "./capture";

describe("buildCapture", () => {
  it("returns null for empty input", () => {
    expect(buildCapture("text", "  \n \n")).toBeNull();
    expect(buildCapture("list", "")).toBeNull();
  });

  it("text: a single line becomes the title", () => {
    expect(buildCapture("text", "buy oat milk")).toEqual({ start: "text", title: "buy oat milk" });
  });

  it("text: first line is the title, the rest the body", () => {
    expect(buildCapture("text", "trip ideas\n\ngoa in march\nask maya")).toEqual({
      start: "text",
      title: "trip ideas",
      text: "goa in march\nask maya",
    });
  });

  it("text: an overlong first line is body only", () => {
    const long = "x".repeat(200);
    expect(buildCapture("text", long)).toEqual({ start: "text", text: long });
  });

  it("list: one line is one item, several lines are a title and items", () => {
    expect(buildCapture("list", "milk")).toEqual({ start: "list", items: ["milk"] });
    expect(buildCapture("list", "groceries\nmilk\neggs")).toEqual({
      start: "list",
      title: "groceries",
      items: ["milk", "eggs"],
    });
  });
});

describe("asUrl", () => {
  it("accepts http and https links only", () => {
    expect(asUrl(" https://example.com/a ")).toBe("https://example.com/a");
    expect(asUrl("javascript:alert(1)")).toBeNull();
    expect(asUrl("not a link")).toBeNull();
    expect(asUrl("")).toBeNull();
  });
});

describe("buildCapture with a title", () => {
  it("text: the title stands alone, everything typed is the body", () => {
    expect(buildCapture("text", "", "trip ideas")).toEqual({ start: "text", title: "trip ideas" });
    expect(buildCapture("text", "goa in march\n\nask maya", " trip ideas ")).toEqual({
      start: "text",
      title: "trip ideas",
      text: "goa in march\nask maya",
    });
  });

  it("list: every line is an item, even the first", () => {
    expect(buildCapture("list", "milk\neggs", "groceries")).toEqual({
      start: "list",
      title: "groceries",
      items: ["milk", "eggs"],
    });
    expect(buildCapture("list", "", "groceries")).toEqual({
      start: "list",
      title: "groceries",
      items: [],
    });
  });

  it("a blank title falls back to the first line", () => {
    expect(buildCapture("text", "buy oat milk", "   ")).toEqual({
      start: "text",
      title: "buy oat milk",
    });
  });
});
