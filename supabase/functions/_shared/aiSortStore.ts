// The Supabase-backed SortStore for the `ai-sort` and `capture` functions. Uses the service role,
// so access is checked here by hand: only owners and editors of the note's space get a suggestion.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SortContext, SortStore } from "./aiSortService.ts";

type Admin = SupabaseClient;

export function supabaseSortStore(admin: Admin): SortStore {
  return {
    async loadContext(userId, noteId): Promise<SortContext | null> {
      const { data: note } = await admin
        .from("notes")
        .select("id, space_id, title, search_plain, preview, deleted_at")
        .eq("id", noteId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!note) return null;

      const { data: memberships } = await admin
        .from("space_members")
        .select("role, spaces!inner(id, name, deleted_at)")
        .eq("user_id", userId)
        .is("spaces.deleted_at", null);
      const mine = (memberships ?? []) as unknown as Array<{
        role: string;
        spaces: { id: string; name: string };
      }>;
      const here = mine.find((m) => m.spaces.id === note.space_id);
      if (!here) return null;
      const writable = mine.filter((m) => m.role === "owner" || m.role === "editor");

      const { data: profile } = await admin
        .from("profiles")
        .select("ai_enabled")
        .eq("id", userId)
        .maybeSingle();

      const { data: assets } = await admin
        .from("assets")
        .select("transcript")
        .eq("note_id", noteId)
        .eq("kind", "audio")
        .not("transcript", "is", null);

      const spaceIds = writable.map((m) => m.spaces.id);
      const { data: tagRows } = spaceIds.length
        ? await admin.from("tags").select("name, space_id").in("space_id", spaceIds).order("name")
        : { data: [] as Array<{ name: string; space_id: string }> };
      const tags = [...(tagRows ?? [])]
        .sort((a, b) => Number(b.space_id === note.space_id) - Number(a.space_id === note.space_id))
        .map((t) => t.name as string);

      const preview = (note.preview ?? {}) as { link?: { title?: string; domain?: string } };
      const title = (note.title as string) ?? "";
      let text = (note.search_plain as string | null) ?? "";
      if (title && text.startsWith(title)) text = text.slice(title.length);

      return {
        aiEnabled: profile?.ai_enabled === true,
        canWrite: here.role === "owner" || here.role === "editor",
        note: {
          spaceId: note.space_id as string,
          title,
          text,
          linkTitle: preview.link?.title ?? null,
          linkDomain: preview.link?.domain ?? null,
          transcript: (assets ?? [])
            .map((a: { transcript: string | null }) => a.transcript ?? "")
            .join(" ")
            .trim(),
        },
        spaces: writable.map((m) => ({ id: m.spaces.id, name: m.spaces.name })),
        tags,
      };
    },

    async takeSlot(userId) {
      const { data, error } = await admin.rpc("use_ai_slot", { p_user: userId });
      // if the limiter itself fails, do not call the model
      return !error && data === true;
    },

    async saveSuggestion(row) {
      await admin
        .from("ai_suggestions")
        .update({ status: "dismissed" })
        .eq("note_id", row.noteId)
        .eq("user_id", row.userId)
        .eq("status", "pending");
      const { data, error } = await admin
        .from("ai_suggestions")
        .insert({
          note_id: row.noteId,
          user_id: row.userId,
          space_id: row.spaceId,
          tags: row.tags,
          title: row.title,
          confidence: row.confidence,
          model: row.model,
        })
        .select("id, created_at")
        .single();
      if (error || !data) throw new Error("could not store suggestion");
      return { id: data.id as string, createdAt: data.created_at as string };
    },
  };
}
