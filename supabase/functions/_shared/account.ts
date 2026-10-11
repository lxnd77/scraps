// Planning for account deletion (SPEC 9.9). Pure: no Deno or Node APIs, so the unit tests import
// it through packages/db. The delete-account Edge Function gathers the facts, asks this what to do,
// and only then touches anything.

export interface OwnedSpace {
  spaceId: string;
  /** the other people in the space */
  others: Array<{ userId: string; role: "owner" | "editor" | "viewer" }>;
}

export type Decision = { transfer: string } | { delete: true };

export type PlannedAction =
  | { kind: "transfer"; spaceId: string; to: string }
  | { kind: "delete"; spaceId: string };

export type Plan =
  | { ok: true; actions: PlannedAction[] }
  | { ok: false; missing: string[]; invalid: string[] };

/** Reads `{ [spaceId]: { transfer: userId } | { delete: true } }`; anything else is dropped. */
export function parseDecisions(raw: unknown): Record<string, Decision> {
  const out: Record<string, Decision> = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  for (const [spaceId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const v = value as Record<string, unknown>;
    if (v.delete === true) out[spaceId] = { delete: true };
    else if (typeof v.transfer === "string") out[spaceId] = { transfer: v.transfer };
  }
  return out;
}

/**
 * Every owned space with nobody else in it is deleted. A shared one needs a decision: transfer to
 * an editor (or co-owner) or delete. A missing or invalid decision stops everything, so nothing is
 * deleted on a half-answered request.
 */
export function planAccountDeletion(
  owned: readonly OwnedSpace[],
  decisions: Record<string, Decision>,
): Plan {
  const actions: PlannedAction[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const space of owned) {
    if (space.others.length === 0) {
      actions.push({ kind: "delete", spaceId: space.spaceId });
      continue;
    }
    const decision = decisions[space.spaceId];
    if (!decision) {
      missing.push(space.spaceId);
    } else if ("delete" in decision) {
      actions.push({ kind: "delete", spaceId: space.spaceId });
    } else {
      const target = space.others.find((o) => o.userId === decision.transfer);
      if (target && (target.role === "editor" || target.role === "owner")) {
        actions.push({ kind: "transfer", spaceId: space.spaceId, to: target.userId });
      } else {
        invalid.push(space.spaceId);
      }
    }
  }

  if (missing.length > 0 || invalid.length > 0) return { ok: false, missing, invalid };
  return { ok: true, actions };
}
