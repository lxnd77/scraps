import { describe, expect, it } from "vitest";
import { STALE_AFTER_MS, deriveSync, type SyncInputs } from "./syncStatus";

const base: SyncInputs = {
  online: true,
  pending: 0,
  running: false,
  attempts: 0,
  refused: 0,
  oldestAt: null,
  unsyncedDocs: 0,
  socketDownSince: null,
  now: 1_000_000,
};
const derive = (over: Partial<SyncInputs>) => deriveSync({ ...base, ...over });

describe("deriveSync", () => {
  it("is saved when nothing is waiting", () => {
    expect(derive({})).toMatchObject({ kind: "saved", stale: false });
  });

  it("is syncing while ops, a run or unsynced document updates exist", () => {
    expect(derive({ pending: 2 }).kind).toBe("syncing");
    expect(derive({ running: true }).kind).toBe("syncing");
    expect(derive({ unsyncedDocs: 3 }).kind).toBe("syncing");
  });

  it("is offline when the browser says so, or a socket has been down more than 3 s", () => {
    expect(derive({ online: false, pending: 1 }).kind).toBe("offline");
    expect(derive({ socketDownSince: base.now - 2000 }).kind).toBe("saved");
    expect(derive({ socketDownSince: base.now - 4000 }).kind).toBe("offline");
  });

  it("is an error after three failed attempts or a refusal, but a dead network is only offline", () => {
    expect(derive({ attempts: 2, pending: 1 }).kind).toBe("syncing");
    expect(derive({ attempts: 3, pending: 1 }).kind).toBe("error");
    expect(derive({ refused: 1 }).kind).toBe("error");
    expect(derive({ attempts: 5, pending: 1, online: false }).kind).toBe("offline");
    expect(derive({ refused: 1, online: false }).kind).toBe("error");
  });

  it("flags work older than 24 hours", () => {
    expect(derive({ pending: 1, oldestAt: base.now - STALE_AFTER_MS - 1 }).stale).toBe(true);
    expect(derive({ pending: 1, oldestAt: base.now - 1000 }).stale).toBe(false);
  });
});
