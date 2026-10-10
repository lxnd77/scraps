"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { OptimisticNotes } from "./OptimisticNotes";

/** One query client for the app shell. Phase 6 persists it to IndexedDB. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <OptimisticNotes />
      {children}
    </QueryClientProvider>
  );
}
