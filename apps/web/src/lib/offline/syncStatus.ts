/** What the sync chip can say (SPEC 10). */
export type SyncKind = "saved" | "syncing" | "slow" | "offline" | "error";

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
export const SOCKET_DOWN_GRACE_MS = 3000;
export const ERROR_AFTER_ATTEMPTS = 3;
/** Syncing this long is worth a word: "still saving…". */
export const SLOW_AFTER_MS = 10_000;

export interface SyncInputs {
  /** navigator.onLine */
  online: boolean;
  /** pending outbox ops */
  pending: number;
  /** the outbox loop is executing right now */
  running: boolean;
  /** consecutive transient failures of the head op */
  attempts: number;
  /** ops the server refused in this session */
  refused: number;
  /** createdAt of the oldest queued op */
  oldestAt: number | null;
  /** unsynced document updates across open notes */
  unsyncedDocs: number;
  /** since when a note's socket has been down, or null when connected or no note is open */
  socketDownSince: number | null;
  /** since when something has been waiting to sync, or null when nothing is */
  syncingSince: number | null;
  now: number;
}

export interface SyncStatus {
  kind: SyncKind;
  /** work older than 24 hours is still waiting: the browser may evict it before it syncs */
  stale: boolean;
  pending: number;
}

/**
 * One answer from the many signals:
 *   offline  the browser says so, or a note's socket has been down for more than 3 s
 *   error    the head op failed 3 times, or the server refused something
 *   syncing  anything is queued, running or unacknowledged
 *   slow     syncing for more than 10 s
 *   saved    nothing is waiting
 */
export function deriveSync(input: SyncInputs): SyncStatus {
  const socketDown =
    input.socketDownSince !== null && input.now - input.socketDownSince > SOCKET_DOWN_GRACE_MS;
  const offline = !input.online || socketDown;
  const stale = input.oldestAt !== null && input.now - input.oldestAt > STALE_AFTER_MS;

  let kind: SyncKind;
  if (input.refused > 0 || input.attempts >= ERROR_AFTER_ATTEMPTS) {
    // being offline explains failed attempts, so a dead network is not an error
    kind = offline && input.refused === 0 ? "offline" : "error";
  } else if (offline) kind = "offline";
  else if (input.pending > 0 || input.running || input.unsyncedDocs > 0) {
    const slow = input.syncingSince !== null && input.now - input.syncingSince > SLOW_AFTER_MS;
    kind = slow ? "slow" : "syncing";
  } else kind = "saved";

  return { kind, stale, pending: input.pending };
}

/** The chip says nothing while all is well: it shows only when something needs a word. */
export function syncChipShown(kind: SyncKind): boolean {
  return kind === "slow" || kind === "offline" || kind === "error";
}

/**
 * The chip on a note page. A note whose socket has not come up yet is not "saved" yet, but it is
 * not offline either: it is connecting. The app-wide status turns to offline by itself once the
 * socket has been down past the grace period, so this only covers the first seconds.
 */
export function noteSyncKind(connected: boolean, appKind: SyncKind): SyncKind {
  return !connected && appKind === "saved" ? "syncing" : appKind;
}
