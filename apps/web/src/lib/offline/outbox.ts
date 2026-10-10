import type { OfflineDb } from "./idb";

/** A write waiting to reach the server. Every op is safe to replay (see each executor). */
export type OutboxOp =
  | {
      type: "createNote";
      noteId: string;
      spaceId: string;
      /** base64 Yjs update, the document the device already holds */
      state: string;
      start: string;
    }
  | {
      type: "patchNote";
      noteId: string;
      /** column values, including `meta_updated_at` stamped when the user acted */
      fields: Record<string, unknown>;
    }
  | { type: "tagAdd"; noteId: string; spaceId: string; tagId: string; name: string; color: string }
  | { type: "tagRemove"; noteId: string; tagId: string }
  | { type: "toggleChecklist"; noteId: string; index: number; checked: boolean; text?: string }
  | {
      type: "upload";
      assetId: string;
      noteId: string;
      spaceId: string;
      path: string;
      mime: string;
      kind: "image" | "audio";
      /** extra asset columns: width, height, dominant_color, duration_ms, waveform */
      asset: Record<string, unknown>;
    };

export interface StoredOp {
  seq: number;
  op: OutboxOp;
  createdAt: number;
  attempts: number;
}

/** The network is down or the server had a bad moment: try again later. */
export class TransientError extends Error {
  readonly transient = true;
}

/** The server understood and refused (permission, validation). Retrying cannot help. */
export class PermanentError extends Error {
  readonly transient = false;
}

export type Executor = (op: OutboxOp) => Promise<void>;

export interface OutboxStorage {
  add(entry: Omit<StoredOp, "seq">): Promise<number>;
  all(): Promise<StoredOp[]>;
  update(entry: StoredOp): Promise<void>;
  remove(seq: number): Promise<void>;
}

export interface OutboxSnapshot {
  pending: number;
  /** ops dropped after a permanent refusal in this session, newest last */
  failed: Array<{ op: OutboxOp; message: string }>;
  /** consecutive transient failures of the head op */
  attempts: number;
  /** createdAt of the oldest queued op, or null */
  oldestAt: number | null;
  running: boolean;
}

export const BACKOFF_START_MS = 1000;
export const BACKOFF_MAX_MS = 60_000;

/** 1 s, 2 s, 4 s ... capped at 60 s. */
export function backoffMs(attempt: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_START_MS * 2 ** Math.max(0, attempt - 1));
}

export interface OutboxOptions {
  now?: () => number;
  /** schedules the next flush; replaced in tests */
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}

/**
 * The outbox: a durable, ordered queue with a single-flight replay loop.
 *  - ops run strictly in the order they were queued (a patch must not overtake its create)
 *  - a transient failure stops the loop and retries the same op after an exponential backoff
 *  - a permanent failure drops that op and carries on
 *  - an op is removed only after its executor resolved, so a crash replays it (executors are
 *    idempotent)
 */
export class Outbox {
  private listeners = new Set<() => void>();
  private failed: OutboxSnapshot["failed"] = [];
  private attempts = 0;
  private running = false;
  private again = false;
  private timer: unknown = null;
  private cache: StoredOp[] = [];
  private readonly now: () => number;
  private readonly schedule: NonNullable<OutboxOptions["schedule"]>;
  private readonly cancel: NonNullable<OutboxOptions["cancel"]>;

  constructor(
    private readonly storage: OutboxStorage,
    private readonly execute: Executor,
    options: OutboxOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.cancel = options.cancel ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /** Loads what a previous session left behind. Call once at start. */
  async load(): Promise<void> {
    this.cache = (await this.storage.all()).sort((a, b) => a.seq - b.seq);
    this.emit();
  }

  async enqueue(op: OutboxOp): Promise<number> {
    const entry = { op, createdAt: this.now(), attempts: 0 };
    const seq = await this.storage.add(entry);
    this.cache.push({ ...entry, seq });
    this.emit();
    return seq;
  }

  snapshot(): OutboxSnapshot {
    return {
      pending: this.cache.length,
      failed: [...this.failed],
      attempts: this.attempts,
      oldestAt: this.cache[0]?.createdAt ?? null,
      running: this.running,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Ops of a given note still waiting, for "is this note's create queued" style checks. */
  has(predicate: (op: OutboxOp) => boolean): boolean {
    return this.cache.some((entry) => predicate(entry.op));
  }

  /** Runs the queue now (cancels a pending backoff). Safe to call from anywhere, any time. */
  async flush(): Promise<void> {
    if (this.timer !== null) {
      this.cancel(this.timer);
      this.timer = null;
    }
    if (this.running) {
      // something was queued while a run was in progress: go round once more when it ends
      this.again = true;
      return;
    }
    this.running = true;
    this.emit();
    try {
      do {
        this.again = false;
        await this.drain();
      } while (this.again);
    } finally {
      this.running = false;
      this.emit();
    }
  }

  private async drain(): Promise<void> {
    while (this.cache.length > 0) {
      const head = this.cache[0]!;
      try {
        await this.execute(head.op);
      } catch (error) {
        if (error instanceof PermanentError) {
          this.failed.push({ op: head.op, message: error.message });
          await this.storage.remove(head.seq);
          this.cache.shift();
          this.attempts = 0;
          this.emit();
          continue;
        }
        // transient, or anything unexpected: keep the op and back off
        head.attempts += 1;
        this.attempts = head.attempts;
        await this.storage.update(head);
        this.timer = this.schedule(() => {
          this.timer = null;
          void this.flush();
        }, backoffMs(head.attempts));
        this.emit();
        return;
      }
      await this.storage.remove(head.seq);
      this.cache.shift();
      this.attempts = 0;
      this.emit();
    }
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

/** In-memory storage for tests and for environments without IndexedDB. */
export class MemoryOutboxStorage implements OutboxStorage {
  private rows = new Map<number, StoredOp>();
  private next = 1;

  async add(entry: Omit<StoredOp, "seq">): Promise<number> {
    const seq = this.next++;
    this.rows.set(seq, { ...entry, seq });
    return seq;
  }
  async all(): Promise<StoredOp[]> {
    return [...this.rows.values()].sort((a, b) => a.seq - b.seq);
  }
  async update(entry: StoredOp): Promise<void> {
    this.rows.set(entry.seq, { ...entry });
  }
  async remove(seq: number): Promise<void> {
    this.rows.delete(seq);
  }
}

/** Outbox rows in the app's IndexedDB. */
export class IdbOutboxStorage implements OutboxStorage {
  constructor(private readonly db: OfflineDb) {}

  async add(entry: Omit<StoredOp, "seq">): Promise<number> {
    return (await this.db.put("outbox", entry)) as number;
  }
  async all(): Promise<StoredOp[]> {
    return this.db.getAll<StoredOp>("outbox");
  }
  async update(entry: StoredOp): Promise<void> {
    await this.db.put("outbox", entry);
  }
  async remove(seq: number): Promise<void> {
    await this.db.delete("outbox", seq);
  }
}
