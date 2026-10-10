import { describe, expect, it, vi } from "vitest";
import type { NoteTag } from "@scraps/db";
import { acceptSuggestion, type AcceptDeps, type AiSuggestion } from "./suggestions";

const NOTE = "n1";
const BRAIN = "s-brain";
const QUESTS = "s-quests";

function setup(tags: NoteTag[] = [], overrides: Partial<AcceptDeps> = {}) {
  const ops: unknown[] = [];
  let n = 0;
  const deps: AcceptDeps = {
    tagsInSpace: vi.fn(async () => tags),
    queue: vi.fn(async (op) => {
      ops.push(op);
    }) as unknown as AcceptDeps["queue"],
    setTitle: vi.fn(async () => undefined),
    mark: vi.fn(async () => undefined),
    newId: () => `new-${(n += 1)}`,
    now: () => "2026-10-11T00:00:00.000Z",
    ...overrides,
  };
  return { deps, ops };
}

const suggestion = (patch: Partial<AiSuggestion> = {}): AiSuggestion => ({
  id: "sug1",
  noteId: NOTE,
  spaceId: QUESTS,
  tags: ["travel"],
  title: null,
  confidence: 0.9,
  ...patch,
});

describe("acceptSuggestion", () => {
  it("moves the scrap first, then links tags in the target space, then marks accepted", async () => {
    const { deps, ops } = setup();
    const result = await acceptSuggestion(suggestion(), BRAIN, deps);
    expect(result).toEqual({ spaceId: QUESTS, moved: true });
    expect(ops).toEqual([
      {
        type: "patchNote",
        noteId: NOTE,
        fields: { space_id: QUESTS, meta_updated_at: "2026-10-11T00:00:00.000Z" },
      },
      {
        type: "tagAdd",
        noteId: NOTE,
        spaceId: QUESTS,
        tagId: "new-1",
        name: "travel",
        color: "lilac",
      },
    ]);
    expect(deps.tagsInSpace).toHaveBeenCalledWith(QUESTS);
    expect(deps.mark).toHaveBeenCalledWith("sug1", "accepted");
  });

  it("reuses an existing tag of the space, ignoring case", async () => {
    const { deps, ops } = setup([{ id: "t9", name: "Travel", color: "pink" }]);
    await acceptSuggestion(suggestion({ spaceId: null }), QUESTS, deps);
    expect(ops).toEqual([
      { type: "tagAdd", noteId: NOTE, spaceId: QUESTS, tagId: "t9", name: "Travel", color: "pink" },
    ]);
  });

  it("does not move when the suggestion has no space or names the current one", async () => {
    for (const spaceId of [null, BRAIN]) {
      const { deps, ops } = setup();
      const result = await acceptSuggestion(suggestion({ spaceId, tags: [] }), BRAIN, deps);
      expect(result.moved).toBe(false);
      expect(ops).toEqual([]);
    }
  });

  it("titles the scrap through the collab server", async () => {
    const { deps } = setup();
    await acceptSuggestion(suggestion({ title: "goa tickets", tags: [] }), BRAIN, deps);
    expect(deps.setTitle).toHaveBeenCalledWith(NOTE, "goa tickets");
  });

  it("keeps going when the title or a tag fails", async () => {
    const { deps } = setup([], {
      setTitle: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    await acceptSuggestion(suggestion({ title: "x" }), BRAIN, deps);
    expect(deps.mark).toHaveBeenCalledWith("sug1", "accepted");
  });

  it("skips tags when the space's tags cannot be read, so names cannot collide", async () => {
    const { deps, ops } = setup([], {
      tagsInSpace: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    await acceptSuggestion(suggestion({ tags: ["travel", "money"] }), BRAIN, deps);
    expect(ops).toHaveLength(1); // only the move
  });

  it("links a repeated name once", async () => {
    const { deps, ops } = setup();
    await acceptSuggestion(suggestion({ spaceId: null, tags: ["travel", "Travel"] }), BRAIN, deps);
    expect(ops).toHaveLength(1);
  });
});
