import {
  Server,
  type Extension,
  type Hocuspocus,
  type onAuthenticatePayload,
  type onLoadDocumentPayload,
  type onRequestPayload,
  type onStoreDocumentPayload,
} from "@hocuspocus/server";
import {
  START_BLOCKS,
  contentToYdoc,
  initialContent,
  setNoteTitleIfEmpty,
  setTaskItemChecked,
  ydocFromState,
} from "@scraps/editor";
import type { IncomingMessage, ServerResponse } from "node:http";
import * as Y from "yjs";
import { z } from "zod";
import { bearerToken, secretsMatch, type VerifyToken } from "./auth.js";
import type { NoteStore, Role } from "./store.js";

/** Per-connection context set by onAuthenticate. */
export interface ConnectionContext {
  userId: string;
  role: Role;
}

export interface CollabDeps {
  verifyToken: VerifyToken;
  store: NoteStore;
  internalSecret: string;
  allowedOrigins: string[];
  debounceMs?: number;
  maxDebounceMs?: number;
  /** how often open connections are re-checked against current membership (default 3 s) */
  roleSweepMs?: number;
  /** structured log sink; entries carry ids and counts, never note content */
  log?: (entry: Record<string, unknown>) => void;
}

const MAX_BODY_BYTES = 64 * 1024;
const uuid = z.uuid();

const createNoteBody = z.object({
  id: z.uuid(),
  spaceId: z.uuid(),
  start: z.enum(START_BLOCKS as [string, ...string[]]).default("text"),
  title: z.string().max(120).optional(),
  text: z.string().max(10_000).optional(),
  /** checklist starts: one entry per item (the first can also come from `text`) */
  items: z.array(z.string().max(500)).max(50).optional(),
  /** attributes for image, link, voice and sticker starts; paths are {noteId}/{assetId}.{ext} */
  media: z
    .object({
      assetId: z.uuid().optional(),
      path: z
        .string()
        .max(200)
        .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/)
        .optional(),
      width: z.number().int().min(1).max(20_000).optional(),
      height: z.number().int().min(1).max(20_000).optional(),
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
      url: z.url().max(2048).optional(),
      title: z.string().max(300).optional(),
      description: z.string().max(500).optional(),
      image: z.url().max(2048).optional(),
      domain: z.string().max(255).optional(),
      duration: z.number().int().min(0).max(86_400).optional(),
      mediaType: z.enum(["article", "video", "maps"]).optional(),
      durationMs: z.number().int().min(0).max(3_600_000).optional(),
      peaks: z.array(z.number().min(0).max(1)).max(160).optional(),
      authorId: z.uuid().optional(),
      authorName: z.string().max(80).optional(),
      sticker: z.string().max(40).optional(),
      images: z
        .array(
          z.object({
            assetId: z.uuid(),
            path: z
              .string()
              .max(200)
              .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/),
            caption: z.string().max(80).optional(),
          }),
        )
        .max(9)
        .optional(),
    })
    .optional(),
  /**
   * The document the client already built (base64 Yjs update). Offline-created notes use it so
   * the server and the device hold the same document instead of two copies that would merge into
   * duplicated content.
   */
  state: z.string().max(400_000).optional(),
  /** only honoured with the internal secret (the capture function acts for a user) */
  userId: z.uuid().optional(),
});

const checklistBody = z.object({
  /** position among the note's task items in document order (what the card preview lists) */
  index: z.number().int().min(0).max(10_000),
  checked: z.boolean(),
  /** the item's text as the card saw it; a mismatch means the card is stale */
  text: z.string().max(2_000).optional(),
});

const CHECKLIST_PATH = /^\/notes\/([^/]+)\/checklist$/;

