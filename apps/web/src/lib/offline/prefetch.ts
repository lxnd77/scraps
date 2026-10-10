import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { collabWsUrl } from "@/lib/collab";
import { createClient } from "@/lib/supabase/client";
import { RECENT_LIMIT, cachedNoteIds, docName, markCached } from "./noteStore";

/** Opens a note's provider just long enough to fill its IndexedDB copy. */
async function cacheNote(noteId: string, token: string, timeoutMs = 8000): Promise<boolean> {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(docName(noteId), doc);
  const socket = new HocuspocusProviderWebsocket({ url: collabWsUrl() });
  const held: { provider?: HocuspocusProvider } = {};
  try {
    await persistence.whenSynced;
    const synced = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      held.provider = new HocuspocusProvider({
        name: noteId,
        document: doc,
        websocketProvider: socket,
        token,
        onSynced: () => {
          clearTimeout(timer);
          resolve(true);
        },
        onAuthenticationFailed: () => {
          clearTimeout(timer);
          resolve(false);
        },
      });
      held.provider.attach();
    });
    if (synced) await markCached(noteId);
    return synced;
  } finally {
    held.provider?.destroy();
    socket.destroy();
    // let y-indexeddb finish writing before it closes
    await new Promise((r) => setTimeout(r, 50));
    await persistence.destroy();
  }
}

/**
 * Keeps the most recent notes on the device (SPEC 10). Sequential and gentle: one note at a
 * time, stops as soon as the connection drops. Also warms the service worker's page cache so a
 * cached note can be opened from a cold start with no network.
 */
export async function prefetchNotes(
  candidateIds: string[],
  isOnline: () => boolean,
): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return 0;

  const have = await cachedNoteIds();
  let fetched = 0;
  for (const id of candidateIds.slice(0, RECENT_LIMIT)) {
    if (!isOnline()) break;
    try {
      if (!have.has(id)) {
        if (await cacheNote(id, token)) fetched++;
      }
      // the page itself, so the service worker holds its HTML for an offline cold start
      await fetch(`/n/${id}`, { credentials: "same-origin" }).catch(() => {});
    } catch {
      // a note that will not cache is skipped; the next pass tries again
    }
  }
  return fetched;
}
