import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { OfflineDb } from "./idb";
import {
  BACKOFF_MAX_MS,
  IdbOutboxStorage,
  MemoryOutboxStorage,
  Outbox,
  PermanentError,
  TransientError,
  backoffMs,
  type OutboxOp,
} from "./outbox";

const NOTE = "0190aaaa-0000-7000-8000-000000000001";
const patch = (n: number): OutboxOp => ({ type: "patchNote", noteId: NOTE, fields: { n } });
const create: OutboxOp = {
  type: "createNote",
  noteId: NOTE,
  spaceId: "s",
  state: "AA==",
  start: "text",
};

function setup(execute: (op: OutboxOp) => Promise<void>) {
  const scheduled: Array<{ fn: () => void; ms: number }> = [];
  const outbox = new Outbox(new MemoryOutboxStorage(), execute, {
    now: () => 1_000,
    schedule: (fn, ms) => {
      scheduled.push({ fn, ms });
      return scheduled.length - 1;
    },
    cancel: () => {},
  });
  return { outbox, scheduled };
}

describe("backoffMs", () => {
  it("doubles from one second and stops at one minute", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(backoffMs)).toEqual([
      1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000,
    ]);
    expect(backoffMs(50)).toBe(BACKOFF_MAX_MS);
  });
});

describe("Outbox", () => {
  it("a flush asked for while a run is in progress waits for that run to deliver", async () => {
    const delivered: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { outbox } = setup(async (op) => {
      if (op.type === "createNote") await gate;
      delivered.push(op.type);
    });
    await outbox.enqueue(create);
    const first = outbox.flush();
    await outbox.enqueue(patch(1));
    let secondDone = false;
    const second = outbox.flush().then(() => {
      secondDone = true;
    });
    await Promise.resolve();
    expect(secondDone).toBe(false);
    release();
    await Promise.all([first, second]);
    expect(delivered).toEqual(["createNote", "patchNote"]);
    expect(secondDone).toBe(true);
  });

  it("replays in the order ops were queued, create before patches", async () => {
    const seen: string[] = [];
    const { outbox } = setup(async (op) => {
      seen.push(op.type === "patchNote" ? `patch${op.fields.n}` : op.type);
    });
    await outbox.enqueue(create);
    await outbox.enqueue(patch(1));
    await outbox.enqueue(patch(2));
    await outbox.flush();
    expect(seen).toEqual(["createNote", "patch1", "patch2"]);
    expect(outbox.snapshot().pending).toBe(0);
  });

  it("stops at a transient failure, keeps order and retries with backoff", async () => {
    let online = false;
    const seen: string[] = [];
    const { outbox, scheduled } = setup(async (op) => {
      if (!online) throw new TransientError("offline");
      seen.push(op.type === "patchNote" ? `patch${op.fields.n}` : op.type);
    });
    await outbox.enqueue(create);
    await outbox.enqueue(patch(1));

    await outbox.flush();
    expect(seen).toEqual([]);
    expect(outbox.snapshot()).toMatchObject({ pending: 2, attempts: 1 });
    expect(scheduled.at(-1)?.ms).toBe(1000);

    await outbox.flush();
    expect(scheduled.at(-1)?.ms).toBe(2000);
    expect(outbox.snapshot().attempts).toBe(2);

    online = true;
    await outbox.flush();
    expect(seen).toEqual(["createNote", "patch1"]);
    expect(outbox.snapshot()).toMatchObject({ pending: 0, attempts: 0 });
  });

  it("drops an op the server refuses and carries on with the rest", async () => {
    const seen: string[] = [];
    const { outbox } = setup(async (op) => {
      if (op.type === "patchNote" && op.fields.n === 1) throw new PermanentError("forbidden");
      seen.push(op.type === "patchNote" ? `patch${op.fields.n}` : op.type);
    });
    await outbox.enqueue(patch(1));
    await outbox.enqueue(patch(2));
    await outbox.flush();
    expect(seen).toEqual(["patch2"]);
    const snap = outbox.snapshot();
    expect(snap.pending).toBe(0);
    expect(snap.failed).toHaveLength(1);
    expect(snap.failed[0]?.message).toBe("forbidden");
  });

  it("replay after a crash runs an op again, and a safe executor ends up with one result", async () => {
    // the executor is idempotent by id, like POST /notes: a replay changes nothing
    const server = new Map<string, number>();
    const run = async (op: OutboxOp) => {
      if (op.type === "createNote") server.set(op.noteId, (server.get(op.noteId) ?? 0) || 1);
    };
    const storage = new MemoryOutboxStorage();
    const first = new Outbox(storage, run);
    await first.enqueue(create);
    // crash: the server got it but the row was never removed
    await run(create);

    const second = new Outbox(storage, run);
    await second.load();
    await second.flush();
    expect(server.get(NOTE)).toBe(1);
    expect(second.snapshot().pending).toBe(0);
  });

  it("an op queued while a run is in progress is picked up by the same run", async () => {
    const seen: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { outbox } = setup(async (op) => {
      if (op.type === "patchNote") {
        if (op.fields.n === 1) await gate;
        seen.push(op.fields.n as number);
      }
    });
    await outbox.enqueue(patch(1));
    const running = outbox.flush();
    await outbox.enqueue(patch(2));
    void outbox.flush();
    release();
    await running;
    expect(seen).toEqual([1, 2]);
  });

  it("notifies subscribers as the queue changes", async () => {
    const { outbox } = setup(async () => {});
    const listener = vi.fn();
    outbox.subscribe(listener);
    await outbox.enqueue(patch(1));
    await outbox.flush();
    expect(listener).toHaveBeenCalled();
    expect(outbox.snapshot().pending).toBe(0);
  });

  it("reports the age of the oldest queued op", async () => {
    const { outbox } = setup(async () => {
      throw new TransientError("offline");
    });
    expect(outbox.snapshot().oldestAt).toBeNull();
    await outbox.enqueue(patch(1));
    expect(outbox.snapshot().oldestAt).toBe(1_000);
  });
});

describe("IdbOutboxStorage", () => {
  it("keeps ops across a new session, in order", async () => {
    const db = new OfflineDb(indexedDB, `test-${Math.random()}`);
    const storage = new IdbOutboxStorage(db);
    const a = new Outbox(storage, async () => {
      throw new TransientError("offline");
    });
    await a.enqueue(create);
    await a.enqueue(patch(1));

    const seen: string[] = [];
    const b = new Outbox(storage, async (op) => {
      seen.push(op.type);
    });
    await b.load();
    expect(b.snapshot().pending).toBe(2);
    await b.flush();
    expect(seen).toEqual(["createNote", "patchNote"]);
    expect(await storage.all()).toEqual([]);
  });
});

describe("Outbox last error", () => {
  it("remembers why a send keeps failing, and forgets it once a send gets through", async () => {
    let up = false;
    const { outbox } = setup(async () => {
      if (!up) throw new TransientError("Failed to fetch");
    });
    await outbox.enqueue(patch(1));
    await outbox.flush();
    expect(outbox.snapshot()).toMatchObject({
      pending: 1,
      attempts: 1,
      lastError: "Failed to fetch",
    });

    up = true;
    await outbox.flush();
    expect(outbox.snapshot()).toMatchObject({ pending: 0, attempts: 0, lastError: null });
  });
});
