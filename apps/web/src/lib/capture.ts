import type { StartBlock } from "@scraps/editor";

export type CaptureType = "text" | "list" | "pic" | "link" | "voice";

/** Every tile has a working flow as of Phase 4. */
export const FUNCTIONAL_CAPTURE_TYPES: readonly CaptureType[] = [
  "text",
  "list",
  "pic",
  "link",
  "voice",
];

export interface CaptureDraft {
  start: StartBlock;
  title?: string;
  text?: string;
  items?: string[];
}

const TITLE_MAX = 120;

/**
 * Turns what was typed into the starting document of a new scrap (recorded in DECISIONS).
 * With a title (the sheet's title field), everything typed below it is the body:
 *  - text: the lines are the body.
 *  - list: each line is an item.
 * With no title, the first line stands in for one, as before the title field:
 *  - text: the first line is the title, the rest is the body; a long single line is all body.
 *  - list: the first line is the title and each later line an item; a single line is one item.
 * Returns null when there is nothing to save.
 */
export function buildCapture(type: "text" | "list", raw: string, title = ""): CaptureDraft | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const named = title.trim().slice(0, TITLE_MAX);

  if (named) {
    if (type === "list") return { start: "list", title: named, items: lines };
    return lines.length > 0
      ? { start: "text", title: named, text: lines.join("\n") }
      : { start: "text", title: named };
  }
  if (lines.length === 0) return null;

  if (type === "list") {
    if (lines.length === 1) return { start: "list", items: lines };
    const [first, ...rest] = lines as [string, ...string[]];
    return { start: "list", title: first.slice(0, TITLE_MAX), items: rest };
  }

  const [first, ...rest] = lines as [string, ...string[]];
  if (first.length > TITLE_MAX) return { start: "text", text: lines.join("\n") };
  return rest.length > 0
    ? { start: "text", title: first, text: rest.join("\n") }
    : { start: "text", title: first };
}

/** A pasted or typed string that is a web link, or null. */
export function asUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
