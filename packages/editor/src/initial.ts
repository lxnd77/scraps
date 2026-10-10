import type { JSONContent } from "@tiptap/core";

/** Which block a new note starts with. Quick capture's type tile decides this (SPEC 8.1). */
export type StartBlock = "text" | "list" | "quote";

export const START_BLOCKS: readonly StartBlock[] = ["text", "list", "quote"];

export interface InitialContentOptions {
  title?: string;
  /** text to put in the first block (a captured thought) */
  text?: string;
  /** checklist starts only: one task item per entry; `text` becomes the first when given */
  items?: string[];
}

function paragraph(text?: string): JSONContent {
  return text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
}

/** A valid starting document: a title node, then the starting block(s). */
export function initialContent(
  start: StartBlock = "text",
  { title, text, items }: InitialContentOptions = {},
): JSONContent {
  const titleNode: JSONContent = title
    ? { type: "title", content: [{ type: "text", text: title }] }
    : { type: "title" };

  let blocks: JSONContent[];
  switch (start) {
    case "list": {
      const lines = [...(text ? [text] : []), ...(items ?? [])].filter((l) => l.trim() !== "");
      blocks = [
        {
          type: "taskList",
          content: (lines.length > 0 ? lines : [undefined]).map((line) => ({
            type: "taskItem",
            attrs: { checked: false },
            content: [paragraph(line)],
          })),
        },
      ];
      break;
    }
    case "quote":
      blocks = [
        text ? { type: "bigText", content: [{ type: "text", text }] } : { type: "bigText" },
      ];
      break;
    default: {
      // one paragraph per line of captured text
      const lines = text ? text.split("
").filter((l) => l.trim() !== "") : [];
      blocks = lines.length > 0 ? lines.map((l) => paragraph(l)) : [paragraph()];
    }
  }

  return { type: "doc", content: [titleNode, ...blocks] };
}
