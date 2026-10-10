"use client";

import { useEffect } from "react";
import { flushOutbox } from "@/lib/offline/runtime";

/**
 * Starts the outbox when the app opens and again whenever the network comes back, and asks the
 * browser to keep this site's storage (so offline data is not evicted under pressure).
 */
export function OfflineBoot() {
  useEffect(() => {
    void flushOutbox();
    const onOnline = () => void flushOutbox();
    window.addEventListener("online", onOnline);
    void navigator.storage?.persist?.().catch(() => {});
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}
