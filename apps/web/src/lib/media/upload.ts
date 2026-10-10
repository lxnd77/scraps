import { uuidv7 } from "@scraps/db";
import { createClient } from "@/lib/supabase/client";
import { processImage, type ProcessedImage } from "./image";

export interface UploadedImage {
  assetId: string;
  path: string;
  width: number;
  height: number;
  color: string;
  bytes: number;
}

export interface UploadedAudio {
  assetId: string;
  path: string;
  durationMs: number;
}

/** Storage keys are `{noteId}/{assetId}.{ext}`: keyed by note so a move never touches storage. */
export function storagePath(noteId: string, assetId: string, ext: string): string {
  return `${noteId}/${assetId}.${ext}`;
}

async function currentUserId(): Promise<string> {
  const { data } = await createClient().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("not signed in");
  return id;
}

/** Uploads bytes then records the asset row. The block is inserted by the caller. */
async function store(args: {
  noteId: string;
  spaceId: string;
  assetId: string;
  ext: string;
  blob: Blob;
  mime: string;
  kind: "image" | "audio";
  extra: Record<string, unknown>;
}): Promise<string> {
  const supabase = createClient();
  const uploaderId = await currentUserId();
  const path = storagePath(args.noteId, args.assetId, args.ext);
  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, args.blob, { contentType: args.mime, upsert: false });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from("assets").insert({
    id: args.assetId,
    note_id: args.noteId,
    // the database trigger sets this from the note; the column type still wants a value
    space_id: args.spaceId,
    uploader_id: uploaderId,
    kind: args.kind,
    storage_path: path,
    mime: args.mime,
    bytes: args.blob.size,
    ...args.extra,
  });
  if (error) {
    // do not leave an orphan object behind
    await supabase.storage.from("media").remove([path]);
    throw error;
  }
  return path;
}

/** Processes (resize, WebP, strip EXIF) and uploads a picture for a note. */
export async function uploadImage(
  noteId: string,
  spaceId: string,
  file: File,
  options: { assetId?: string; processed?: ProcessedImage } = {},
): Promise<UploadedImage> {
  const processed = options.processed ?? (await processImage(file));
  const assetId = options.assetId ?? uuidv7();
  const path = await store({
    noteId,
    spaceId,
    assetId,
    ext: processed.ext,
    blob: processed.blob,
    mime: processed.mime,
    kind: "image",
    extra: {
      width: processed.width,
      height: processed.height,
      dominant_color: processed.color,
    },
  });
  return {
    assetId,
    path,
    width: processed.width,
    height: processed.height,
    color: processed.color,
    bytes: processed.blob.size,
  };
}

export async function uploadAudio(
  noteId: string,
  spaceId: string,
  recording: { blob: Blob; mime: string; ext: string; durationMs: number; peaks: number[] },
  options: { assetId?: string } = {},
): Promise<UploadedAudio> {
  const assetId = options.assetId ?? uuidv7();
  const path = await store({
    noteId,
    spaceId,
    assetId,
    ext: recording.ext,
    blob: recording.blob,
    mime: recording.mime,
    kind: "audio",
    extra: {
      duration_ms: recording.durationMs,
      waveform: recording.peaks,
      transcript_status: "none",
    },
  });
  return { assetId, path, durationMs: recording.durationMs };
}
