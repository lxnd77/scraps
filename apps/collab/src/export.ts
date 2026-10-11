import type { Database } from "@scraps/db";
import { contentToMarkdown, ydocToContent } from "@scraps/editor";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { strToU8, zipSync } from "fflate";
import * as Y from "yjs";

// Export everything (SPEC 9.9): one Markdown file per note with front matter, the pictures and
// memos they use, and a README, zipped, stored in the private `exports` bucket and handed back as
// a one hour signed link. It runs here rather than in an Edge Function because the Yjs-to-
// Markdown path needs the shared Tiptap schema, which Deno functions cannot load.

export const MAX_MEDIA_BYTES = 40 * 1024 * 1024;
export const EXPORTS_PER_DAY = 3;
const NOTE_BATCH = 50;

export class ExportRateLimited extends Error {
  constructor() {
    super("rate_limited");
  }
}

export interface ExportResult {
  url: string;
  notes: number;
  files: number;
  /** media left out because the zip would pass its size cap */
  skipped: number;
}

export interface Exporter {
  run(userId: string): Promise<ExportResult>;
}

// ---- pure helpers (unit tested) ---------------------------------------------------------------

/** Strings are written as JSON, which is valid YAML, so quotes and colons never break it. */
export function frontMatter(fields: Record<string, string | string[] | null | undefined>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([key, value]) =>
      Array.isArray(value)
        ? `${key}: [${value.map((v) => JSON.stringify(v)).join(", ")}]`
        : `${key}: ${JSON.stringify(value)}`,
    );
  return `---\n${lines.join("\n")}\n---\n`;
}

/** A safe file stem from a title; `used` keeps names unique inside one folder. */
export function uniqueName(title: string, id: string, used: Set<string>): string {
  const stem =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled";
  let name = stem;
  if (used.has(name)) name = `${stem}-${id.slice(0, 8)}`;
  used.add(name);
  return name;
}

export function buildZip(files: Record<string, Uint8Array | string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(files)) {
    entries[path] = typeof data === "string" ? strToU8(data) : data;
  }
  return zipSync(entries, { level: 6 });
}

export interface ExportNote {
  id: string;
  title: string;
  kind: string;
  spaceName: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  markdown: string;
}

/** The notes as `notes/{space}/{title}.md` files with front matter. */
export function noteFiles(notes: readonly ExportNote[]): Record<string, string> {
  const folders = new Map<string, Set<string>>();
  const out: Record<string, string> = {};
  for (const note of notes) {
    const spaceFolder = uniqueName(note.spaceName, "space", new Set());
    const used = folders.get(spaceFolder) ?? new Set<string>();
    folders.set(spaceFolder, used);
    const name = uniqueName(note.title, note.id, used);
    out[`notes/${spaceFolder}/${name}.md`] =
      frontMatter({
        title: note.title || "untitled",
        space: note.spaceName,
        tags: note.tags,
        kind: note.kind,
        created: note.createdAt,
        updated: note.updatedAt,
        id: note.id,
      }) +
      "\n" +
      (note.title ? `# ${note.title}\n\n` : "") +
      note.markdown +
      "\n";
  }
  return out;
}

// ---- the Supabase-backed exporter -------------------------------------------------------------

function fromHex(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value.startsWith("\\x") ? value.slice(2) : value, "hex"));
}

