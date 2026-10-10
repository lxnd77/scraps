import { z } from "zod";

export const SPACE_COLORS = ["yellow", "lime", "pink", "blue", "lilac", "orange"] as const;
export type SpaceColor = (typeof SPACE_COLORS)[number];

export const STICKER_IDS = [
  "smiley",
  "sleepy-moon",
  "heart",
  "sparkle",
  "lightning",
  "flower",
  "speech-bubble",
  "planet",
  "zzz",
  "sun",
] as const;
export type StickerId = (typeof STICKER_IDS)[number];

export const THEME_PREFERENCES = ["day", "midnight", "auto"] as const;
export type ThemePreferenceValue = (typeof THEME_PREFERENCES)[number];

export const spaceColorSchema = z.enum(SPACE_COLORS);
export const stickerSchema = z.enum(STICKER_IDS);
export const themeSchema = z.enum(THEME_PREFERENCES);

export const spaceNameSchema = z
  .string()
  .trim()
  .min(1, "give it a name")
  .max(60, "keep it under 60 characters");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "what should we call you?")
  .max(40, "keep it under 40 characters");

export const createSpaceSchema = z.object({
  name: spaceNameSchema,
  color: spaceColorSchema,
});

export const updateSpaceSchema = z.object({
  id: z.uuid(),
  name: spaceNameSchema,
  color: spaceColorSchema,
});

/**
 * The product is for 16 and up. Only a birth year is collected, so the gap is
 * 17 years: anyone passing it is certainly at least 16, whatever their birthday.
 */
export const MIN_AGE = 16;
export const MIN_YEAR_GAP = MIN_AGE + 1;

export function isOldEnough(birthYear: number, now: Date = new Date()): boolean {
  return now.getFullYear() - birthYear >= MIN_YEAR_GAP;
}

export const birthYearSchema = z.coerce
  .number()
  .int("use a four digit year")
  .min(1900, "that year doesn't look right")
  .max(2100, "that year doesn't look right");

export const onboardingSchema = z.object({
  birthYear: birthYearSchema,
  displayName: displayNameSchema,
  avatarSticker: stickerSchema,
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema,
  avatarSticker: stickerSchema,
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("that email doesn't look right"));