const titleBody = z.object({ title: z.string().trim().min(1).max(120) });
const TITLE_PATH = /^\/notes\/([^/]+)\/title$/;

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "body_too_large");
    chunks.push(buf);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export function createCollabServer(deps: CollabDeps): Server<ConnectionContext> {
  const log = deps.log ?? (() => {});
  const startedAt = Date.now();

  async function authenticateRequest(
    req: IncomingMessage,
    claimedUser: string | undefined,
  ): Promise<string> {
    const internal = req.headers["x-internal-secret"];
    if (typeof internal === "string") {
      if (!secretsMatch(internal, deps.internalSecret) || !claimedUser) {
        throw new HttpError(401, "unauthorized");
      }
      return claimedUser;
    }
    const token = bearerToken(req.headers.authorization);
    if (!token) throw new HttpError(401, "unauthorized");
    try {
      return (await deps.verifyToken(token)).userId;
    } catch {
      throw new HttpError(401, "unauthorized");
    }
  }

  async function createNote(
    req: IncomingMessage,
    res: ServerResponse,
    cors: Record<string, string>,
  ) {
    const parsed = createNoteBody.safeParse(await readJson(req));
    if (!parsed.success) {
      return sendJson(
        res,
        400,
        { error: "invalid_request", issues: parsed.error.issues.map((i) => i.path.join(".")) },
        cors,
      );
    }
    const body = parsed.data;
    const userId = await authenticateRequest(req, body.userId);

    let state: Uint8Array | undefined;
    if (body.state !== undefined) {
      try {
        state = Uint8Array.from(Buffer.from(body.state, "base64"));
        // throws when it is not a Yjs update or does not satisfy the schema
        ydocFromState(state);
      } catch {
        return sendJson(res, 400, { error: "invalid_state" }, cors);
      }
    }

    const role = await deps.store.spaceRole(body.spaceId, userId);
    if (role !== "owner" && role !== "editor") {
      return sendJson(res, 403, { error: "forbidden" }, cors);
    }

    const result = await deps.store.createNote({
      id: body.id,
      spaceId: body.spaceId,
      userId,
      start: body.start as (typeof START_BLOCKS)[number],
      title: body.title,
      text: body.text,
      items: body.items,
      media: body.media,
      state,
    });
    if ("conflict" in result) return sendJson(res, 409, { error: "id_taken" }, cors);

    log({ level: "info", msg: "note created", noteId: body.id, created: result.created });
    return sendJson(
      res,
      result.created ? 201 : 200,
      { id: body.id, created: result.created },
      cors,
    );
  }

  async function toggleChecklist(
    req: IncomingMessage,
    res: ServerResponse,
    cors: Record<string, string>,
    noteId: string,
    instance: Hocuspocus,
  ) {
    if (!uuid.safeParse(noteId).success) return sendJson(res, 404, { error: "not_found" }, cors);
    const parsed = checklistBody.safeParse(await readJson(req));
    if (!parsed.success) return sendJson(res, 400, { error: "invalid_request" }, cors);
    const userId = await authenticateRequest(req, undefined);

    const role = await deps.store.noteRole(noteId, userId);
    if (!role) return sendJson(res, 404, { error: "not_found" }, cors);
    if (role === "viewer") return sendJson(res, 403, { error: "forbidden" }, cors);

    const connection = await instance.openDirectConnection(noteId, { userId, role });
    let outcome: { done: number; total: number } | "missing" | "stale" = "missing";
    try {
      await connection.transact((doc) => {
        const result = setTaskItemChecked(doc, parsed.data);
        outcome =
          result.status === "ok" ? { done: result.done, total: result.total } : result.status;
      });
    } finally {
      await connection.disconnect();
    }

    if (outcome === "missing") return sendJson(res, 404, { error: "no_such_item" }, cors);
    if (outcome === "stale") return sendJson(res, 409, { error: "stale" }, cors);
    return sendJson(res, 200, outcome, cors);
  }

  /** Titles an untitled note (an accepted AI suggestion). Never overwrites an existing title. */
  async function setTitle(
    req: IncomingMessage,
    res: ServerResponse,
    cors: Record<string, string>,
    noteId: string,
    instance: Hocuspocus,
  ) {
    if (!uuid.safeParse(noteId).success) return sendJson(res, 404, { error: "not_found" }, cors);
    const parsed = titleBody.safeParse(await readJson(req));
    if (!parsed.success) return sendJson(res, 400, { error: "invalid_request" }, cors);
    const userId = await authenticateRequest(req, undefined);

    const role = await deps.store.noteRole(noteId, userId);
    if (!role) return sendJson(res, 404, { error: "not_found" }, cors);
    if (role === "viewer") return sendJson(res, 403, { error: "forbidden" }, cors);

    const connection = await instance.openDirectConnection(noteId, { userId, role });
    let outcome: "ok" | "has_title" | "missing" = "missing";
    try {
      await connection.transact((doc) => {
        outcome = setNoteTitleIfEmpty(doc, parsed.data.title).status;
      });
    } finally {
      await connection.disconnect();
    }

    if (outcome === "missing") return sendJson(res, 404, { error: "not_found" }, cors);
    return sendJson(res, 200, { applied: outcome === "ok" }, cors);
  }

  const extension: Extension<ConnectionContext> = {
    async onAuthenticate(data: onAuthenticatePayload<ConnectionContext>) {
      if (!uuid.safeParse(data.documentName).success) throw new Error("invalid document name");
      let userId: string;
      try {
        userId = (await deps.verifyToken(data.token)).userId;
      } catch {
        throw new Error("unauthorized");
      }
      const role = await deps.store.noteRole(data.documentName, userId);
      // a note you are not in is indistinguishable from one that does not exist
      if (!role) throw new Error("forbidden");

      data.connectionConfig.readOnly = role === "viewer";
      log({ level: "info", msg: "connection authenticated", noteId: data.documentName, role });
      return { userId, role } satisfies ConnectionContext;
    },

    async onLoadDocument(data: onLoadDocumentPayload<ConnectionContext>) {
      const state = await deps.store.load(data.documentName);
      if (state) {
        Y.applyUpdate(data.document, state);
      } else {
        // a note row with no document yet (created outside POST /notes): start it properly
        Y.applyUpdate(data.document, Y.encodeStateAsUpdate(contentToYdoc(initialContent("text"))));
      }
    },

    async onStoreDocument(data: onStoreDocumentPayload<ConnectionContext>) {
      const editedBy = data.lastContext?.userId ?? null;
      await deps.store.save(data.documentName, data.document, editedBy);
      log({ level: "info", msg: "note stored", noteId: data.documentName });
    },

    async onRequest({ request, response, instance }: onRequestPayload) {
      const origin = request.headers.origin;
      const cors: Record<string, string> = {};
      if (origin && deps.allowedOrigins.includes(origin)) {
        cors["access-control-allow-origin"] = origin;
        cors["vary"] = "Origin";
        cors["access-control-allow-headers"] = "authorization, content-type";
        cors["access-control-allow-methods"] = "GET, POST, OPTIONS";
        cors["access-control-max-age"] = "600";
      }

      const url = new URL(request.url ?? "/", "http://collab");
      try {
        if (request.method === "OPTIONS") {
          response.writeHead(204, cors);
          response.end();
        } else if (
          request.method === "GET" &&
          (url.pathname === "/health" || url.pathname === "/healthz")
        ) {
          sendJson(response, 200, {
            status: "ok",
            service: "scraps-collab",
            uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
            documents: instance.getDocumentsCount(),
            connections: instance.getConnectionsCount(),
            rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
          });
        } else if (request.method === "POST" && url.pathname === "/notes") {
          await createNote(request, response, cors);
        } else if (request.method === "POST" && CHECKLIST_PATH.test(url.pathname)) {
          const noteId = CHECKLIST_PATH.exec(url.pathname)![1]!;
          await toggleChecklist(request, response, cors, noteId, instance);
        } else if (request.method === "POST" && TITLE_PATH.test(url.pathname)) {
          const noteId = TITLE_PATH.exec(url.pathname)![1]!;
          await setTitle(request, response, cors, noteId, instance);
        } else {
          sendJson(response, 404, { error: "not_found" }, cors);
        }
      } catch (error) {
        if (error instanceof HttpError) {
          sendJson(response, error.status, { error: error.code }, cors);
        } else {
          log({ level: "error", msg: "request failed", path: url.pathname });
          sendJson(response, 500, { error: "internal_error" }, cors);
        }
      }
      // the response is written; stop Hocuspocus from sending its default one
      return Promise.reject();
    },
  };

  const server = new Server<ConnectionContext>({
    name: "scraps-collab",
    quiet: true,
    stopOnSignals: false,
    debounce: deps.debounceMs ?? 2000,
    maxDebounce: deps.maxDebounceMs ?? 10_000,
    extensions: [extension as Extension],
  });

  // Membership can change while an editor is open: removed people are disconnected and demoted
  // ones become read-only, within one sweep (SPEC 9.1, phase 5.5).
  let sweeping = false;
  const timer = setInterval(() => {
    if (sweeping) return;
    sweeping = true;
    void sweepRoles(server.hocuspocus.documents, (noteId, userId) =>
      deps.store.noteRole(noteId, userId),
    )
      .then((result) => {
        if (result.closed > 0 || result.downgraded > 0) {
          log({ level: "info", msg: "roles swept", ...result });
        }
      })
      .catch(() => log({ level: "error", msg: "role sweep failed" }))
      .finally(() => {
        sweeping = false;
      });
  }, deps.roleSweepMs ?? 3000);
  timer.unref?.();

  const destroy = server.destroy.bind(server);
  server.destroy = async () => {
    clearInterval(timer);
    return destroy();
  };
  return server;
}

