// Pure helpers for the trash purge and "delete forever" (SPEC 6.10). No Deno or Node APIs, so the
// unit tests import it through packages/db like the other shared helpers.

export const TRASH_DAYS = 30;
/** notes removed per purge run, so one call stays well inside the function time limit */
export const PURGE_BATCH = 200;
export const STORAGE_REMOVE_CHUNK = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

/** Notes deleted before this moment are due for removal. */
export function purgeCutoff(now: Date): string {
  return new Date(now.getTime() - TRASH_DAYS * 24 * 3600_000).toISOString();
}

export type TrashRequest =
  | { kind: "notes"; noteIds: string[] }
  | { kind: "empty"; spaceId: string }
  | { kind: "purge" };

/** `{ noteIds }` (up to 100), `{ emptySpaceId }` or the scheduler's `{ purge: true }`; else null. */
export function parseTrashRequest(body: unknown): TrashRequest | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const v = body as Record<string, unknown>;
  if (v.purge === true) return { kind: "purge" };
  if (isUuid(v.emptySpaceId)) return { kind: "empty", spaceId: v.emptySpaceId };
  if (Array.isArray(v.noteIds) && v.noteIds.length > 0 && v.noteIds.length <= 100) {
    if (v.noteIds.every(isUuid)) return { kind: "notes", noteIds: [...new Set(v.noteIds)] };
  }
  return null;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
