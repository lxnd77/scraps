import { contentToYdoc, initialContent, ydocToContent } from "@scraps/editor";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createCollabServer } from "./server.js";
import {
  FakeStore,
  connect,
  noKeepAlive,
  fakeVerify,
  httpUrl,
  nid,
  sid,
  uid,
  waitFor,
  wsUrl,
  type Connected,
} from "./testing.js";

const OWNER = uid(1);
const EDITOR = uid(2);
const VIEWER = uid(3);
const STRANGER = uid(4);
const SPACE = sid(1);
const NOTE = nid(1);
const SECRET = "test-internal-secret-0123";

let store: FakeStore;
let server: ReturnType<typeof createCollabServer>;
let open: Connected[] = [];

beforeEach(async () => {
  store = new FakeStore();
  store.grant(SPACE, OWNER, "owner");
  store.grant(SPACE, EDITOR, "editor");
  store.grant(SPACE, VIEWER, "viewer");
  store.addNote(NOTE, SPACE, OWNER);
  store.docs.set(
    NOTE,
    Y.encodeStateAsUpdate(contentToYdoc(initialContent("text", { title: "hello" }))),
  );

  server = createCollabServer({
    verifyToken: fakeVerify,
    store,
    internalSecret: SECRET,
    allowedOrigins: ["http://localhost:3000"],
    debounceMs: 40,
    maxDebounceMs: 200,
  });
  await server.listen(0);
  open = [];
});

afterEach(async () => {
  for (const c of open) c.destroy();
  await server.destroy();
});

async function join(userId: string, noteId = NOTE) {
  const c = await connect(wsUrl(server), noteId, `user:${userId}`);
  open.push(c);
  return c;
}

function appendParagraph(doc: Y.Doc, text: string) {
  const fragment = doc.getXmlFragment("default");
  const p = new Y.XmlElement("paragraph");
  p.insert(0, [new Y.XmlText(text)]);
  fragment.insert(fragment.length, [p]);
}

describe("authentication", () => {
  it("lets a member in and syncs the stored document", async () => {
    const { doc } = await join(EDITOR);
    expect(ydocToContent(doc).content?.[0]).toMatchObject({ type: "title" });
  });

  it("refuses a bad token", async () => {
    await expect(connect(wsUrl(server), NOTE, "garbage")).rejects.toThrow(/authentication failed/);
  });

  it("refuses a signed-in user who is not in the space", async () => {
    await expect(join(STRANGER)).rejects.toThrow(/authentication failed/);
  });

  it("refuses a note that does not exist, same as one you cannot see", async () => {
    await expect(join(OWNER, nid(99))).rejects.toThrow(/authentication failed/);
  });

  it("refuses a document name that is not a uuid", async () => {
    await expect(connect(wsUrl(server), "not-a-uuid", `user:${OWNER}`)).rejects.toThrow(
      /authentication failed/,
    );
  });
});

describe("roles", () => {
  it("applies an editor's change for everyone", async () => {
    const editor = await join(EDITOR);
    const owner = await join(OWNER);
    appendParagraph(editor.doc, "from the editor");
    await waitFor(() => JSON.stringify(ydocToContent(owner.doc)).includes("from the editor"));
  });

  it("ignores a viewer's changes: read only", async () => {
    const viewer = await join(VIEWER);
    const owner = await join(OWNER);
    appendParagraph(viewer.doc, "sneaky");
    await new Promise((r) => setTimeout(r, 300));
    expect(JSON.stringify(ydocToContent(owner.doc))).not.toContain("sneaky");
    // and nothing from the viewer is ever stored
    owner.destroy();
    await new Promise((r) => setTimeout(r, 200));
    const stored = store.previews.get(NOTE);
    expect(stored?.previewText ?? "").not.toContain("sneaky");
  });
});

