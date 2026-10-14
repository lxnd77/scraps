import type { NotePreview } from "@scraps/editor";

export type WritePreview = (
  noteId: string,
  preview: NotePreview,
  editedBy: string | null,
) => Promise<void>;

interface Entry {
  /** the preview last written, as JSON; null when unknown (never written, or the write failed) */
  lastKey: string | null;
  lastAt: number;
  pending: { preview: NotePreview; key: string; editedBy: string | null } | null;
  timer: ReturnType<typeof setTimeout> | null;
  /** the write in flight, so a flush waits for it */
  writing: Promise<void> | null;
  /** failed writes in a row */
  failures: number;
}

/** A failed write is retried this many times, at least this far apart. */
const MAX_RETRIES = 3;
const RETRY_MIN_MS = 5000;

/**
 * Writes a note's card fields (the `notes` row: one realtime event and one board refetch for
 * everyone looking at that space) only when they change, and at most once per `intervalMs`.
 * The document itself is stored separately on every debounced store; this only throttles the card.
 *
 * A change inside the interval waits and is written when the interval is up, as the latest one.
 * `flush` writes a waiting change now (a note unloads); `flushAll` does every note (shutdown).
 * A failed write is retried a few times; the document is safe either way, only the card lags.
 */
export class PreviewScheduler {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly write: WritePreview,
    private readonly intervalMs: number,
    private readonly onError: (noteId: string) => void = () => {},
    private readonly now: () => number = Date.now,
  ) {}

  offer(noteId: string, preview: NotePreview, editedBy: string | null): Promise<void> {
    const entry = this.entry(noteId);
    const key = JSON.stringify(preview);
    if (key === entry.lastKey && !entry.pending) return Promise.resolve();
    entry.pending = { preview, key, editedBy };
    const wait = entry.lastAt + this.intervalMs - this.now();
    if (wait <= 0) return this.run(noteId, entry);
    entry.timer ??= setTimeout(() => {
      entry.timer = null;
      void this.run(noteId, entry);
    }, wait);
    return Promise.resolve();
  }

  /** Writes a waiting change now and forgets the note (it unloaded). */
  async flush(noteId: string): Promise<void> {
    const entry = this.entries.get(noteId);
    if (!entry) return;
    await this.run(noteId, entry);
    // a store racing the unload may have queued another change: keep the entry until it is out
    if (!entry.pending && !entry.timer) this.entries.delete(noteId);
  }

  async flushAll(): Promise<void> {
    await Promise.all([...this.entries.keys()].map((id) => this.flush(id)));
  }

  /** Notes with a change still waiting to be written (for tests and health). */
  get waiting(): number {
    let n = 0;
    for (const entry of this.entries.values()) if (entry.pending) n += 1;
    return n;
  }

  private entry(noteId: string): Entry {
    let entry = this.entries.get(noteId);
    if (!entry) {
      entry = {
        lastKey: null,
        lastAt: -Infinity,
        pending: null,
        timer: null,
        writing: null,
        failures: 0,
      };
      this.entries.set(noteId, entry);
    }
    return entry;
  }

  private async run(noteId: string, entry: Entry): Promise<void> {
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    // one write at a time per note; a change that arrives meanwhile goes out right after
    while (entry.writing) await entry.writing;
    const job = entry.pending;
    if (!job) return;
    entry.pending = null;
    entry.lastAt = this.now();
    entry.writing = this.write(noteId, job.preview, job.editedBy)
      .then(() => {
        entry.lastKey = job.key;
        entry.failures = 0;
      })
      .catch(() => {
        entry.lastKey = null;
        entry.failures += 1;
        this.onError(noteId);
        // try again later unless a newer change is already waiting to go
        if (entry.failures > MAX_RETRIES) return;
        entry.pending ??= job;
        entry.timer ??= setTimeout(
          () => {
            entry.timer = null;
            void this.run(noteId, entry);
          },
          Math.max(this.intervalMs, RETRY_MIN_MS),
        );
      })
      .finally(() => {
        entry.writing = null;
      });
    await entry.writing;
  }
}
