import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { offlineDb } from "./idb";

const CACHED_KEY = "cachedNotes";
const RECENT_KEY = "recentNotes";
export const RECENT_LIMIT = 50;

/** Name of a note's y-indexeddb database. */
export const docName = (noteId: string) => `scraps-note:${noteId}`;

/** Note ids whose document content is on this device. */
export async function cachedNoteIds(): Promise<Set<string>> {
  if (!offlineDb.available) return new Set();
  const ids = (await offlineDb.get<string[]>("meta", CACHED_KEY)) ?? [];
  return new Set(ids);
}

export async function markCached(noteId: string): Promise<void> {
  if (!offlineDb.available) return;
  const ids = await cachedNoteIds();
  if (ids.has(noteId)) return;
  ids.add(noteId);
  await offlineDb.put("meta", [...ids], CACHED_KEY);
}

export async function isCached(noteId: string): Promise<boolean> {
  return (await cachedNoteIds()).has(noteId);
}

/** Most recently opened first, capped. Drives prefetch. */
export async function recentNoteIds(): Promise<string[]> {
  if (!offlineDb.available) return [];
  return (await offlineDb.get<string[]>("meta", RECENT_KEY)) ?? [];
}

export async function touchRecent(noteId: string): Promise<void> {
  if (!offlineDb.available) return;
  const ids = (await recentNoteIds()).filter((id) => id !== noteId);
  ids.unshift(noteId);
  await offlineDb.put("meta", ids.slice(0, RECENT_LIMIT), RECENT_KEY);
}

/**
 * Runs `work` against a note's locally stored document. Opens the IndexedDB persistence, waits for
 * it to load, runs the callback in a single transaction scope and closes again, so it works
 * whether or not an editor has the note open.
 */
export async function withLocalDoc<T>(noteId: string, work: (doc: Y.Doc) => T): Promise<T> {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(docName(noteId), doc);
  try {
    await persistence.whenSynced;
    return work(doc);
  } finally {
    // give the write-behind a moment to land before closing
    await new Promise((resolve) => setTimeout(resolve, 0));
    await persistence.destroy();
  }
}

/** Stores a freshly built document under a note id and marks the note as available offline. */
export async function saveLocalDoc(noteId: string, source: Y.Doc): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const update = Y.encodeStateAsUpdate(source);
  await withLocalDoc(noteId, (doc) => {
    Y.applyUpdate(doc, update);
  });
  await markCached(noteId);
}
