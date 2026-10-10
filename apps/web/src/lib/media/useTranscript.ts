"use client";

import type { TranscriptState } from "@scraps/editor/react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NONE: TranscriptState = { status: "none", text: null };
const POLL_MS = 5000;
const POLL_LIMIT = 60; // five minutes, then the row is assumed to be an old memo with no transcript

function fromRow(row: { transcript?: unknown; transcript_status?: unknown } | null): TranscriptState {
  if (!row) return NONE;
  const status = row.transcript_status;
  if (status !== "pending" && status !== "done" && status !== "failed") return NONE;
  return { status, text: typeof row.transcript === "string" ? row.transcript : null };
}

/**
 * The transcript of one voice memo, kept live: read once, pushed by Realtime on the asset row
 * (SPEC 9.4), and polled while it is still on its way in case the push or the row itself is late
 * (a memo recorded offline reaches the server after a while).
 */
export function useTranscript(assetId: string | null | undefined): TranscriptState {
  const [state, setState] = useState<{ assetId: string | null; value: TranscriptState }>({
    assetId: null,
    value: NONE,
  });

  useEffect(() => {
    if (!assetId) return;
    const supabase = createClient();
    let cancelled = false;
    let polls = 0;
    let timer: number | undefined;

    const apply = (value: TranscriptState) => {
      if (!cancelled) setState({ assetId, value });
      return value;
    };

    const load = async () => {
      try {
        const { data } = await supabase
          .from("assets")
          .select("transcript, transcript_status")
          .eq("id", assetId)
          .maybeSingle();
        const value = apply(fromRow(data));
        if (value.status === "done" || value.status === "failed") return;
      } catch {
        // offline: the next poll tries again
      }
      polls += 1;
      if (!cancelled && polls < POLL_LIMIT) timer = window.setTimeout(() => void load(), POLL_MS);
    };
    void load();

    const channel = supabase
      .channel(`asset-${assetId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "assets", filter: `id=eq.${assetId}` },
        (payload) => apply(fromRow(payload.new as Record<string, unknown>)),
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [assetId]);

  return state.assetId === assetId ? state.value : NONE;
}

/** Asks the server to transcribe a memo again (the retry button on a failed one). */
export async function retryTranscript(assetId: string): Promise<void> {
  await createClient().functions.invoke("transcribe-audio", { body: { assetId } });
}
