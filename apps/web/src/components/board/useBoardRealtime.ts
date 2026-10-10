"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * New and edited scraps from other people appear without a reload (SPEC 9.2, phase 5.6).
 * Postgres changes on `notes` are filtered by RLS, so a client only hears about spaces it is in.
 * Bursts (a person typing fires an update per store) are collapsed into one refetch.
 */
export function useBoardRealtime(spaceId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: number | undefined;
    let lastRefresh = 0;

    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["board", spaceId] });
        void queryClient.invalidateQueries({ queryKey: ["kinds", spaceId] });
        // sidebar counts come from the server layout; refresh them at most every few seconds
        if (Date.now() - lastRefresh > 5000) {
          lastRefresh = Date.now();
          router.refresh();
        }
      }, 300);
    };

    const channel = supabase
      .channel(`board-${spaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes", filter: `space_id=eq.${spaceId}` },
        refresh,
      )
      .subscribe();

    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [spaceId, queryClient, router]);
}
