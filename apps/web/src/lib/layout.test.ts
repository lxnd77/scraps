import { afterEach, describe, expect, it, vi } from "vitest";
import { readLayout, writeLayout } from "./layout";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("board layout preference", () => {
  it("defaults to cards and remembers the list choice", () => {
    expect(readLayout()).toBe("cards");
    writeLayout("list");
    expect(readLayout()).toBe("list");
    writeLayout("cards");
    expect(readLayout()).toBe("cards");
  });

  it("survives storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readLayout()).toBe("cards");
    expect(() => writeLayout("list")).not.toThrow();
  });
});
