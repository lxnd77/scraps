import type { NotePreview } from "@scraps/editor";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewScheduler } from "./previews.js";

const card = (title: string) => ({ title, previewText: title }) as unknown as NotePreview;

describe("PreviewScheduler", () => {
  let writes: Array<{ noteId: string; title: string; editedBy: string | null }>;
  let fail: boolean;
  let scheduler: PreviewScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    writes = [];
    fail = false;
    scheduler = new PreviewScheduler(
      async (noteId, preview, editedBy) => {
        if (fail) throw new Error("db down");
        writes.push({ noteId, title: preview.title, editedBy });
      },
      10_000,
      () => {},
      () => Date.now(),
    );
  });
  afterEach(() => vi.useRealTimers());

  it("writes the first change at once", async () => {
    await scheduler.offer("n1", card("a"), "u1");
    expect(writes).toEqual([{ noteId: "n1", title: "a", editedBy: "u1" }]);
  });

  it("skips a card that has not changed", async () => {
    await scheduler.offer("n1", card("a"), "u1");
    vi.advanceTimersByTime(20_000);
    await scheduler.offer("n1", card("a"), "u2");
    expect(writes).toHaveLength(1);
  });

  it("writes at most once per interval, the latest change last", async () => {
    await scheduler.offer("n1", card("a"), "u1");
    await scheduler.offer("n1", card("b"), "u1");
    await scheduler.offer("n1", card("c"), "u2");
    expect(writes.map((w) => w.title)).toEqual(["a"]);
    expect(scheduler.waiting).toBe(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(writes.map((w) => w.title)).toEqual(["a", "c"]);
    expect(writes.at(-1)?.editedBy).toBe("u2");
    expect(scheduler.waiting).toBe(0);
  });

  it("keeps notes apart", async () => {
    await scheduler.offer("n1", card("a"), "u1");
    await scheduler.offer("n2", card("a"), "u1");
    expect(writes.map((w) => w.noteId)).toEqual(["n1", "n2"]);
  });

  it("flushes a waiting change when the note unloads, and on shutdown", async () => {
    await scheduler.offer("n1", card("a"), "u1");
    await scheduler.offer("n1", card("b"), "u1");
    await scheduler.flush("n1");
    expect(writes.map((w) => w.title)).toEqual(["a", "b"]);

    await scheduler.offer("n2", card("x"), "u1");
    await scheduler.offer("n2", card("y"), "u1");
    await scheduler.flushAll();
    expect(writes.map((w) => w.title)).toEqual(["a", "b", "x", "y"]);
    // nothing fires later
    await vi.advanceTimersByTimeAsync(60_000);
    expect(writes).toHaveLength(4);
  });

  it("retries a failed write a few times, then gives up until the next change", async () => {
    fail = true;
    await scheduler.offer("n1", card("a"), "u1");
    expect(scheduler.waiting).toBe(1);
    fail = false;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(writes.map((w) => w.title)).toEqual(["a"]);

    fail = true;
    await vi.advanceTimersByTimeAsync(10_000);
    await scheduler.offer("n1", card("b"), "u1");
    for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(10_000);
    expect(scheduler.waiting).toBe(0);
    fail = false;
    // the same card as the failed one is not skipped: it was never written
    await scheduler.offer("n1", card("b"), "u1");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(writes.map((w) => w.title)).toEqual(["a", "b"]);
  });
});
