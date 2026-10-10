"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";

/**
 * Registers the service worker (phase 6.2) for every page. It is switched off in development,
 * where a worker caching pages gets in the way of hot reload.
 *
 * reloadOnOnline is off on purpose: a forced reload when the network returns would throw away
 * what the user is typing while the outbox is still replaying.
 */
export function ServiceWorker({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV !== "production"}
      cacheOnNavigation
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  );
}
