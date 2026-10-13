"use client";

import { listBoardStickers, uuidv7, type BoardSticker } from "@scraps/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { flushOutbox, queue } from "@/lib/offline/runtime";
import { createClient } from "@/lib/supabase/client";

const key = (spaceId: string) => ["stickers", spaceId] as const;

/**
 * A space's board stickers, live: everyone in the space sees them move (realtime on
 * board_stickers, filtered by RLS), and writes go through the outbox so they work offline.
 */
export function useBoardStickers(spaceId: string, onError: () => void) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: key(spaceId),
    queryFn: () => listBoardStickers(createClient(), spaceId),
  });

  useEffect(() => {
    const supabase = createClient();
    let timer: number | undefined;
    const channel = supabase
      .channel(`stickers-${spaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_stickers", filter: `space_id=eq.${spaceId}` },
        () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(
            () => void queryClient.invalidateQueries({ queryKey: key(spaceId) }),
            200,
          );
        },
      )
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [spaceId, queryClient]);

  const write = useCallback(
    async (change: (all: BoardSticker[]) => BoardSticker[], op: Parameters<typeof queue>[0]) => {
      const before = queryClient.getQueryData<BoardSticker[]>(key(spaceId));
      queryClient.setQueryData<BoardSticker[]>(key(spaceId), (all) => change(all ?? []));
      try {
        await queue(op);
        await flushOutbox();
      } catch {
        queryClient.setQueryData(key(spaceId), before);
        onError();
      }
    },
    [queryClient, spaceId, onError],
  );

  /** Adds or updates one sticker (last write wins: one hand drags a sticker at a time). */
  const save = useCallback(
    (sticker: BoardSticker) =>
      write(
        (all) =>
          all.some((s) => s.id === sticker.id)
            ? all.map((s) => (s.id === sticker.id ? sticker : s))
            : [...all, sticker],
        {
          type: "stickerUpsert",
          sticker: {
            id: sticker.id,
            space_id: sticker.spaceId,
            sticker: sticker.sticker,
            x: sticker.x,
            y: sticker.y,
            scale: sticker.scale,
            rotation: sticker.rotation,
            z: sticker.z,
          },
        },
      ),
    [write],
  );

  const remove = useCallback(
    (id: string) => write((all) => all.filter((s) => s.id !== id), { type: "stickerDelete", id }),
    [write],
  );

  const add = useCallback(
    (sticker: string, at: { x: number; y: number }) => {
      const all = queryClient.getQueryData<BoardSticker[]>(key(spaceId)) ?? [];
      const created: BoardSticker = {
        id: uuidv7(),
        spaceId,
        sticker,
        x: Math.round(at.x),
        y: Math.round(at.y),
        scale: 1,
        // a little wonk, like the cards
        rotation: Math.round((Math.random() - 0.5) * 24),
        z: Math.max(0, ...all.map((s) => s.z)) + 1,
      };
      void save(created);
      return created.id;
    },
    [queryClient, save, spaceId],
  );

  return { stickers: query.data ?? [], save, remove, add };
}
