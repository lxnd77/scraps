import { describe, expect, it } from "vitest";
import { STORAGE_SOFT_LIMIT_BYTES, describeStorage } from "./index";

describe("describeStorage", () => {
  it("is ok under 80%, warns from 80%, and is over at the limit", () => {
    const limit = 100;
    expect(describeStorage(0, limit)).toMatchObject({ state: "ok", fraction: 0 });
    expect(describeStorage(79, limit).state).toBe("ok");
    expect(describeStorage(80, limit)).toMatchObject({ state: "warn", fraction: 0.8 });
    expect(describeStorage(100, limit).state).toBe("over");
    expect(describeStorage(250, limit)).toMatchObject({ state: "over", fraction: 1 });
  });

  it("clamps nonsense and defaults to 500 MB", () => {
    expect(describeStorage(-5, 100).usedBytes).toBe(0);
    expect(describeStorage(1).limitBytes).toBe(STORAGE_SOFT_LIMIT_BYTES);
    expect(STORAGE_SOFT_LIMIT_BYTES).toBe(524288000);
  });
});
