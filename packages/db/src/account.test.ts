import { describe, expect, it } from "vitest";
import { parseDecisions, planAccountDeletion, type OwnedSpace } from "./functions";

const SOLO: OwnedSpace = { spaceId: "solo", others: [] };
const SHARED: OwnedSpace = {
  spaceId: "shared",
  others: [
    { userId: "ed", role: "editor" },
    { userId: "vw", role: "viewer" },
  ],
};

describe("planAccountDeletion", () => {
  it("deletes solo spaces without asking", () => {
    expect(planAccountDeletion([SOLO], {})).toEqual({
      ok: true,
      actions: [{ kind: "delete", spaceId: "solo" }],
    });
  });

  it("stops when a shared space has no decision", () => {
    expect(planAccountDeletion([SOLO, SHARED], {})).toEqual({
      ok: false,
      missing: ["shared"],
      invalid: [],
    });
  });

  it("transfers to an editor and deletes on request", () => {
    expect(planAccountDeletion([SHARED], { shared: { transfer: "ed" } })).toEqual({
      ok: true,
      actions: [{ kind: "transfer", spaceId: "shared", to: "ed" }],
    });
    expect(planAccountDeletion([SHARED], { shared: { delete: true } })).toEqual({
      ok: true,
      actions: [{ kind: "delete", spaceId: "shared" }],
    });
  });

  it("refuses a transfer to a viewer, a stranger or nobody", () => {
    for (const to of ["vw", "stranger", ""]) {
      expect(planAccountDeletion([SHARED], { shared: { transfer: to } })).toEqual({
        ok: false,
        missing: [],
        invalid: ["shared"],
      });
    }
  });

  it("ignores decisions for spaces that are not owned", () => {
    expect(planAccountDeletion([SOLO], { other: { delete: true } })).toEqual({
      ok: true,
      actions: [{ kind: "delete", spaceId: "solo" }],
    });
  });
});

describe("parseDecisions", () => {
  it("keeps valid entries and drops the rest", () => {
    expect(
      parseDecisions({
        a: { transfer: "u1" },
        b: { delete: true },
        c: { delete: false },
        d: "delete",
        e: null,
        f: { transfer: 4 },
      }),
    ).toEqual({ a: { transfer: "u1" }, b: { delete: true } });
    expect(parseDecisions(null)).toEqual({});
    expect(parseDecisions([])).toEqual({});
  });
});
