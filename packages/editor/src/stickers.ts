import * as Y from "yjs";

/**
 * Stickers floating over a scrap's content (feedback round, Oct 13). They live in the note's Y.Doc
 * next to the ProseMirror fragment, so they sync, work offline and persist with the document
 * (the collab server stores the whole doc). Previews and Markdown export ignore them.
 */
export const STICKER_MAP = "stickers";

export interface FloatingSticker {
  sticker: string;
  /** fraction of the content width (0..1), so a sticker keeps its place on any screen */
  x: number;
  /** pixels from the top of the content */
  y: number;
  scale: number;
  rotation: number;
}

function valid(value: unknown): value is FloatingSticker {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sticker === "string" &&
    /^[a-z0-9-]{1,40}$/.test(v.sticker) &&
    [v.x, v.y, v.scale, v.rotation].every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** Every well-formed sticker in the doc, by id. Anything malformed is skipped, never thrown. */
export function readStickers(doc: Y.Doc): Array<[string, FloatingSticker]> {
  const out: Array<[string, FloatingSticker]> = [];
  doc.getMap<unknown>(STICKER_MAP).forEach((value, id) => {
    if (valid(value)) out.push([id, value]);
  });
  return out;
}

/** Adds or replaces one sticker, clamped to sane bounds. */
export function putSticker(doc: Y.Doc, id: string, sticker: FloatingSticker): void {
  const clean: FloatingSticker = {
    sticker: sticker.sticker,
    x: Math.min(1, Math.max(0, sticker.x)),
    y: Math.min(100_000, Math.max(0, Math.round(sticker.y))),
    scale: Math.min(3, Math.max(0.5, sticker.scale)),
    rotation: Math.min(180, Math.max(-180, Math.round(sticker.rotation))),
  };
  if (!valid(clean)) return;
  doc.getMap<unknown>(STICKER_MAP).set(id, clean);
}

export function removeSticker(doc: Y.Doc, id: string): void {
  doc.getMap<unknown>(STICKER_MAP).delete(id);
}
