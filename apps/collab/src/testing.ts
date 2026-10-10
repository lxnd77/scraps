import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import type { Server } from "@hocuspocus/server";
import { ydocToContent, extractPreview, type NotePreview } from "@scraps/editor";
import WebSocket from "ws";
import * as Y from "yjs";
import type { VerifyToken } from "./auth.js";
import type { ConnectionContext } from "./server.js";
import type { CreateNoteInput, CreateNoteResult, NoteStore, Role } from "./store.js";

/** In-memory store with the same contract as SupabaseNoteStore. */
export class FakeStore implements NoteStore {
  notes = new Map<string, { spaceId: string; createdBy: string }>();
  roles = new Map<string, Role>(); // key: `${spaceId}:${userId}`
  docs = new Map<string, Uint8Array>();
  previews = new Map<string, NotePreview>();
  saves: Array<{ noteId: string; editedBy: string | null }> = [];

  grant(spaceId: string, userId: string, role: Role) {
    this.roles.set(`${spaceId}:${userId}`, role);
  }

  addNote(noteId: string, spaceId: string, createdBy = "owner") {
    this.notes.set(noteId, { spaceId, createdBy });
  }

  async noteRole(noteId: string, userId: string) {
    const note = this.notes.get(noteId);
    return note ? (this.roles.get(`${note.spaceId}:${userId}`) ?? null) : null;
  }

  async spaceRole(spaceId: string, userId: string) {
    return this.roles.get(`${spaceId}:${userId}`) ?? null;
  }

  async load(noteId: string) {
    return this.docs.get(noteId) ?? null;
  }

  async save(noteId: string, document: Y.Doc, editedBy: string | null) {
    this.docs.set(noteId, Y.encodeStateAsUpdate(document));
    this.previews.set(noteId, extractPreview(ydocToContent(document)));
    this.saves.push({ noteId, editedBy });
  }

  async createNote(input: CreateNoteInput): Promise<CreateNoteResult | { conflict: true }> {
    const existing = this.notes.get(input.id);
    if (existing) {
      if (existing.spaceId !== input.spaceId || existing.createdBy !== input.userId) {
        return { conflict: true };
      }
      return { created: false, spaceId: existing.spaceId };
    }
    this.addNote(input.id, input.spaceId, input.userId);
    // reuse save so previews are derived exactly as in production
    const { contentToYdoc, initialContent } = await import("@scraps/editor");
    await this.save(
      input.id,
      contentToYdoc(initialContent(input.start, { title: input.title, text: input.text, items: input.items })),
      input.userId,
    );
    return { created: true, spaceId: input.spaceId };
  }
}

/** Tokens in tests are just `user:<id>`; real verification is covered by the integration suite. */
export const fakeVerify: VerifyToken = async (token) => {
  const match = /^user:([0-9a-f-]{36})$/.exec(token);
  if (!match) throw new Error("bad token");
  return { userId: match[1]! };
};

export const uid = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const sid = (n: number) => `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const nid = (n: number) => `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`;

export function wsUrl(server: Server<ConnectionContext>): string {
  const { port } = server.address;
  return `ws://127.0.0.1:${port}`;
}

export function httpUrl(server: Server<ConnectionContext>): string {
  const { port } = server.address;
  return `http://127.0.0.1:${port}`;
}

export interface Connected {
  provider: HocuspocusProvider;
  doc: Y.Doc;
  destroy: () => void;
}

/** Test servers reuse ephemeral ports, so never let fetch keep a socket alive between them. */
export const noKeepAlive = { connection: "close" } as const;

/** Opens a provider and resolves once synced, or rejects if authentication fails. */
export function connect(url: string, name: string, token: string): Promise<Connected> {
  const doc = new Y.Doc();
  return new Promise((resolve, reject) => {
    const socket = new HocuspocusProviderWebsocket({ url, WebSocketPolyfill: WebSocket });
    const close = () => {
      provider.destroy();
      socket.destroy();
    };
    const provider: HocuspocusProvider = new HocuspocusProvider({
      name,
      document: doc,
      token,
      websocketProvider: socket,
      onSynced: () => resolve({ provider, doc, destroy: close }),
      onAuthenticationFailed: ({ reason }: { reason: string }) => {
        close();
        reject(new Error(`authentication failed: ${reason}`));
      },
    });
    provider.attach();
    setTimeout(() => {
      close();
      reject(new Error("timed out connecting"));
    }, 8000);
  });
}

export async function waitFor(check: () => boolean | Promise<boolean>, ms = 5000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("condition not met in time");
}
