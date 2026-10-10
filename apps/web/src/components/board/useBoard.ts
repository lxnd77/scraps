"use client";

import {
  kindCounts,
  listNotesPage,
  type NoteKind,
  type NoteSummary,
  type NotesPage,
} from "@scraps/db";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { setTaskItemChecked } from "@scraps/editor";
import { isCached, withLocalDoc } from "@/lib/offline/noteStore";
import { flushOutbox, queue } from "@/lib/offline/runtime";
import { createClient } from "@/lib/supabase/client";

type Pages = InfiniteData<NotesPage, number>;
const EMPTY_COUNTS: Record<NoteKind, number> = {
  text: 0,
  list: 0,
  pic: 0,
  link: 0,
  voice: 0,
  quote: 0,
};

/** Infinite, filterable list of a space's scraps. Switching filters shows the loaded ones at once. */
export function useBoardNotes(spaceId: string, kind: NoteKind | null, initialPage: NotesPage) {
  const queryClient = useQueryClient();
  return useInfiniteQuery({
    queryKey: ["board", spaceId, kind],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listNotesPage(createClient(), spaceId, { kind, page: pageParam }),
    getNextPageParam: (last) => last.nextPage,
    initialData: kind === null ? { pages: [initialPage], pageParams: [0] } : undefined,
    placeholderData: () => {
      if (kind === null) return undefined;
      const all = queryClient.getQueryData<Pages>(["board", spaceId, null]);
      if (!all) return undefined;
      return {
        pages: [
          {
            notes: all.pages.flatMap((p) => p.notes).filter((n) => n.kind === kind),
            nextPage: null,
          },
        ],
        pageParams: [0],
      } satisfies Pages;
    },
  });
}

export function useKindCounts(spaceId: string, initial: Record<NoteKind, number>) {
  return useQuery({
    queryKey: ["kinds", spaceId],
    queryFn: () => kindCounts(createClient(), spaceId),
    initialData: initial,
  });
}

export { EMPTY_COUNTS };

/** Applies a change to every cached board page of a space (all filters). */
function mapCachedNotes(
  queryClient: ReturnType<typeof useQueryClient>,
  spaceId: string,
  change: (note: NoteSummary) => NoteSummary | null,
) {
  queryClient.setQueriesData<Pages>({ queryKey: ["board", spaceId] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        notes: page.notes.flatMap((note) => {
          const next = change(note);
          return next ? [next] : [];
        }),
      })),
    };
  });
}

function resort(queryClient: ReturnType<typeof useQueryClient>, spaceId: string) {
  queryClient.setQueriesData<Pages>({ queryKey: ["board", spaceId] }, (old) => {
    if (!old) return old;
    const all = old.pages.flatMap((p) => p.notes);
    all.sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        b.id.localeCompare(a.id),
    );
    // keep the page sizes: the first page takes the head of the list
    let at = 0;
    return {
      ...old,
      pages: old.pages.map((page) => {
        const notes = all.slice(at, at + page.notes.length);
        at += page.notes.length;
        return { ...page, notes };
      }),
    };
  });
}

export interface NotePatch {
  pinned?: boolean;
  color?: string;
  space_id?: string;
  deleted_at?: string | null;
}

/** Card actions: metadata writes (pin, colour, move, delete) and checklist toggles. */
export function useCardActions(
  spaceId: string,
  onError: (message: "toggle" | "action" | "offline") => void,
) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const update = useCallback(
    async (note: NoteSummary, changes: NotePatch) => {
      const snapshot = queryClient.getQueriesData<Pages>({ queryKey: ["board", spaceId] });
      const leaves = changes.space_id !== undefined || changes.deleted_at !== undefined;
      if (leaves) {
        mapCachedNotes(queryClient, spaceId, (n) => (n.id === note.id ? null : n));
      } else {
        mapCachedNotes(queryClient, spaceId, (n) =>
          n.id === note.id
            ? {
                ...n,
                pinned: changes.pinned ?? n.pinned,
                color: changes.color ?? n.color,
              }
            : n,
        );
        if (changes.pinned !== undefined) resort(queryClient, spaceId);
      }
      try {
        // queued locally first: this works with no connection and replays in order later
        await queue({
          type: "patchNote",
          noteId: note.id,
          fields: { ...changes, meta_updated_at: new Date().toISOString() },
        });
        await flushOutbox();
        if (typeof navigator === "undefined" || navigator.onLine !== false) {
          void queryClient.invalidateQueries({ queryKey: ["board"] });
          void queryClient.invalidateQueries({ queryKey: ["kinds"] });
          if (leaves) router.refresh(); // sidebar counts
        }
      } catch {
        for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
        onError("action");
      }
    },
    [queryClient, spaceId, router, onError],
  );

  const toggleItem = useCallback(
    async (note: NoteSummary, index: number, checked: boolean) => {
      const item = note.preview.checklist?.items[index];
      if (!item) return;
      const snapshot = queryClient.getQueriesData<Pages>({ queryKey: ["board", spaceId] });
      const rollback = () => {
        for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
      };

      const cached = await isCached(note.id).catch(() => false);
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (!cached && offline) {
        // the server applies the toggle to its copy of the document; with no connection and no
        // local copy there is nowhere to put it
        onError("offline");
        return;
      }

      mapCachedNotes(queryClient, spaceId, (n) => {
        if (n.id !== note.id || !n.preview.checklist) return n;
        const list = n.preview.checklist;
        const items = list.items.map((it, i) => (i === index ? { ...it, done: checked } : it));
        const done = list.done + (checked ? 1 : -1);
        return { ...n, preview: { ...n.preview, checklist: { ...list, items, done } } };
      });

      try {
        if (cached) {
          const result = await withLocalDoc(note.id, (doc) =>
            setTaskItemChecked(doc, { index, checked, text: item.text }),
          );
          if (result.status !== "ok") {
            rollback();
            void queryClient.invalidateQueries({ queryKey: ["board", spaceId] });
            onError("toggle");
            return;
          }
        }
        await queue({
          type: "toggleChecklist",
          noteId: note.id,
          index,
          checked,
          text: item.text,
        });
      } catch {
        rollback();
        onError("toggle");
      }
    },
    [queryClient, spaceId, onError],
  );

  return { update, toggleItem };
}
