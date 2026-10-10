"use client";

import { uuidv7 } from "@scraps/db";
import type { StartBlock } from "@scraps/editor";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { createNoteRemote } from "@/lib/collab";
import { createClient } from "@/lib/supabase/client";

/**
 * Creates a blank scrap in a space and opens it. Phase 3 replaces the entry points with the
 * quick capture sheet; the call underneath stays the same.
 */
export function useCreateNote(spaceId: string | null) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const create = useCallback(
    async (start: StartBlock = "text") => {
      if (!spaceId || pending) return;
      setPending(true);
      setFailed(false);
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("not signed in");
        const id = uuidv7();
        await createNoteRemote(token, { id, spaceId, start });
        router.push(`/n/${id}`);
      } catch {
        setFailed(true);
        setPending(false);
      }
    },
    [spaceId, pending, router],
  );

  return { create, pending, failed };
}
