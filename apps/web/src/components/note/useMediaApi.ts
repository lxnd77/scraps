"use client";

import type { LinkPreviewData, MediaApi } from "@scraps/editor/react";
import { useMemo } from "react";
import { ImageError } from "@/lib/media/image";
import { useSignedUrl } from "@/lib/media/signedUrl";
import { uploadImage } from "@/lib/media/upload";
import { useRecorder } from "@/lib/media/useRecorder";
import { createClient } from "@/lib/supabase/client";

const IMAGE_MESSAGES = {
  type: "that file isn't a pic we can use. try a jpeg, png, webp or gif.",
  too_big: "that pic is too big. try one under 40 MB.",
  unreadable: "couldn't read that pic. try another one.",
} as const;

/** Calls the unfurl-link Edge Function with the signed-in user's token. */
export async function unfurlLink(url: string): Promise<LinkPreviewData> {
  const { data, error } = await createClient().functions.invoke<LinkPreviewData>("unfurl-link", {
    body: { url },
  });
  if (error || !data) throw error ?? new Error("no preview");
  return data;
}

/** What the editor's media blocks need, bound to one note. */
export function useMediaApi(args: {
  noteId: string;
  spaceId: string;
  user: { id: string; name: string };
}): MediaApi {
  const { noteId, spaceId, user } = args;
  const { id: userId, name: userName } = user;

  return useMemo<MediaApi>(
    () => ({
      noteId,
      currentUser: { id: userId, name: userName },
      uploadImage: async (file) => {
        try {
          const up = await uploadImage(noteId, spaceId, file);
          return {
            assetId: up.assetId,
            path: up.path,
            width: up.width,
            height: up.height,
            color: up.color,
          };
        } catch (error) {
          if (error instanceof ImageError) throw new Error(IMAGE_MESSAGES[error.problem]);
          throw new Error("couldn't upload that pic. try again.");
        }
      },
      useSignedUrl,
      unfurl: unfurlLink,
      imageProxyUrl: (url) => `/api/img?u=${encodeURIComponent(url)}`,
      // a hook with a fixed identity, so it can be called from node views
      useRecorder: () => useRecorder(noteId, spaceId),
    }),
    [noteId, spaceId, userId, userName],
  );
}
