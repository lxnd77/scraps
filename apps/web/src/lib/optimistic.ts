import type { NoteSummary } from "@scraps/db";
import type { CaptureDraft } from "./capture";

/** Ids of scraps captured in this session, so their card pops in once. */
export const freshNoteIds = new Set<string>();

/** The card a capture will produce, built locally so it can appear before the server answers. */
export function summaryFromDraft(input: {
  id: string;
  spaceId: string;
  draft: CaptureDraft;
}): NoteSummary {
  const { draft } = input;
  const items = (draft.items ?? []).map((text) => ({ text, done: false }));
  const words = [draft.title, draft.text, ...(draft.items ?? [])]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return {
    id: input.id,
    spaceId: input.spaceId,
    title: draft.title ?? "",
    previewText: draft.start === "list" ? "" : (draft.text ?? "").replace(/\s+/g, " "),
    kind: draft.start === "list" ? "list" : draft.start === "quote" ? "quote" : "text",
    color: draft.start === "list" ? "lime" : draft.start === "quote" ? "pink" : "yellow",
    pinned: false,
    iconSticker: null,
    wordCount: words,
    updatedAt: new Date().toISOString(),
    preview:
      draft.start === "list" && items.length > 0
        ? { checklist: { done: 0, total: items.length, items: items.slice(0, 4) } }
        : {},
  };
}