interface SweepConnection {
  context: ConnectionContext;
  readOnly: boolean;
  close: (event?: { code: number; reason: string }) => void;
  sendStateless?: (payload: string) => void;
}

/**
 * Re-checks every open connection: no role closes it, a drop to viewer makes it read-only.
 * Roles are looked up once per (note, user) pair per sweep. Exported for tests.
 */
export async function sweepRoles(
  documents: Map<string, { connections: Map<unknown, unknown> }>,
  lookup: (noteId: string, userId: string) => Promise<Role | null>,
): Promise<{ checked: number; closed: number; downgraded: number }> {
  const seen = new Map<string, Promise<Role | null>>();
  let checked = 0;
  let closed = 0;
  let downgraded = 0;

  for (const [noteId, document] of documents) {
    for (const key of [...document.connections.keys()]) {
      const connection = key as SweepConnection;
      const userId = connection.context?.userId;
      if (!userId) continue;
      checked++;
      const pair = `${noteId}:${userId}`;
      let pending = seen.get(pair);
      if (!pending) {
        pending = lookup(noteId, userId);
        seen.set(pair, pending);
      }
      const role = await pending;
      if (role === null) {
        connection.close({ code: 4403, reason: "forbidden" });
        closed++;
      } else if (role === "viewer" && !connection.readOnly) {
        connection.readOnly = true;
        connection.context.role = "viewer";
        // tell the browser, which would otherwise keep offering editing that the server ignores
        connection.sendStateless?.(JSON.stringify({ type: "role", role: "viewer" }));
        downgraded++;
      }
    }
  }
  return { checked, closed, downgraded };
}
