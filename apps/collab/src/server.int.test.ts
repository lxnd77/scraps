// Integration suite: real Supabase (auth, JWKS, Postgres), real store, real WebSocket sync.
// Run with the local stack up: `pnpm db:start`, then `pnpm --filter @scraps/collab test:int`.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@scraps/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createTokenVerifier } from "./auth.js";
import { createCollabServer } from "./server.js";
import { SupabaseNoteStore } from "./store.js";
import { connect, httpUrl, wsUrl, waitFor } from "./testing.js";

// Locally the secret key comes from apps/collab/.env.local (copied from .env.example); in CI it
// is exported from `supabase status`. It is never committed.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no file: rely on the process environment
}

const URL_ = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE || SERVICE.startsWith("paste-")) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is not set. Put the secret key from `supabase status` in apps/collab/.env.local.",
  );
}
// the publishable (anon) key is public by design and is the same on every local stack
const ANON = process.env.SUPABASE_ANON_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

const admin: SupabaseClient<Database> = createClient<Database>(URL_, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function createUser(label: string) {
  const email = `int-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@scraps.test`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("no user");

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hash = link.data.properties?.hashed_token;
  if (!hash) throw new Error("no token hash");
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const verified = await anon.auth.verifyOtp({ type: "email", token_hash: hash });
  const token = verified.data.session?.access_token;
  if (!token) throw verified.error ?? new Error("no session");
  return { id: created.data.user.id, token };
}

describe("collab against local Supabase", () => {
  let server: ReturnType<typeof createCollabServer>;
  let owner: Awaited<ReturnType<typeof createUser>>;
  let editor: Awaited<ReturnType<typeof createUser>>;
  let viewer: Awaited<ReturnType<typeof createUser>>;
  let stranger: Awaited<ReturnType<typeof createUser>>;
  let spaceId: string;

  beforeAll(async () => {
    [owner, editor, viewer, stranger] = await Promise.all([
      createUser("owner"),
      createUser("editor"),
      createUser("viewer"),
      createUser("stranger"),
    ]);

    const space = await admin
      .from("spaces")
      .insert({ owner_id: owner.id, name: "int space" })
      .select("id")
      .single();
    if (space.error) throw space.error;
    spaceId = space.data.id;
    await admin.from("space_members").insert([
      { space_id: spaceId, user_id: editor.id, role: "editor" },
      { space_id: spaceId, user_id: viewer.id, role: "viewer" },
    ]);

    server = createCollabServer({
      verifyToken: createTokenVerifier({ jwksUrl: `${URL_}/auth/v1/.well-known/jwks.json` }),
      store: new SupabaseNoteStore(URL_, SERVICE),
      internalSecret: "int-internal-secret-0123",
      allowedOrigins: [],
      debounceMs: 50,
      maxDebounceMs: 300,
    });
    await server.listen(0);
  });

  afterAll(async () => {
    await server?.destroy();
    // spaces cascade to members and notes; users cascade to profiles
    await admin.from("spaces").delete().eq("id", spaceId);
    for (const u of [owner, editor, viewer, stranger]) await admin.auth.admin.deleteUser(u.id);
  });

  const createNote = async (token: string, id: string, extra: object = {}) =>
    fetch(`${httpUrl(server)}/notes`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        connection: "close",
      },
      body: JSON.stringify({ id, spaceId, start: "list", title: "groceries", ...extra }),
    });

  it("creates a note with a real ES256 user token and writes the row, document and preview", async () => {
    const id = crypto.randomUUID();
    const res = await createNote(owner.token, id);
    expect(res.status).toBe(201);

    const note = await admin.from("notes").select("*").eq("id", id).single();
    expect(note.data).toMatchObject({
      space_id: spaceId,
      created_by: owner.id,
      title: "groceries",
      kind: "list",
    });
    const doc = await admin.from("note_docs").select("note_id").eq("note_id", id).maybeSingle();
    expect(doc.data?.note_id).toBe(id);

    // replay with the same id is a no-op, not a duplicate
    const again = await createNote(owner.token, id);
    expect(again.status).toBe(200);
  });

  it("rejects tokens that are not from this project", async () => {
    const res = await createNote("not.a.jwt", crypto.randomUUID());
    expect(res.status).toBe(401);
    await expect(connect(wsUrl(server), crypto.randomUUID(), "not.a.jwt")).rejects.toThrow(
      /authentication failed/,
    );
  });

  it("stores edits, derives the card, and records the streak day", async () => {
    const id = crypto.randomUUID();
    expect((await createNote(editor.token, id, { start: "text", title: "trip" })).status).toBe(201);

    const session = await connect(wsUrl(server), id, editor.token);
    const fragment = session.doc.getXmlFragment("default");
    const p = new Y.XmlElement("paragraph");
    p.insert(0, [new Y.XmlText("book train tickets for the goa trip")]);
    fragment.insert(fragment.length, [p]);

    await waitFor(async () => {
      const { data } = await admin.from("notes").select("preview_text").eq("id", id).single();
      return (data?.preview_text ?? "").includes("goa trip");
    }, 8000);
    session.destroy();

    const { data: note } = await admin.from("notes").select("*").eq("id", id).single();
    expect(note?.title).toBe("trip");
    expect(note?.last_edited_by).toBe(editor.id);
    expect(note?.word_count).toBe(8);

    // full-text search finds the word through the stored tsvector (in note_search, off realtime)
    const found = await admin
      .from("note_search")
      .select("note_id")
      .eq("note_id", id)
      .textSearch("search_text", "goa");
    expect(found.data?.map((r) => r.note_id)).toContain(id);

    const activity = await admin.from("note_activity").select("day").eq("user_id", editor.id);
    expect(activity.data?.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps strangers out and viewers read-only", async () => {
    const id = crypto.randomUUID();
    await createNote(owner.token, id, { start: "text", title: "private" });

    await expect(connect(wsUrl(server), id, stranger.token)).rejects.toThrow(
      /authentication failed/,
    );
    expect((await createNote(stranger.token, crypto.randomUUID())).status).toBe(403);
    expect((await createNote(viewer.token, crypto.randomUUID())).status).toBe(403);

    const v = await connect(wsUrl(server), id, viewer.token);
    const fragment = v.doc.getXmlFragment("default");
    const p = new Y.XmlElement("paragraph");
    p.insert(0, [new Y.XmlText("viewer was here")]);
    fragment.insert(fragment.length, [p]);
    await new Promise((r) => setTimeout(r, 500));
    v.destroy();
    await new Promise((r) => setTimeout(r, 300));

    const { data } = await admin.from("notes").select("preview_text").eq("id", id).single();
    expect(data?.preview_text ?? "").not.toContain("viewer was here");
  });

  it("revokes access when a member is removed", async () => {
    const id = crypto.randomUUID();
    await createNote(owner.token, id);
    const s = await connect(wsUrl(server), id, editor.token);
    s.destroy();

    await admin.from("space_members").delete().eq("space_id", spaceId).eq("user_id", editor.id);
    await expect(connect(wsUrl(server), id, editor.token)).rejects.toThrow(/authentication failed/);
  });
});
