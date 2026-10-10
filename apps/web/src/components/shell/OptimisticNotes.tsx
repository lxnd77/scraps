"use client";

import type { NotesPage } from "@scraps/db";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useEffect } from "react";
import { onNoteCreated, summaryFromContent } from "@/lib/optimistic";

/**
 * Puts a scrap on its board the moment it exists on this device, before the server has heard of
 * it, so creating works the same offline as online.
 */
export function OptimisticNotes() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return onNoteCreated((event) => {
      const summary = summaryFromContent(event);
      queryClient.setQueryData<InfiniteData<NotesPage, number>>(
        ["board", event.spaceId, null],
        (old) => {
          if (!old) return old;
          const [first, ...rest] = old.pages;
          if (!first || first.notes.some((n) => n.id === summary.id)) return old;
          const at = first.notes.findIndex((n) => !n.pinned);
          const notes = [...first.notes];
          notes.splice(at === -1 ? notes.length : at, 0, summary);
          return { ...old, pages: [{ ...first, notes }, ...rest] };
        },
      );
    });
  }, [queryClient]);

  return null;
}
