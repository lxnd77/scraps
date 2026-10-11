import type { NoteSummary } from "@scraps/db";
// type-only: the editor bundle must not load with the board (SPEC 14)
import type { JSONContent, NotePreview, StartBlock } from "@scraps/editor";

/** Ids of scraps captured in this session, so their card pops in once. */
export const freshNoteIds = new Set<string>();

/** Card colour by what a scrap starts with, as the collab server sets it (SPEC 8.4). */
const DEFAULT_COLOR: Partial<Record<StartBlock, string>> = {
  list: "lime",
  quote: "pink",
  image: "surface",
  mood: "surface",
  link: "blue",
  voice: "lilac",
};

/** The card a new scrap will produce, derived from its own document so every kind is right. */
export function summaryFromContent(
  input: {
    id: string;
    spaceId: string;
    start: StartBlock;
    content: JSONContent;
  },
  extractPreview: (doc: JSONContent) => NotePreview,
): NoteSummary {
  const p = extractPreview(input.content);
  return {
    id: input.id,
    spaceId: input.spaceId,
    title: p.title,
    previewText: p.previewText,
    kind: p.kind,
    color: DEFAULT_COLOR[input.start] ?? "yellow",
    pinned: false,
    iconSticker: null,
    wordCount: p.wordCount,
    updatedAt: new Date().toISOString(),
    preview: p.preview as NoteSummary["preview"],
  };
}

export interface NoteCreatedEvent {
  id: string;
  spaceId: string;
  start: StartBlock;
  content: JSONContent;
  /** the card, built by the creator while the editor module is loaded anyway */
  summary: NoteSummary;
}

type Listener = (event: NoteCreatedEvent) => void;
const listeners = new Set<Listener>();

/** The shell subscribes so a scrap appears on the board the moment it exists locally. */
export function onNoteCreated(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function announceNoteCreated(event: NoteCreatedEvent): void {
  freshNoteIds.add(event.id);
  for (const listener of listeners) listener(event);
}