describe("persistence and previews", () => {
  it("stores the document and derived card fields, attributed to the editor", async () => {
    const editor = await join(EDITOR);
    appendParagraph(editor.doc, "book train tickets for the goa trip");
    await waitFor(() => store.saves.length > 0);

    const saved = store.previews.get(NOTE)!;
    expect(saved.title).toBe("hello");
    expect(saved.previewText).toContain("goa trip");
    expect(saved.kind).toBe("text");
    expect(store.saves.at(-1)?.editedBy).toBe(EDITOR);
  });

  it("flushes on last disconnect without waiting for the debounce", async () => {
    // a debounce far longer than the test: only an on-disconnect flush can make this pass
    await server.destroy();
    server = createCollabServer({
      verifyToken: fakeVerify,
      store,
      internalSecret: SECRET,
      allowedOrigins: [],
      debounceMs: 60_000,
      maxDebounceMs: 60_000,
    });
    await server.listen(0);

    const editor = await join(OWNER);
    appendParagraph(editor.doc, "typed just before closing the tab");
    await new Promise((r) => setTimeout(r, 100));
    editor.destroy();
    await waitFor(() => store.saves.length > 0, 3000);
    expect(store.previews.get(NOTE)?.previewText).toContain("just before closing");
  });

  it("reloads what was stored", async () => {
    const first = await join(OWNER);
    appendParagraph(first.doc, "remember me");
    await waitFor(() => store.saves.length > 0);
    first.destroy();
    await new Promise((r) => setTimeout(r, 150));

    const second = await join(OWNER);
    expect(JSON.stringify(ydocToContent(second.doc))).toContain("remember me");
  });

  it("seeds a valid document for a note that has none yet", async () => {
    store.addNote(nid(2), SPACE, OWNER);
    const { doc } = await join(OWNER, nid(2));
    const content = ydocToContent(doc);
    expect(content.content?.[0]?.type).toBe("title");
    expect(content.content?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("HTTP", () => {
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${httpUrl(server)}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...noKeepAlive, ...headers },
      body: JSON.stringify(body),
    });

  it("answers /health", async () => {
    const res = await fetch(`${httpUrl(server)}/health`, { headers: noKeepAlive });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", service: "scraps-collab" });
  });

  it("404s unknown routes", async () => {
    const res = await fetch(`${httpUrl(server)}/nope`, { headers: noKeepAlive });
    expect(res.status).toBe(404);
  });

  it("answers CORS preflight only for allowed origins", async () => {
    const ok = await fetch(`${httpUrl(server)}/notes`, {
      method: "OPTIONS",
      headers: { origin: "http://localhost:3000", ...noKeepAlive },
    });
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");

    const bad = await fetch(`${httpUrl(server)}/notes`, {
      method: "OPTIONS",
      headers: { origin: "https://evil.test", ...noKeepAlive },
    });
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });

  describe("POST /notes", () => {
    const body = (id: string) => ({ id, spaceId: SPACE, start: "list", title: "groceries" });

    it("creates a note with an initial block as an editor", async () => {
      const res = await post("/notes", body(nid(10)), { authorization: `Bearer user:${EDITOR}` });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ id: nid(10), created: true });
      expect(store.previews.get(nid(10))).toMatchObject({ title: "groceries", kind: "list" });
    });

    it("is idempotent on the id", async () => {
      const headers = { authorization: `Bearer user:${EDITOR}` };
      await post("/notes", body(nid(11)), headers);
      const again = await post("/notes", body(nid(11)), headers);
      expect(again.status).toBe(200);
      expect(await again.json()).toEqual({ id: nid(11), created: false });
      expect(store.saves.filter((s) => s.noteId === nid(11))).toHaveLength(1);
    });

    it("rejects an id that is already someone else's", async () => {
      await post("/notes", body(nid(12)), { authorization: `Bearer user:${EDITOR}` });
      const res = await post("/notes", body(nid(12)), { authorization: `Bearer user:${OWNER}` });
      expect(res.status).toBe(409);
    });

    it("needs a valid token", async () => {
      expect((await post("/notes", body(nid(13)))).status).toBe(401);
      expect((await post("/notes", body(nid(13)), { authorization: "Bearer nope" })).status).toBe(
        401,
      );
    });

    it("refuses viewers and strangers", async () => {
      const viewer = await post("/notes", body(nid(14)), {
        authorization: `Bearer user:${VIEWER}`,
      });
      const stranger = await post("/notes", body(nid(14)), {
        authorization: `Bearer user:${STRANGER}`,
      });
      expect(viewer.status).toBe(403);
      expect(stranger.status).toBe(403);
      expect(store.notes.has(nid(14))).toBe(false);
    });

    it("seeds a checklist from several items", async () => {
      const res = await post(
        "/notes",
        { id: nid(15), spaceId: SPACE, start: "list", title: "trip", items: ["tent", "stove"] },
        { authorization: `Bearer user:${EDITOR}` },
      );
      expect(res.status).toBe(201);
      expect(store.previews.get(nid(15))?.preview.checklist).toMatchObject({ total: 2, done: 0 });
    });

    it("validates the body", async () => {
      const res = await post(
        "/notes",
        { id: "nope", spaceId: SPACE },
        { authorization: `Bearer user:${EDITOR}` },
      );
      expect(res.status).toBe(400);
    });

    it("lets the internal secret act for a user, and only with the right secret", async () => {
      const ok = await post(
        "/notes",
        { ...body(nid(15)), userId: EDITOR },
        { "x-internal-secret": SECRET },
      );
      expect(ok.status).toBe(201);

      const wrong = await post(
        "/notes",
        { ...body(nid(16)), userId: EDITOR },
        { "x-internal-secret": "wrong-secret-wrong-secret" },
      );
      expect(wrong.status).toBe(401);
    });

    it("ignores a userId in the body when a user token is used", async () => {
      const res = await post(
        "/notes",
        { ...body(nid(17)), userId: OWNER },
        { authorization: `Bearer user:${VIEWER}` },
      );
      // still judged as the token's user, who is a viewer
      expect(res.status).toBe(403);
    });

    it("rejects oversized bodies", async () => {
      const res = await post(
        "/notes",
        { ...body(nid(18)), text: "x".repeat(70_000) },
        { authorization: `Bearer user:${EDITOR}` },
      );
      expect(res.status).toBe(413);
    });
  });
});

