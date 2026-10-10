import { describe, expect, it } from "vitest";
import {
  createSpaceSchema,
  emailSchema,
  isOldEnough,
  onboardingSchema,
  updateSpaceSchema,
} from "./schemas";

describe("age gate", () => {
  const now = new Date("2026-10-10T00:00:00Z");

  it("needs a 17 year gap so everyone passing is at least 16", () => {
    expect(isOldEnough(2009, now)).toBe(true); // 17 year gap
    expect(isOldEnough(2010, now)).toBe(false); // 16 year gap: might still be 15
    expect(isOldEnough(2024, now)).toBe(false);
    expect(isOldEnough(1990, now)).toBe(true);
  });
});

describe("space schemas", () => {
  it("trims names and rejects empty or long ones", () => {
    expect(createSpaceSchema.parse({ name: "  side quests ", color: "lime" }).name).toBe(
      "side quests",
    );
    expect(createSpaceSchema.safeParse({ name: "   ", color: "lime" }).success).toBe(false);
    expect(createSpaceSchema.safeParse({ name: "x".repeat(61), color: "lime" }).success).toBe(
      false,
    );
  });

  it("only allows the six accent colours", () => {
    expect(createSpaceSchema.safeParse({ name: "a", color: "surface" }).success).toBe(false);
    expect(createSpaceSchema.safeParse({ name: "a", color: "teal" }).success).toBe(false);
  });

  it("needs a uuid to update", () => {
    expect(updateSpaceSchema.safeParse({ id: "nope", name: "a", color: "pink" }).success).toBe(
      false,
    );
  });
});

describe("onboarding schema", () => {
  it("coerces the birth year from form data", () => {
    const parsed = onboardingSchema.parse({
      birthYear: "2001",
      displayName: "maya",
      avatarSticker: "flower",
    });
    expect(parsed.birthYear).toBe(2001);
  });

  it("rejects unknown stickers and empty names", () => {
    expect(
      onboardingSchema.safeParse({ birthYear: "2001", displayName: "", avatarSticker: "flower" })
        .success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse({ birthYear: "2001", displayName: "a", avatarSticker: "emoji" })
        .success,
    ).toBe(false);
  });
});

describe("emailSchema", () => {
  it("normalises case and whitespace", () => {
    expect(emailSchema.parse("  Maya@Scraps.TEST ")).toBe("maya@scraps.test");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});
