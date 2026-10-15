import { listSpaceTags, uuidv7, type NoteTag } from "@scraps/db";
import { accessToken } from "@/lib/auth-token";
import { setTitleRemote } from "@/lib/collab";
import { queue } from "@/lib/offline/runtime";
import { createClient } from "@/lib/supabase/client";

/** One suggestion as the `ai-sort` function stores and returns it (SPEC 9.5). */
export interface AiSuggestion {
  id: string;
  noteId: string;
  /** a space to move the scrap to, or null to leave it where it is */
  spaceId: string | null;
  tags: string[];
  title: string | null;
  confidence: number;
}

export type SuggestResult =
  | { status: "ok"; suggestion: AiSuggestion | null }
  | { status: "disabled" | "rate_limited" | "unconfigured" | "model_error" | "error" };

/** Why there was no suggestion, in the dev console only: the toast stays short and friendly. */
function debugLog(what: string, info: unknown): void {
  if (process.env.NODE_ENV !== "production") console.warn(`[ai-sort] ${what}`, info);
}

function isSuggestion(value: unknown): value is AiSuggestion {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.noteId === "string" &&
    (v.spaceId === null || typeof v.spaceId === "string") &&
    Array.isArray(v.tags) &&
    v.tags.every((t) => typeof t === "string") &&
    (v.title === null || typeof v.title === "string")
  );
}

/**
 * Asks the `ai-sort` Edge Function for a suggestion. Online only and never queued: a suggestion
 * is not worth replaying later. Anything unexpected is "no suggestion", never an error to show.
 */
export async function requestSuggestion(noteId: string): Promise<SuggestResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { status: "error" };
  try {
    const { data, error } = await createClient().functions.invoke<{
      suggestion?: unknown;
      reason?: string;
      detail?: string;
    }>("ai-sort", { body: { noteId } });
    if (error) {
      const response = (error as { context?: Response }).context;
      const body = await response?.json().catch(() => null);
      const code = (body as { error?: string } | null)?.error;
      // no response at all usually means the functions are not running (`pnpm functions`)
      debugLog("request failed", { status: response?.status ?? "no response", code, error });
      if (code === "ai_disabled") return { status: "disabled" };
      if (code === "ai_unconfigured") return { status: "unconfigured" };
      if (code === "rate_limited" || response?.status === 429) return { status: "rate_limited" };
      return { status: "error" };
    }
    const suggestion = data?.suggestion;
    if (!isSuggestion(suggestion)) {
      debugLog("no suggestion", { reason: data?.reason, detail: data?.detail });
      // the model call itself failed (a rejected key, say): not the same as "nothing to suggest"
      if (data?.reason === "model_error") return { status: "model_error" };
      return { status: "ok", suggestion: null };
    }
    return { status: "ok", suggestion };
  } catch (error) {
    debugLog("request threw", error);
    return { status: "error" };
  }
}

/** The newest suggestion still waiting (from a shortcut capture), made in the last day. */
export async function fetchPendingSuggestion(): Promise<AiSuggestion | null> {
  try {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data } = await createClient()
      .from("ai_suggestions")
      .select("id, note_id, space_id, tags, title, confidence")
      .eq("status", "pending")
      .gt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      noteId: data.note_id,
      spaceId: data.space_id,
      tags: data.tags,
      title: data.title,
      confidence: data.confidence,
    };
  } catch {
    return null;
  }
}

export async function markSuggestion(id: string, status: "accepted" | "dismissed"): Promise<void> {
  try {
    await createClient().from("ai_suggestions").update({ status }).eq("id", id);
  } catch {
    // the suggestion is simply shown again later; nothing to tell the person
  }
}

export interface AcceptDeps {
  /** tags that exist in the space the scrap ends up in */
  tagsInSpace(spaceId: string): Promise<NoteTag[]>;
  queue: typeof queue;
  setTitle(noteId: string, title: string): Promise<void>;
  mark(id: string, status: "accepted" | "dismissed"): Promise<void>;
  newId(): string;
  now(): string;
}

export const defaultAcceptDeps: AcceptDeps = {
  tagsInSpace: (spaceId) => listSpaceTags(createClient(), spaceId),
  queue,
  setTitle: async (noteId, title) => {
    await setTitleRemote(await accessToken(), noteId, title);
  },
  mark: markSuggestion,
  newId: uuidv7,
  now: () => new Date().toISOString(),
};

/**
 * Applies a suggestion the person said yes to, as them and through the normal paths: the move and
 * tag links go through the outbox (RLS decides), the title through the collab server, which only
 * fills an empty one. Each part is independent: a failed title does not undo the move.
 * Returns the space the scrap is in afterwards.
 */
export async function acceptSuggestion(
  suggestion: AiSuggestion,
  currentSpaceId: string,
  deps: AcceptDeps = defaultAcceptDeps,
): Promise<{ spaceId: string; moved: boolean }> {
  const target = suggestion.spaceId ?? currentSpaceId;
  const moved = target !== currentSpaceId;

  if (moved) {
    await deps.queue({
      type: "patchNote",
      noteId: suggestion.noteId,
      fields: { space_id: target, meta_updated_at: deps.now() },
    });
  }

  if (suggestion.tags.length > 0) {
    let known: NoteTag[] | null = null;
    try {
      known = await deps.tagsInSpace(target);
    } catch {
      known = null; // without the space's tags a new one could collide with an existing name
    }
    if (known) {
      const linked = new Set<string>();
      for (const name of suggestion.tags) {
        if (linked.has(name.toLowerCase())) continue;
        linked.add(name.toLowerCase());
        const existing = known.find((k) => k.name.toLowerCase() === name.toLowerCase());
        const tag = existing ?? { id: deps.newId(), name, color: "lilac" as const };
        if (!existing) known.push(tag);
        await deps
          .queue({
            type: "tagAdd",
            noteId: suggestion.noteId,
            spaceId: target,
            tagId: tag.id,
            name: tag.name,
            color: tag.color,
          })
          .catch(() => undefined);
      }
    }
  }

  if (suggestion.title) {
    await deps.setTitle(suggestion.noteId, suggestion.title).catch(() => undefined);
  }

  await deps.mark(suggestion.id, "accepted");
  return { spaceId: target, moved };
}
