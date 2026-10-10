import type { Accent } from "@scraps/ui";

const COLORS: readonly Accent[] = ["pink", "lime", "blue", "lilac", "orange", "yellow"];

/** A person's accent, stable across sessions and devices: derived from their id. */
export function avatarColorFor(userId: string): Accent {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return COLORS[(hash >>> 0) % COLORS.length]!;
}

export interface AwarenessUser {
  userId: string;
  name: string;
  sticker?: string;
  color: Accent;
}

interface AwarenessLike {
  clientID: number;
  getStates(): Map<number, Record<string, unknown>>;
}

/**
 * The people currently in a note, one entry per user (a person with two tabs counts once),
 * yourself first. Reads the `user` field the editor publishes to awareness.
 */
export function peopleFromAwareness(awareness: AwarenessLike, selfId: string): AwarenessUser[] {
  const seen = new Map<string, AwarenessUser>();
  for (const [, state] of awareness.getStates()) {
    const user = state.user as
      { userId?: unknown; name?: unknown; sticker?: unknown; color?: unknown } | undefined;
    if (!user || typeof user.userId !== "string" || seen.has(user.userId)) continue;
    seen.set(user.userId, {
      userId: user.userId,
      name: typeof user.name === "string" && user.name ? user.name : "someone",
      sticker: typeof user.sticker === "string" ? user.sticker : undefined,
      color: avatarColorFor(user.userId),
    });
  }
  const all = [...seen.values()];
  return [...all.filter((p) => p.userId === selfId), ...all.filter((p) => p.userId !== selfId)];
}
