import { uuidv7 } from "@scraps/db";
import { unfurlLink } from "@/components/note/useMediaApi";
import { createNote } from "@/lib/notes";
import { processImage } from "@/lib/media/image";
import type { RecordedClip } from "@/lib/media/useRecorder";
import { storagePath, uploadAudio, uploadImage } from "@/lib/media/upload";
import { createClient } from "@/lib/supabase/client";

/** A scrap that failed halfway is removed again so the board never shows an empty shell. */
async function discard(noteId: string): Promise<void> {
  await createClient()
    .from("notes")
    .update({ deleted_at: new Date().toISOString(), meta_updated_at: new Date().toISOString() })
    .eq("id", noteId);
}

/**
 * Media captures create the note first (the asset row needs it), then upload. The block's path is
 * known up front because storage keys are `{noteId}/{assetId}.{ext}`; the card shows its loading
 * box until the object lands.
 */
export async function captureImage(args: {
  spaceId: string;
  file: File;
  title?: string;
}): Promise<string> {
  const processed = await processImage(args.file);
  const noteId = uuidv7();
  const assetId = uuidv7();
  await createNote({
    id: noteId,
    spaceId: args.spaceId,
    start: "image",
    title: args.title,
    media: {
      assetId,
      path: storagePath(noteId, assetId, processed.ext),
      width: processed.width,
      height: processed.height,
      color: processed.color,
    },
  });
  try {
    await uploadImage(noteId, args.spaceId, args.file, { assetId, processed });
  } catch (error) {
    await discard(noteId);
    throw error;
  }
  return noteId;
}

export async function captureLink(args: {
  spaceId: string;
  url: string;
  title?: string;
}): Promise<string> {
  let media: Record<string, unknown> = { url: args.url };
  try {
    // a failed unfurl still saves the link; the block retries when it is opened
    const p = await unfurlLink(args.url);
    media = {
      url: p.url,
      title: p.title ?? undefined,
      description: p.description ?? undefined,
      image: p.image ?? undefined,
      domain: p.domain ?? undefined,
      duration: p.duration ?? undefined,
      mediaType: p.mediaType,
    };
  } catch {
    // keep the bare url
  }
  const noteId = uuidv7();
  await createNote({
    id: noteId,
    spaceId: args.spaceId,
    start: "link",
    title: args.title,
    media: media as never,
  });
  return noteId;
}

export async function captureVoice(args: {
  spaceId: string;
  clip: RecordedClip;
  author: { id: string; name: string };
  title?: string;
}): Promise<string> {
  const noteId = uuidv7();
  const assetId = uuidv7();
  await createNote({
    id: noteId,
    spaceId: args.spaceId,
    start: "voice",
    title: args.title,
    media: {
      assetId,
      path: storagePath(noteId, assetId, args.clip.ext),
      durationMs: args.clip.durationMs,
      peaks: args.clip.peaks,
      authorId: args.author.id,
      authorName: args.author.name,
    },
  });
  try {
    await uploadAudio(noteId, args.spaceId, args.clip, { assetId });
  } catch (error) {
    await discard(noteId);
    throw error;
  }
  return noteId;
}

export async function captureSticker(args: {
  spaceId: string;
  sticker: string;
  title?: string;
}): Promise<string> {
  const noteId = uuidv7();
  await createNote({
    id: noteId,
    spaceId: args.spaceId,
    start: "sticker",
    title: args.title,
    media: { sticker: args.sticker },
  });
  return noteId;
}
