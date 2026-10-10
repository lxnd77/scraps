import { describe, expect, it } from "vitest";
import { classifyStatus, errorFor, fromThrown } from "./classify";
import { PermanentError, TransientError } from "./outbox";

describe("classifyStatus", () => {
  it("retries network failure, server errors and expired tokens", () => {
    for (const s of [undefined, 0, 401, 408, 429, 500, 502, 503]) {
      expect(classifyStatus(s)).toBe("transient");
    }
  });

  it("gives up on refusals the server meant", () => {
    for (const s of [400, 403, 404, 409, 413, 422]) expect(classifyStatus(s)).toBe("permanent");
  });
});

describe("error constructors", () => {
  it("maps statuses to the outbox error classes", () => {
    expect(errorFor(503, "x")).toBeInstanceOf(TransientError);
    expect(errorFor(403, "x")).toBeInstanceOf(PermanentError);
  });

  it("treats a thrown fetch failure as transient and keeps classified errors", () => {
    expect(fromThrown(new TypeError("Failed to fetch"))).toBeInstanceOf(TransientError);
    const permanent = new PermanentError("no");
    expect(fromThrown(permanent)).toBe(permanent);
    expect(fromThrown({ status: 404, message: "gone" })).toBeInstanceOf(PermanentError);
  });
});
