"use client";

import { useEffect, useState } from "react";
import { offlineDb } from "@/lib/offline/idb";
import { getOutbox, getPendingBlobByPath } from "@/lib/offline/runtime";
import { useSignedUrl } from "./signedUrl";

/**
 * The URL to show for a stored object. While the bytes still wait in the outbox this is a local
 * object URL, so a picture or recording made offline renders at once; after the upload completes
 * it is the signed storage URL.
 */
export function useMediaUrl(path: string | null | undefined): string | null {
  const signed = useSignedUrl(path);
  const [local, setLocal] = useState<{ path: string; url: string } | null>(null);
  const [tick, setTick] = useState(0);

  // re-check whenever the outbox changes: an upload finishing clears the pending blob
  useEffect(() => {
    if (!offlineDb.available) return;
    return getOutbox().subscribe(() => setTick((n) => n + 1));
  }, []);

  useEffect(() => {
    if (!path || !offlineDb.available) return;
    let cancelled = false;
    let created: string | null = null;
    void getPendingBlobByPath(path)
      .then((pending) => {
        if (cancelled) return;
        if (!pending) {
          setLocal(null);
          return;
        }
        created = URL.createObjectURL(pending.blob);
        setLocal({ path, url: created });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [path, tick]);

  if (path && local?.path === path) return local.url;
  return signed;
}
