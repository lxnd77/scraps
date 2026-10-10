"use client";

import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { useEffect, useState } from "react";
import * as Y from "yjs";
import { collabWsUrl } from "@/lib/collab";
import { createClient } from "@/lib/supabase/client";

export interface NoteSessionState {
  /** the socket is open and authenticated */
  connected: boolean;
  /** local changes the server has not acknowledged yet */
  unsynced: number;
  /** the first sync with the server has completed: the document holds the note's content */
  synced: boolean;
  /** the server refused this connection: no access, or the note is gone */
  denied: boolean;
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
    denied: false,
  });

  useEffect(() => {
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
      onAuthenticationFailed: () => setState((s) => ({ ...s, connected: false, denied: true })),
      onDisconnect: () => setState((s) => ({ ...s, connected: false })),
      onUnsyncedChanges: ({ number }) => setState((s) => ({ ...s, unsynced: number })),
    });
    provider.attach();

    return () => {
      provider.destroy();
      socket.destroy();
    };
  }, [noteId, ydoc]);

  return { ydoc, ...state };
}
