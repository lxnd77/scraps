import { describe, expect, it } from "vitest";
import {
  SLOW_AFTER_MS,
  SOCKET_DOWN_GRACE_MS,
  STALE_AFTER_MS,
  deriveSync,
  noteSyncKind,
  type SyncInputs,
} from "./syncStatus";

const base: SyncInputs = {
  online: true,
  pending: 0,
  running: false,
  attempts: 0,
  refused: 0,
  oldestAt: null,
  unsyncedDocs: 0,
  socketDownSince: null,
  syncingSince: null,
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

  it("is slow once something has waited more than 10 s to sync", () => {
    const since = base.now - SLOW_AFTER_MS;
    expect(derive({ pending: 1, syncingSince: since }).kind).toBe("syncing");
    expect(derive({ pending: 1, syncingSince: since - 1 }).kind).toBe("slow");
    // a dead network is offline, not slow
    expect(derive({ online: false, pending: 1, syncingSince: since - 1 }).kind).toBe("offline");
    // nothing waiting: saved, whatever the stale timestamp says
    expect(derive({ syncingSince: since - 1 }).kind).toBe("saved");
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

describe("noteSyncKind", () => {
  it("says a note that is still connecting is syncing, not offline or saved", () => {
    expect(noteSyncKind(false, "saved")).toBe("syncing");
    expect(noteSyncKind(true, "saved")).toBe("saved");
  });

  it("leaves offline to the app-wide grace period, and errors as they are", () => {
    // the socket only just went down: still connecting
    const justDown = derive({ socketDownSince: base.now - 1000 });
    expect(noteSyncKind(false, justDown.kind)).toBe("syncing");
    // down past the grace period: the app-wide status says offline, and so does the note
    const longDown = derive({ socketDownSince: base.now - SOCKET_DOWN_GRACE_MS - 1 });
    expect(noteSyncKind(false, longDown.kind)).toBe("offline");
    expect(noteSyncKind(false, "error")).toBe("error");
    expect(noteSyncKind(true, "syncing")).toBe("syncing");
  });
});
