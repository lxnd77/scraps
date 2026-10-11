import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { contentToMarkdown } from "./markdown";

const text = (t: string, marks: string[] = [], attrs?: Record<string, unknown>): JSONContent => ({
  type: "text",
  text: t,
  marks: marks.map((m) => ({ type: m, ...(m === "link" ? { attrs } : {}) })),
});
const p = (...c: JSONContent[]): JSONContent => ({ type: "paragraph", content: c });
const doc = (title: string, ...body: JSONContent[]): JSONContent => ({
  type: "doc",
  content: [{ type: "title", content: [text(title)] }, ...body],
});

describe("contentToMarkdown", () => {
  it("returns the title separately and renders marks", () => {
    const out = contentToMarkdown(
      doc(
        "my trip",
        p(
          text("bold", ["bold"]),
          text(" "),
          text("it", ["italic"]),
          text(" "),
          text("gone", ["strike"]),
          text(" "),
          text("code", ["code"]),
          text(" "),
          text("site", ["link"], { href: "https://example.com" }),
        ),
      ),
    );
    expect(out.title).toBe("my trip");
    expect(out.markdown).toBe("**bold** *it* ~~gone~~ `code` [site](https://example.com)");
  });

  it("renders headings, lists, checklists and nesting", () => {
    const out = contentToMarkdown(
      doc(
        "t",
        { type: "heading", attrs: { level: 2 }, content: [text("plan")] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                p(text("one")),
                {
                  type: "bulletList",
                  content: [{ type: "listItem", content: [p(text("nested"))] }],
                },
              ],
            },
          ],
        },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [p(text("tent"))] },
            { type: "taskItem", attrs: { checked: false }, content: [p(text("stove"))] },
          ],
        },
      ),
    );
    expect(out.markdown).toBe(
      ["## plan", "- one\n  - nested", "- [x] tent\n- [ ] stove"].join("\n\n"),
    );
  });

  it("renders callouts, code, rules and tables", () => {
    const out = contentToMarkdown(
      doc(
        "t",
        { type: "callout", content: [p(text("heads up"))] },
        { type: "codeBlock", attrs: { language: "js" }, content: [text("let a = 1;")] },
        { type: "horizontalRule" },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [p(text("a"))] },
                { type: "tableHeader", content: [p(text("b"))] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [p(text("1"))] },
                { type: "tableCell", content: [p(text("2"))] },
              ],
            },
          ],
        },
      ),
    );
    expect(out.markdown).toBe(
      ["> heads up", "```js\nlet a = 1;\n```", "---", "| a | b |\n| --- | --- |\n| 1 | 2 |"].join(
        "\n\n",
      ),
    );
  });

  it("references media through the callback and reports the paths", () => {
    const out = contentToMarkdown(
      doc(
        "t",
        { type: "image", attrs: { path: "n/a.webp", alt: "a dog", caption: "good boy" } },
        {
          type: "moodBoard",
          attrs: { images: [{ path: "n/b.webp", caption: "b" }, { path: "n/c.webp" }] },
        },
        {
          type: "voiceMemo",
          attrs: { path: "n/m.webm", assetId: "m1", authorName: "maya" },
        },
        { type: "linkEmbed", attrs: { url: "https://x.test/", title: "X", description: "about x" } },
      ),
      {
        mediaFile: (path) => `media/${path.split("/").pop()}`,
        transcripts: { m1: "book the tickets" },
      },
    );
    expect(out.media).toEqual(["n/a.webp", "n/b.webp", "n/c.webp", "n/m.webm"]);
    expect(out.markdown).toContain("![a dog](media/a.webp)\n\n*good boy*");
    expect(out.markdown).toContain("![b](media/b.webp)");
    expect(out.markdown).toContain("[voice memo by maya](media/m.webm)\n\n> book the tickets");
    expect(out.markdown).toContain("[X](https://x.test/)\n\n> about x");
  });

  it("keeps the text of unknown blocks and handles an empty note", () => {
    expect(
      contentToMarkdown(doc("t", { type: "mystery", content: [p(text("still here"))] })).markdown,
    ).toBe("still here");
    expect(contentToMarkdown(doc("empty")).markdown).toBe("");
    expect(contentToMarkdown({ type: "doc", content: [] }).title).toBe("");
  });
});
