import type { ReactNode } from "react";

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

// Outlines use --line (ink by day, off-white at night) so free-floating strokes stay visible on
// the dark theme. Details drawn inside a coloured fill use --on-accent, which is dark on every accent.
const LINE = "var(--line)";
const DETAIL = "var(--on-accent)";
const line = {
  stroke: LINE,
  strokeWidth: 2.5,
  strokeLinejoin: "round",
  strokeLinecap: "round",
} as const;

const ART: Record<StickerId, ReactNode> = {
  smiley: (
    <>
      <circle cx="28" cy="28" r="22" fill="var(--c-yellow)" {...line} />
      <circle cx="20" cy="23" r="2.6" fill={DETAIL} />
      <circle cx="36" cy="23" r="2.6" fill={DETAIL} />
      <path d="M17 33q11 11 22 0" fill="none" {...line} stroke={DETAIL} />
    </>
  ),
  "sleepy-moon": (
    <>
      <path d="M46 34A20 20 0 1 1 22 8a16 16 0 0 0 24 26z" fill="var(--c-yellow)" {...line} />
      <path d="M20 28q3 3 6 0M30 34q3 3 6 0" fill="none" {...line} stroke={DETAIL} />
    </>
  ),
  heart: (
    <path
      d="M28 48C10 36 6 25 12 17c5-6 13-4 16 3 3-7 11-9 16-3 6 8 2 19-16 31z"
      fill="var(--c-pink)"
      {...line}
    />
  ),
  sparkle: (
    <path
      d="M28 4l5.5 18.5L52 28l-18.5 5.5L28 52l-5.5-18.5L4 28l18.5-5.5z"
      fill="var(--c-yellow)"
      {...line}
    />
  ),
  lightning: <path d="M32 4L12 32h13l-4 20 23-30H31z" fill="var(--c-yellow)" {...line} />,
  flower: (
    <>
      {[0, 72, 144, 216, 288].map((angle) => (
        <circle
          key={angle}
          cx="28"
          cy="14"
          r="9"
          fill="var(--c-pink)"
          {...line}
          transform={`rotate(${angle} 28 28)`}
        />
      ))}
      <circle cx="28" cy="28" r="8" fill="var(--c-yellow)" {...line} />
    </>
  ),
  "speech-bubble": (
    <>
      <path
        d="M10 10h36a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H26l-10 9v-9h-6a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6z"
        fill="var(--c-lime)"
        {...line}
      />
      <circle cx="19" cy="25" r="2.4" fill={DETAIL} />
      <circle cx="28" cy="25" r="2.4" fill={DETAIL} />
      <circle cx="37" cy="25" r="2.4" fill={DETAIL} />
    </>
  ),
  planet: (
    <>
      <path d="M6 38C2 30 14 20 30 16c14-4 24-2 22 4" fill="none" {...line} />
      <circle cx="28" cy="30" r="14" fill="var(--c-lilac)" {...line} />
      <path d="M8 44c-4-2-2-7 8-12" fill="none" {...line} />
      <path d="M46 40c-6 6-24 8-38 2" fill="none" {...line} />
    </>
  ),
  zzz: (
    <>
      <path d="M8 12h14L8 30h14" fill="var(--c-lilac)" {...line} />
      <path d="M26 24h12L26 38h12" fill="var(--c-lime)" {...line} />
      <path d="M40 8h10L40 22h10" fill="var(--c-yellow)" {...line} />
    </>
  ),
  sun: (
    <>
      <path
        d="M28 3v8M28 45v8M3 28h8M45 28h8M10.3 10.3l5.7 5.7M40 40l5.7 5.7M45.7 10.3L40 16M16 40l-5.7 5.7"
        fill="none"
        {...line}
      />
      <circle cx="28" cy="28" r="12" fill="var(--c-orange)" {...line} />
    </>
  ),
};

export interface StickerProps {
  id: StickerId;
  size?: number;
  /** accessible name; omit for decorative stickers */
  title?: string;
  className?: string;
}

/** Original SVG sticker with ink outline. Never use emoji in place of these. */
export function Sticker({ id, size = 48, title, className }: StickerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {ART[id]}
    </svg>
  );
}