describe("POST /notes/:id/checklist", () => {
  const LIST = nid(20);
  const post = (body: unknown, token: string | null, id = LIST) =>
    fetch(`${httpUrl(server)}/notes/${id}/checklist`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...noKeepAlive,
        ...(token ? { authorization: `Bearer user:${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  beforeEach(() => {
    store.addNote(LIST, SPACE, OWNER);
    store.docs.set(
      LIST,
      Y.encodeStateAsUpdate(
        contentToYdoc(initialContent("list", { title: "trip", items: ["tent", "stove"] })),
      ),
    );
  });

  it("ticks an item for a connected editor and persists it", async () => {
    const watcher = await join(OWNER, LIST);
    const res = await post({ index: 1, checked: true, text: "stove" }, EDITOR);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ done: 1, total: 2 });
    await waitFor(() => JSON.stringify(ydocToContent(watcher.doc)).includes('"checked":true'));
    await waitFor(() => store.previews.get(LIST)?.preview.checklist?.done === 1);
    expect(store.saves.at(-1)).toMatchObject({ noteId: LIST, editedBy: EDITOR });
  });

  it("works with nobody connected", async () => {
    const res = await post({ index: 0, checked: true }, OWNER);
    expect(res.status).toBe(200);
    await waitFor(() => store.previews.get(LIST)?.preview.checklist?.items[0]?.done === true);
  });

  it("untick works too", async () => {
    await post({ index: 0, checked: true }, OWNER);
    const res = await post({ index: 0, checked: false }, OWNER);
    expect(await res.json()).toEqual({ done: 0, total: 2 });
  });

  it("refuses viewers, strangers and anonymous callers", async () => {
    expect((await post({ index: 0, checked: true }, VIEWER)).status).toBe(403);
    expect((await post({ index: 0, checked: true }, STRANGER)).status).toBe(404);
    expect((await post({ index: 0, checked: true }, null)).status).toBe(401);
  });

  it("refuses a stale card and an index that is gone", async () => {
    expect((await post({ index: 0, checked: true, text: "something else" }, OWNER)).status).toBe(
      409,
    );
    expect((await post({ index: 7, checked: true }, OWNER)).status).toBe(404);
  });

  it("validates the body", async () => {
    expect((await post({ index: -1, checked: true }, OWNER)).status).toBe(400);
    expect((await post({ index: 0 }, OWNER)).status).toBe(400);
  });
});

describe("POST /notes with media starts", () => {
  const A = "0190aaaa-0000-7000-8000-000000000001";
  const post = (body: unknown) =>
    fetch(`${httpUrl(server)}/notes`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...noKeepAlive,
        authorization: `Bearer user:${EDITOR}`,
      },
      body: JSON.stringify(body),
    });

  it("creates an image-led scrap", async () => {
    const id = nid(30);
    const res = await post({
      id,
      spaceId: SPACE,
      start: "image",
      media: { assetId: A, path: `${id}/${A}.webp`, width: 800, height: 600, color: "#aabbcc" },
    });
    expect(res.status).toBe(201);
    expect(store.previews.get(id)).toMatchObject({ kind: "pic" });
    expect(store.previews.get(id)?.preview.imagePaths).toEqual([`${id}/${A}.webp`]);
  });

  it("creates link-led and voice-led scraps", async () => {
    const link = await post({
      id: nid(31),
      spaceId: SPACE,
      start: "link",
      media: {
        url: "https://example.com/a",
        title: "a",
        domain: "example.com",
        mediaType: "article",
      },
    });
    expect(link.status).toBe(201);
    expect(store.previews.get(nid(31))?.kind).toBe("link");

    const voice = await post({
      id: nid(32),
      spaceId: SPACE,
      start: "voice",
      media: { assetId: A, path: `${nid(32)}/${A}.webm`, durationMs: 4000, peaks: [0.2, 0.9] },
    });
    expect(voice.status).toBe(201);
    expect(store.previews.get(nid(32))?.kind).toBe("voice");
  });

  it("refuses a media path that is not note/asset shaped", async () => {
    const res = await post({
      id: nid(33),
      spaceId: SPACE,
      start: "image",
      media: { assetId: A, path: "../../etc/passwd" },
    });
    expect(res.status).toBe(400);
  });
});