export function createSupabaseExporter(url: string, serviceRoleKey: string): Exporter {
  const db: SupabaseClient<Database> = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async run(userId) {
      // ---- rate limit, and tidy this person's old exports ----
      const { data: existing } = await db.storage.from("exports").list(userId, { limit: 100 });
      const dayAgo = Date.now() - 24 * 3600_000;
      const recent = (existing ?? []).filter(
        (f) => f.created_at && new Date(f.created_at).getTime() > dayAgo,
      );
      if (recent.length >= EXPORTS_PER_DAY) throw new ExportRateLimited();
      const old = (existing ?? [])
        .filter((f) => !recent.includes(f))
        .map((f) => `${userId}/${f.name}`);
      if (old.length > 0) await db.storage.from("exports").remove(old);

      // ---- what this person can see ----
      const { data: memberships, error: memberError } = await db
        .from("space_members")
        .select("space_id, spaces!inner(id, name, deleted_at)")
        .eq("user_id", userId)
        .is("spaces.deleted_at", null);
      if (memberError) throw memberError;
      const spaceName = new Map<string, string>(
        (memberships ?? []).map((m) => [
          m.space_id,
          (m.spaces as unknown as { name: string }).name,
        ]),
      );
      const spaceIds = [...spaceName.keys()];

      const notes: Array<{
        id: string;
        title: string;
        kind: string;
        space_id: string;
        created_at: string;
        updated_at: string;
        tags: string[];
      }> = [];
      if (spaceIds.length > 0) {
        for (let from = 0; ; from += 1000) {
          const { data, error } = await db
            .from("notes")
            .select("id, title, kind, space_id, created_at, updated_at, note_tags(tags(name))")
            .in("space_id", spaceIds)
            .is("deleted_at", null)
            .order("created_at")
            .range(from, from + 999);
          if (error) throw error;
          for (const row of data ?? []) {
            notes.push({
              id: row.id,
              title: row.title,
              kind: row.kind,
              space_id: row.space_id,
              created_at: row.created_at,
              updated_at: row.updated_at,
              tags: (row.note_tags ?? []).flatMap((nt) => (nt.tags ? [nt.tags.name] : [])),
            });
          }
          if ((data ?? []).length < 1000) break;
        }
      }

      // ---- documents to Markdown ----
      const exportNotes: ExportNote[] = [];
      const mediaPaths = new Set<string>();
      for (let i = 0; i < notes.length; i += NOTE_BATCH) {
        const batch = notes.slice(i, i + NOTE_BATCH);
        const ids = batch.map((n) => n.id);
        const [{ data: docs }, { data: assets }] = await Promise.all([
          db.from("note_docs").select("note_id, ydoc").in("note_id", ids),
          db
            .from("assets")
            .select("id, transcript")
            .in("note_id", ids)
            .eq("kind", "audio")
            .not("transcript", "is", null),
        ]);
        const docById = new Map((docs ?? []).map((d) => [d.note_id, d.ydoc as unknown as string]));
        const transcripts = Object.fromEntries(
          (assets ?? []).map((a) => [a.id, a.transcript as string]),
        );
        for (const note of batch) {
          let markdown = "";
          let title = note.title;
          const hex = docById.get(note.id);
          if (hex) {
            try {
              const ydoc = new Y.Doc();
              Y.applyUpdate(ydoc, fromHex(hex));
              const result = contentToMarkdown(ydocToContent(ydoc), {
                mediaFile: (path) => {
                  mediaPaths.add(path);
                  return `../../media/${path.split("/").pop()}`;
                },
                transcripts,
              });
              markdown = result.markdown;
              title = result.title || title;
            } catch {
              markdown = "";
            }
          }
          exportNotes.push({
            id: note.id,
            title,
            kind: note.kind,
            spaceName: spaceName.get(note.space_id) ?? "space",
            tags: note.tags,
            createdAt: note.created_at,
            updatedAt: note.updated_at,
            markdown,
          });
        }
      }

      // ---- media, up to the size cap ----
      const files: Record<string, Uint8Array | string> = { ...noteFiles(exportNotes) };
      let total = 0;
      let skipped = 0;
      let included = 0;
      for (const path of mediaPaths) {
        const { data: blob } = await db.storage.from("media").download(path);
        if (!blob) {
          skipped += 1;
          continue;
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (total + bytes.length > MAX_MEDIA_BYTES) {
          skipped += 1;
          continue;
        }
        total += bytes.length;
        included += 1;
        files[`media/${path.split("/").pop()}`] = bytes;
      }
      files["README.txt"] =
        `scraps. export, ${new Date().toISOString()}\n` +
        `${exportNotes.length} scraps, ${included} media files` +
        (skipped > 0 ? `, ${skipped} media files left out (the zip would be too big)` : "") +
        `.\nOne markdown file per scrap in notes/<space>/, pictures and memos in media/.\n`;

      // ---- store and sign ----
      const zip = buildZip(files);
      const path = `${userId}/scraps-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
      const { error: uploadError } = await db.storage
        .from("exports")
        .upload(path, zip, { contentType: "application/zip" });
      if (uploadError) throw uploadError;
      const { data: signed, error: signError } = await db.storage
        .from("exports")
        .createSignedUrl(path, 3600, { download: "scraps-export.zip" });
      if (signError || !signed) throw signError ?? new Error("no signed url");

      return { url: signed.signedUrl, notes: exportNotes.length, files: included, skipped };
    },
  };
}
