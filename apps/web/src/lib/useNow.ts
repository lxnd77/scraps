"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(callback: () => void) {
  listeners.add(callback);
  timer ??= setInterval(() => listeners.forEach((l) => l()), 30_000);
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Minute-resolution timestamp, so the snapshot is stable between ticks. */
function snapshot(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

/**
 * The current time as a Date, or null on the server and during hydration.
 * Rendering "unknown" first avoids a hydration mismatch from the server's clock and timezone.
 */
export function useNow(): Date | null {
  const ms = useSyncExternalStore(subscribe, snapshot, () => 0);
  return ms === 0 ? null : new Date(ms);
}
