"use client";

import type { NotesPage } from "@scraps/db";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useEffect } from "react";
import { recentNoteIds } from "@/lib/offline/noteStore";
import { prefetchNotes } from "@/lib/offline/prefetch";

const FIRST_DELAY_MS = 6000;
const PASS_EVERY_MS = 10 * 60 * 1000;

/** Quietly keeps recently touched notes available offline while the app is open and online. */
export function OfflinePrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const run = async () => {
      if (cancelled || navigator.onLine === false) return;
      const fromBoards = queryClient
        .getQueriesData<InfiniteData<NotesPage, number>>({ queryKey: ["board"] })
        .flatMap(([key, data]) =>
          key[2] === null ? (data?.pages.flatMap((p) => p.notes) ?? []) : [],
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((n) => n.id);
      const opened = await recentNoteIds().catch(() => []);
      const ids = [...new Set([...opened, ...fromBoards])];
      await prefetchNotes(ids, () => !cancelled && navigator.onLine !== false);
      if (!cancelled) timer = window.setTimeout(() => void run(), PASS_EVERY_MS);
    };

    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
    timer = window.setTimeout(() => idle(() => void run()), FIRST_DELAY_MS);
    const onOnline = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void run(), 2000);
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [queryClient]);

  return null;
}
