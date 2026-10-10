"use client";

import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { useEffect, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { collabWsUrl } from "@/lib/collab";
import { docName, markCached, touchRecent } from "@/lib/offline/noteStore";
import { createClient } from "@/lib/supabase/client";

export interface NoteSessionState {
  /** the socket is open and authenticated */
  connected: boolean;
  /** local changes the server has not acknowledged yet */
  unsynced: number;
  /** the first sync with the server has completed: the document holds the note's content */
  synced: boolean;
  /** this device already held the note's content, so the editor can open with no network */
  localReady: boolean;
  /** the server refused this connection: no access, or the note is gone */
  denied: boolean;
  /** was connected and then lost access (removed or kicked), as opposed to never having it */
  revoked: boolean;
  /** the server downgraded us to read-only while the note was open */
  demoted: boolean;
}

/**
 * One note's live session: a Yjs document plus its Hocuspocus connection.
 * The editor binds to the document alone, so it never has to wait for the network.
 */
export function useNoteSession(noteId: string) {
  const [ydoc] = useState(() => new Y.Doc());
  const [state, setState] = useState<NoteSessionState>({
    connected: false,
    unsynced: 0,
    synced: false,
    localReady: false,
    denied: false,
    revoked: false,
    demoted: false,
  });
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);

  useEffect(() => {
    // the device's own copy loads first, so a note opened before opens with no network at all
    const persistence =
      typeof indexedDB === "undefined" ? null : new IndexeddbPersistence(docName(noteId), ydoc);
    void persistence?.whenSynced.then(() => {
      const hasContent = ydoc.getXmlFragment("default").length > 0;
      if (hasContent) {
        setState((s) => ({ ...s, localReady: true }));
        void markCached(noteId).catch(() => {});
      }
      void touchRecent(noteId).catch(() => {});
    });

    const supabase = createClient();
    const socket = new HocuspocusProviderWebsocket({ url: collabWsUrl() });
    const provider: HocuspocusProvider = new HocuspocusProvider({
      name: noteId,
      document: ydoc,
      websocketProvider: socket,
      // read on every (re)connect, so a refreshed session token is picked up
      token: async () => (await supabase.auth.getSession()).data.session?.access_token ?? "",
      onAuthenticated: () => setState((s) => ({ ...s, connected: true, denied: false })),
      onSynced: ({ state: synced }) => {
        if (synced) setState((s) => ({ ...s, synced: true }));
      },
      onAuthenticationFailed: () =>
        setState((s) => ({
          ...s,
          connected: false,
          denied: true,
          // a note we had open and can no longer reach: lost access, not "never yours"
          revoked: s.synced,
        })),
      onDisconnect: () => setState((s) => ({ ...s, connected: false })),
      // the server detached this note from our socket (membership changed): ask again, which
      // either re-attaches us or fails authentication and shows the no-access state
      onClose: () => {
        setState((s) => ({ ...s, connected: false }));
        void provider.sendToken();
      },
      onStateless: ({ payload }) => {
        try {
          const message = JSON.parse(payload) as { type?: string; role?: string };
          if (message.type === "role" && message.role === "viewer") {
            setState((s) => ({ ...s, demoted: true }));
          }
        } catch {
          // not ours
        }
      },
      onUnsyncedChanges: ({ number }) => setState((s) => ({ ...s, unsynced: number })),
    });
    provider.attach();
    setProvider(provider);

    return () => {
      void persistence?.destroy();
      provider.destroy();
      socket.destroy();
    };
  }, [noteId, ydoc]);

  return { ydoc, provider, ...state };
}
