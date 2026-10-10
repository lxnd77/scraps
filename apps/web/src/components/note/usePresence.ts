"use client";

import { useEffect, useState } from "react";
import { peopleFromAwareness, type AwarenessUser } from "@/lib/presence";

interface ProviderLike {
  awareness: {
    clientID: number;
    getStates(): Map<number, Record<string, unknown>>;
    on(event: "change", listener: () => void): void;
    off(event: "change", listener: () => void): void;
  } | null;
}

/** Everyone in the note right now (one per person), yourself first, kept live. */
export function usePresence(provider: ProviderLike | null, selfId: string): AwarenessUser[] {
  const [people, setPeople] = useState<AwarenessUser[]>([]);

  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness) return;
    const update = () => setPeople(peopleFromAwareness(awareness, selfId));
    update();
    awareness.on("change", update);
    return () => awareness.off("change", update);
  }, [provider, selfId]);

  return people;
}
