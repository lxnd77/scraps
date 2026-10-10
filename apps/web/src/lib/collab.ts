import type { StartBlock } from "@scraps/editor";

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
