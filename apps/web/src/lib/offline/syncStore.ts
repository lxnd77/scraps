"use client";

import { useSyncExternalStore } from "react";
import { deriveSync, type SyncStatus } from "./syncStatus";
import { getOutbox } from "./runtime";

/**
 * The app-wide sync signal. Inputs: the outbox, the browser's online flag, and the open note's
 * socket and unsynced counter (reported by useNoteSession). One derived status feeds every chip.
 */
interface Signals {
  socketDownSince: number | null;
  unsyncedDocs: number;
}

const signals: Signals = { socketDownSince: null, unsyncedDocs: 0 };
const listeners = new Set<() => void>();
let cached: SyncStatus = { kind: "saved", stale: false, pending: 0 };
let started = false;
let tickTimer: number | undefined;

function compute(): SyncStatus {
  const outbox = getOutbox().snapshot();
  const next = deriveSync({
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    pending: outbox.pending,
    running: outbox.running,
    attempts: outbox.attempts,
    refused: outbox.failed.length,
    oldestAt: outbox.oldestAt,
    unsyncedDocs: signals.unsyncedDocs,
    socketDownSince: signals.socketDownSince,
    now: Date.now(),
  });
  // keep the same object when nothing changed so React does not re-render
  if (next.kind === cached.kind && next.stale === cached.stale && next.pending === cached.pending) {
    return cached;
  }
  return next;
}

function emit() {
  const next = compute();
  if (next !== cached) {
    cached = next;
    for (const listener of listeners) listener();
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  getOutbox().subscribe(emit);
  window.addEventListener("online", emit);
  window.addEventListener("offline", emit);
  // the socket-down grace period and the 24 hour mark pass with no event, so re-check
  tickTimer = window.setInterval(emit, 1000);
  emit();
}

/** Called by a note session whenever its socket or unsynced counter changes. */
export function reportNoteSession(state: { connected: boolean; unsynced: number }): void {
  signals.unsyncedDocs = state.unsynced;
  signals.socketDownSince = state.connected ? null : (signals.socketDownSince ?? Date.now());
  emit();
}

/** A note page closed: it no longer says anything about the connection. */
export function clearNoteSession(): void {
  signals.unsyncedDocs = 0;
  signals.socketDownSince = null;
  emit();
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => {
      start();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && tickTimer !== undefined) {
          window.clearInterval(tickTimer);
          tickTimer = undefined;
          started = false;
        }
      };
    },
    () => cached,
    () => cached,
  );
}
