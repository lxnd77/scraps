"use client";

import type { SpaceMemberInfo } from "@scraps/editor/react";
import { listSpaceMembers } from "@scraps/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { avatarColorFor } from "@/lib/presence";
import { createClient } from "@/lib/supabase/client";

/** The space's people in the shape the editor's assignee picker wants. */
export function useMembersInfo(spaceId: string): SpaceMemberInfo[] {
  const { data } = useQuery({
    queryKey: ["members", spaceId],
    queryFn: () => listSpaceMembers(createClient(), spaceId),
    staleTime: 60_000,
  });
  return useMemo(
    () =>
      (data ?? []).map((m) => ({
        id: m.userId,
        name: m.displayName || "someone",
        sticker: m.avatarSticker,
        accent: avatarColorFor(m.userId) as SpaceMemberInfo["accent"],
      })),
    [data],
  );
}
