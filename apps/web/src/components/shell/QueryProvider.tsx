"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState, type ReactNode } from "react";
import {
  QUERY_CACHE_MAX_AGE_MS,
  QUERY_CACHE_VERSION,
  createIdbPersister,
  shouldPersistQuery,
} from "@/lib/offline/queryPersister";
import { OfflineBoot } from "./OfflineBoot";
import { OptimisticNotes } from "./OptimisticNotes";

/**
 * One query client for the app. Board lists, counts and members are persisted to IndexedDB, so
 * the app opens with the last data it had and shows it while (or instead of) refetching.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            // must outlive the persisted max age or restored data is collected at once
            gcTime: QUERY_CACHE_MAX_AGE_MS,
            refetchOnWindowFocus: true,
            retry: 1,
            networkMode: "offlineFirst",
          },
        },
      }),
  );
  const [persister] = useState(() => createIdbPersister());

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: QUERY_CACHE_MAX_AGE_MS,
        buster: QUERY_CACHE_VERSION,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" && shouldPersistQuery(query.queryKey),
        },
      }}
    >
      <OptimisticNotes />
      <OfflineBoot />
      {children}
    </PersistQueryClientProvider>
  );
}
