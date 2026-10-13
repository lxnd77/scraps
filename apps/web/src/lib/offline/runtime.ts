import { createClient } from "@/lib/supabase/client";
import { accessToken } from "@/lib/auth-token";
import {
  ChecklistError,
  CreateNoteError,
  createNoteRemote,
  toggleChecklistRemote,
} from "@/lib/collab";
import { classifyStatus, errorFor, fromThrown } from "./classify";
import { offlineDb } from "./idb";
import {
  IdbOutboxStorage,
  MemoryOutboxStorage,
  Outbox,
  PermanentError,
  TransientError,
  type OutboxOp,
} from "./outbox";

/** A stored upload: the bytes wait here until the network is back. */
export interface PendingBlob {
  assetId: string;
  blob: Blob;
  mime: string;
  path: string;
}

const BLOB_STORE = "blobs" as const;

export async function putPendingBlob(entry: PendingBlob): Promise<void> {
  if (!offlineDb.available) throw new Error("no local storage for offline uploads");
  await offlineDb.put(BLOB_STORE, entry, entry.assetId);
}

export async function getPendingBlob(assetId: string): Promise<PendingBlob | undefined> {
  if (!offlineDb.available) return undefined;
  return offlineDb.get<PendingBlob>(BLOB_STORE, assetId);
}

/** Pending blobs by storage path, for rendering local object URLs. */
export async function getPendingBlobByPath(path: string): Promise<PendingBlob | undefined> {
  if (!offlineDb.available) return undefined;
  const all = await offlineDb.getAll<PendingBlob>(BLOB_STORE);
  return all.find((b) => b.path === path);
}

async function removePendingBlob(assetId: string): Promise<void> {
  if (offlineDb.available) await offlineDb.delete(BLOB_STORE, assetId);
}

/** Runs one queued write against the server. Every case is safe to repeat. */
export async function executeOp(op: OutboxOp): Promise<void> {
  const supabase = createClient();
  try {
    switch (op.type) {
      case "createNote": {
        // idempotent on id: a replay answers 200 instead of 201
        await createNoteRemote(await accessToken(), {
          id: op.noteId,
          spaceId: op.spaceId,
          start: op.start as never,
          state: op.state,
        });
        return;
      }
      case "patchNote": {
        const { error, status } = await supabase
          .from("notes")
          .update(op.fields as never)
          .eq("id", op.noteId);
        if (error) throw errorFor(status, error.message);
        return;
      }
      case "boardPositions": {
        const { error, status } = await supabase.rpc("set_board_positions", {
          p_space: op.spaceId,
          p_positions: op.positions,
          p_at: op.at,
        });
        if (error) throw errorFor(status, error.message);
        return;
      }
      case "stickerUpsert": {
        // last one wins: a sticker is only ever dragged by one hand at a time
        const { error, status } = await supabase
          .from("board_stickers")
          .upsert(op.sticker, { onConflict: "id" });
        if (error) throw errorFor(status, error.message);
        return;
      }
      case "stickerDelete": {
        const { error, status } = await supabase.from("board_stickers").delete().eq("id", op.id);
        if (error) throw errorFor(status, error.message);
        return;
      }
      case "tagAdd": {
        // reuse a tag that already has this name in the space, otherwise create ours
        const found = await supabase
          .from("tags")
          .select("id")
          .eq("space_id", op.spaceId)
          .ilike("name", op.name)
          .maybeSingle();
        if (found.error) throw errorFor(found.status, found.error.message);
        let tagId = found.data?.id ?? op.tagId;
        if (!found.data) {
          const created = await supabase
            .from("tags")
            .upsert(
              { id: op.tagId, space_id: op.spaceId, name: op.name, color: op.color },
              { onConflict: "id", ignoreDuplicates: true },
            );
          if (created.error) throw errorFor(created.status, created.error.message);
          tagId = op.tagId;
        }
        const linked = await supabase
          .from("note_tags")
          .upsert(
            { note_id: op.noteId, tag_id: tagId },
            { onConflict: "note_id,tag_id", ignoreDuplicates: true },
          );
        if (linked.error) throw errorFor(linked.status, linked.error.message);
        return;
      }
      case "tagRemove": {
        const { error, status } = await supabase
          .from("note_tags")
          .delete()
          .eq("note_id", op.noteId)
          .eq("tag_id", op.tagId);
        if (error) throw errorFor(status, error.message);
        return;
      }
      case "toggleChecklist": {
        try {
          await toggleChecklistRemote(await accessToken(), op.noteId, {
            index: op.index,
            checked: op.checked,
            text: op.text,
          });
        } catch (error) {
          if (error instanceof ChecklistError) {
            // stale or gone: the card is out of date, replaying cannot fix it
            throw errorFor(error.status === 409 ? 409 : error.status, error.message);
          }
          throw error;
        }
        return;
      }
      case "upload": {
        const pending = await getPendingBlob(op.assetId);
        // already uploaded by an earlier run that crashed before clearing the op
        if (pending) {
          const { error } = await supabase.storage
            .from("media")
            .upload(op.path, pending.blob, { contentType: op.mime, upsert: true });
          if (error) {
            const status = (error as { statusCode?: string | number }).statusCode;
            throw errorFor(typeof status === "string" ? Number(status) : status, error.message);
          }
        }
        const { data: auth } = await supabase.auth.getSession();
        const uploaderId = auth.session?.user.id;
        const inserted = await supabase.from("assets").upsert(
          {
            id: op.assetId,
            note_id: op.noteId,
            space_id: op.spaceId,
            uploader_id: uploaderId,
            kind: op.kind,
            storage_path: op.path,
            mime: op.mime,
            bytes: pending?.blob.size ?? 0,
            ...op.asset,
          } as never,
          { onConflict: "id", ignoreDuplicates: true },
        );
        if (inserted.error) throw errorFor(inserted.status, inserted.error.message);
        await removePendingBlob(op.assetId);
        return;
      }
    }
  } catch (error) {
    if (error instanceof CreateNoteError) {
      // 409 means the id belongs to someone else's note: nothing to retry
      throw errorFor(error.status, error.message);
    }
    const mapped = fromThrown(error);
    if (mapped instanceof TransientError || mapped instanceof PermanentError) throw mapped;
    throw new TransientError(String(error));
  }
}

let instance: Outbox | null = null;
let loaded: Promise<void> | null = null;

/** The app-wide outbox, created on first use in the browser. */
export function getOutbox(): Outbox {
  if (!instance) {
    const storage = offlineDb.available
      ? new IdbOutboxStorage(offlineDb)
      : new MemoryOutboxStorage();
    instance = new Outbox(storage, executeOp);
    loaded = instance.load().catch(() => {});
  }
  return instance;
}

/** Queues a write and tries to send it right away; resolves when it is safely stored locally. */
export async function queue(op: OutboxOp): Promise<void> {
  const outbox = getOutbox();
  await loaded;
  await outbox.enqueue(op);
  if (typeof navigator === "undefined" || navigator.onLine !== false) void outbox.flush();
}

/** Replays whatever is queued (called when the network comes back and at start-up). */
export async function flushOutbox(): Promise<void> {
  const outbox = getOutbox();
  await loaded;
  await outbox.flush();
}

export { classifyStatus };
