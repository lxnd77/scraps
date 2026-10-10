import {
  Server,
  type Extension,
  type onAuthenticatePayload,
  type onLoadDocumentPayload,
  type onRequestPayload,
  type onStoreDocumentPayload,
} from "@hocuspocus/server";
import { START_BLOCKS, contentToYdoc, initialContent } from "@scraps/editor";
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
  /** only honoured with the internal secret (the capture function acts for a user) */
  userId: z.uuid().optional(),
});

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
          });
        } else if (request.method === "POST" && url.pathname === "/notes") {
          await createNote(request, response, cors);
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

  return new Server<ConnectionContext>({
    name: "scraps-collab",
    quiet: true,
    stopOnSignals: false,
    debounce: deps.debounceMs ?? 2000,
    maxDebounce: deps.maxDebounceMs ?? 10_000,
    extensions: [extension as Extension],
  });
}
