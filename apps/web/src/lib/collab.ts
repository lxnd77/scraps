import type { StartBlock, StartMedia } from "@scraps/editor";

/** WebSocket URL of the collab server, from NEXT_PUBLIC_COLLAB_URL. */
export function collabWsUrl(): string {
  return process.env.NEXT_PUBLIC_COLLAB_URL ?? "ws://localhost:1234";
}

/** The same server's HTTP origin (POST /notes). ws becomes http, wss becomes https. */
export function collabHttpUrl(): string {
  return collabWsUrl().replace(/^ws(s?):/, "http$1:");
}

export interface CreateNoteRequest {
  id: string;
  spaceId: string;
  start?: StartBlock;
  title?: string;
  text?: string;
  items?: string[];
  media?: StartMedia;
  /** base64 Yjs update: the document the device already built (offline-first creates) */
  state?: string;
}

export class CreateNoteError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Creates a note on the collab server. Idempotent on `id`, so a retry never duplicates. */
export async function createNoteRemote(
  accessToken: string,
  request: CreateNoteRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(`${collabHttpUrl()}/notes`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new CreateNoteError(res.status, `could not create note (${res.status})`);
}

export class ChecklistError extends Error {
  constructor(
    readonly status: number,
    /** `stale` means the card was out of date: refetch rather than retry */
    readonly code: string,
  ) {
    super(`could not toggle checklist item (${status} ${code})`);
  }
}

/** Ticks or unticks one checklist item on a note through the collab server. */
export async function toggleChecklistRemote(
  accessToken: string,
  noteId: string,
  change: { index: number; checked: boolean; text?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ done: number; total: number }> {
  const res = await fetchImpl(`${collabHttpUrl()}/notes/${noteId}/checklist`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(change),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ChecklistError(res.status, body.error ?? "error");
  }
  return (await res.json()) as { done: number; total: number };
}

/** Titles an untitled note through the collab server. Resolves to false when it already had one. */
export async function setTitleRemote(
  accessToken: string,
  noteId: string,
  title: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const res = await fetchImpl(`${collabHttpUrl()}/notes/${noteId}/title`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`could not set title (${res.status})`);
  return ((await res.json()) as { applied: boolean }).applied;
}
