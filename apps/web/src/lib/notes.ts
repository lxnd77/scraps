import { uuidv7 } from "@scraps/db";
import {
  contentToYdoc,
  initialContent,
  type JSONContent,
  type StartBlock,
  type StartMedia,
} from "@scraps/editor";
import * as Y from "yjs";
import { saveLocalDoc } from "@/lib/offline/noteStore";
import { queue } from "@/lib/offline/runtime";
import { announceNoteCreated } from "@/lib/optimistic";

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
  const content: JSONContent = initialContent(start, {
    title: note.title,
    text: note.text,
    items: note.items,
    media: note.media,
  });
  const doc: Y.Doc = contentToYdoc(content);

  try {
    await saveLocalDoc(id, doc);
  } catch {
    // no IndexedDB (private window): the scrap still reaches the server, it just is not cached
  }
  announceNoteCreated({ id, spaceId: note.spaceId, start, content });
  await queue({
    type: "createNote",
    noteId: id,
    spaceId: note.spaceId,
    state: toBase64(Y.encodeStateAsUpdate(doc)),
    start,
  });
  return id;
}
