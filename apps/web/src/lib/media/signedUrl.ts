"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TTL_SECONDS = 60 * 60;
/** Refresh when less than ten minutes remain. */
const REFRESH_MARGIN_MS = 10 * 60 * 1000;

type Fetcher = (paths: string[]) => Promise<Map<string, string>>;

/**
 * In-memory signed URL cache (SPEC 9.3). Lookups made in the same tick are batched into one
 * request. An entry is reused until it is within ten minutes of expiring.
 */
export class SignedUrlCache {
  private entries = new Map<string, { url: string; expiresAt: number }>();
  private waiting = new Map<string, Array<(url: string | null) => void>>();
  private scheduled = false;

  constructor(
    private readonly fetchUrls: Fetcher,
    private readonly now: () => number = Date.now,
  ) {}

  peek(path: string): string | null {
    const hit = this.entries.get(path);
    return hit && hit.expiresAt - this.now() > REFRESH_MARGIN_MS ? hit.url : null;
  }

  /** Milliseconds until a cached URL should be refreshed, or null when nothing is cached. */
  refreshIn(path: string): number | null {
    const hit = this.entries.get(path);
    return hit ? Math.max(0, hit.expiresAt - this.now() - REFRESH_MARGIN_MS) : null;
  }

  get(path: string): Promise<string | null> {
    const cached = this.peek(path);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve) => {
      const list = this.waiting.get(path) ?? [];
      list.push(resolve);
      this.waiting.set(path, list);
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => void this.flush());
      }
    });
  }

  private async flush() {
    this.scheduled = false;
    const batch = this.waiting;
    this.waiting = new Map();
    let urls = new Map<string, string>();
    try {
      urls = await this.fetchUrls([...batch.keys()]);
    } catch {
      // every waiter gets null below; the caller can retry
    }
    const expiresAt = this.now() + TTL_SECONDS * 1000;
    for (const [path, resolvers] of batch) {
      const url = urls.get(path) ?? null;
      if (url) this.entries.set(path, { url, expiresAt });
      for (const resolve of resolvers) resolve(url);
    }
  }

  clear() {
    this.entries.clear();
  }
}

async function fetchFromStorage(paths: string[]): Promise<Map<string, string>> {
  const { data, error } = await createClient()
    .storage.from("media")
    .createSignedUrls(paths, TTL_SECONDS);
  if (error) throw error;
  const out = new Map<string, string>();
  for (const row of data) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  return out;
}

export const signedUrls = new SignedUrlCache(fetchFromStorage);

/** A signed URL for a storage path, null while loading or when the object is not there. */
export function useSignedUrl(path: string | null | undefined): string | null {
  const [state, setState] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    let timer: number | undefined;

    const load = () => {
      void signedUrls.get(path).then((url) => {
        if (cancelled || !url) return;
        setState({ path, url });
        const wait = signedUrls.refreshIn(path);
        if (wait !== null) timer = window.setTimeout(load, wait + 1000);
      });
    };
    load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [path]);

  return path && state?.path === path ? state.url : null;
}
