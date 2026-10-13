import { uuidv7 } from "@scraps/db";
// the editor and Yjs are loaded when a scrap is made, not with the board (SPEC 14)
import type { JSONContent, StartBlock, StartMedia } from "@scraps/editor";
import { saveLocalDoc } from "@/lib/offline/noteStore";
import { queue } from "@/lib/offline/runtime";
import { announceNoteCreated, placeNewNote, summaryFromContent } from "@/lib/optimistic";

export { accessToken } from "@/lib/auth-token";

export interface NewNote {
  /** pass an id to make the call safe to repeat; one is generated otherwise */
  id?: string;
  spaceId: string;
  start?: StartBlock;
  title?: string;
  text?: string;
  items?: string[];
  media?: StartMedia;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * The one client-side way to make a scrap: quick capture, the starter scraps and every media
 * capture use it. It is local first: the document is built here and stored on the device, then a
 * create is queued in the outbox, which sends it as soon as there is a connection. The queued
 * create carries the same document, so the server and the device hold identical bytes and an
 * offline-made scrap never merges into a second copy of itself.
 */
export async function createNote(note: NewNote): Promise<string> {
  const id = note.id ?? uuidv7();
  const start = note.start ?? "text";
  const [editor, Y] = await Promise.all([import("@scraps/editor"), import("yjs")]);
  const { contentToYdoc, extractPreview, initialContent } = editor;
  const content: JSONContent = initialContent(start, {
    title: note.title,
    text: note.text,
    items: note.items,
    media: note.media,
  });
  const doc = contentToYdoc(content);

  try {
    await saveLocalDoc(id, doc);
  } catch {
    // no IndexedDB (private window): the scrap still reaches the server, it just is not cached
  }
  const summary = summaryFromContent({ id, spaceId: note.spaceId, start, content }, extractPreview);
  // an open canvas picks a spot in view; it is queued right behind the create
  const boardPos = placeNewNote(summary);
  if (boardPos) summary.boardPos = boardPos;
  announceNoteCreated({ id, spaceId: note.spaceId, start, content, summary });
  await queue({
    type: "createNote",
    noteId: id,
    spaceId: note.spaceId,
    state: toBase64(Y.encodeStateAsUpdate(doc)),
    start,
  });
  if (boardPos) {
    await queue({
      type: "patchNote",
      noteId: id,
      fields: { board_pos: boardPos, meta_updated_at: new Date().toISOString() },
    });
  }
  return id;
}

/**
 * Sets a card colour picked before the scrap existed (quick capture). Queued after the create, so
 * it replays in order offline; a fresh row has no clock for `color`, so this always wins.
 */
export async function setNoteColor(noteId: string, color: string): Promise<void> {
  await queue({
    type: "patchNote",
    noteId,
    fields: { color, meta_updated_at: new Date().toISOString() },
  });
}
