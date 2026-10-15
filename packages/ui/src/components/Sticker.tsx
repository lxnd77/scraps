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
  // the Oct 15 set, drawn from a NIM concept sheet in the palette tokens
  "lol",
  "side-eye",
  "heart-eyes",
  "cool",
  "sleepy",
  "skull",
  "coffee",
  "phone",
  "headphones",
  "laptop",
  "plant",
  "books",
  "fire",
  "star",
  "rainbow",
  "cloud",
  "ghost",
  "eyes",
  "pizza",
  "boba",
  "cake",
  "donut",
  "avocado",
  "strawberry",
  "check",
  "question",
  "exclamation",
  "sparkles",
  "arrow",
  "hundred",
] as const;

export type StickerId = (typeof STICKER_IDS)[number];

// Outlines use --line (ink by day, off-white at night) so free-floating strokes stay visible on
// the dark theme. Details drawn inside a coloured fill use --on-accent, which is dark on every accent.
const LINE = "var(--line)";
const DETAIL = "var(--on-accent)";
// the white parts (ghost, eyeballs, clouds): white by day, the off-white of the night theme
const WHITE = "var(--sticker-white)";
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
  lol: (
    <>
      <circle cx="28" cy="28" r="22" fill="var(--c-yellow)" {...line} />
      <path d="M15 23q4.5-5 9 0M32 23q4.5-5 9 0" fill="none" {...line} stroke={DETAIL} />
      <path d="M17 30h22q-1 12-11 12t-11-12z" fill={DETAIL} {...line} stroke={DETAIL} />
      <path d="M9 27c-3 5-3 9 1 10c4-1 3-5-1-10z" fill="var(--c-pink)" {...line} />
      <path d="M47 27c3 5 3 9-1 10c-4-1-3-5 1-10z" fill="var(--c-pink)" {...line} />
    </>
  ),
  "side-eye": (
    <>
      <circle cx="28" cy="28" r="22" fill="var(--c-lilac)" {...line} />
      <path d="M14 17l9 1.5M33 18.5q4-2.5 9-1" fill="none" {...line} stroke={DETAIL} />
      <circle cx="19" cy="25" r="5.5" fill={WHITE} {...line} stroke={DETAIL} strokeWidth={2} />
      <circle cx="37" cy="25" r="5.5" fill={WHITE} {...line} stroke={DETAIL} strokeWidth={2} />
      <circle cx="21.5" cy="25.5" r="2.6" fill={DETAIL} />
      <circle cx="39.5" cy="25.5" r="2.6" fill={DETAIL} />
      <path d="M24 39h9" fill="none" {...line} stroke={DETAIL} />
    </>
  ),
  "heart-eyes": (
    <>
      <circle cx="28" cy="28" r="22" fill="var(--c-pink)" {...line} />
      <path
        d="M20 29c-6-4-7-8-4-10c2-1 4 0 4 2c0-2 2-3 4-2c3 2 2 6-4 10zM36 29c-6-4-7-8-4-10c2-1 4 0 4 2c0-2 2-3 4-2c3 2 2 6-4 10z"
        fill="var(--c-yellow)"
        {...line}
        stroke={DETAIL}
        strokeWidth={2}
      />
      <path d="M20 37q8 7 16 0" fill="none" {...line} stroke={DETAIL} />
    </>
  ),
  cool: (
    <>
      <circle cx="28" cy="28" r="22" fill="var(--c-lime)" {...line} />
      <path
        d="M11 20h34v4c0 6-3 9-8 9s-7-3-7-7h-4c0 4-2 7-7 7s-8-3-8-9z"
        fill={DETAIL}
        {...line}
        stroke={DETAIL}
      />
      <path d="M17 23l3-2M35 23l3-2" fill="none" {...line} stroke={WHITE} strokeWidth={2} />
      <path d="M23 40q6 3 11-2" fill="none" {...line} stroke={DETAIL} />
    </>
  ),
  sleepy: (
    <>
      <circle cx="28" cy="30" r="21" fill="var(--c-orange)" {...line} />
      <path d="M15 28q4.5 4 9 0M32 28q4.5 4 9 0" fill="none" {...line} stroke={DETAIL} />
      <ellipse cx="28" cy="40" rx="3" ry="2.2" fill={DETAIL} />
      <path d="M40 3h7l-7 7h7" fill="none" {...line} />
    </>
  ),
  skull: (
    <>
      <path
        d="M28 5C16 5 8 13 8 24c0 7 3 11 7 13v9h26v-9c4-2 7-6 7-13C48 13 40 5 28 5z"
        fill="var(--c-lime)"
        {...line}
      />
      <circle cx="20" cy="25" r="5.5" fill={DETAIL} />
      <circle cx="36" cy="25" r="5.5" fill={DETAIL} />
      <path d="M28 31l-3 5h6z" fill={DETAIL} />
      <path d="M22 40v6M28 40v6M34 40v6" fill="none" {...line} stroke={DETAIL} strokeWidth={2} />
    </>
  ),
  coffee: (
    <>
      <path d="M18 15q-3-4 0-7t0-6M27 15q-3-4 0-7t0-6" fill="none" {...line} />
      <path d="M38 26h3a6 6 0 0 1 0 12h-3" fill="none" {...line} />
      <path d="M9 20h30v22a7 7 0 0 1-7 7H16a7 7 0 0 1-7-7z" fill="var(--c-pink)" {...line} />
      <path d="M15 27v12" fill="none" {...line} stroke={WHITE} strokeWidth={3} />
    </>
  ),
  phone: (
    <>
      <rect x="15" y="4" width="26" height="48" rx="7" fill="var(--c-lilac)" {...line} />
      <rect x="19.5" y="10" width="17" height="32" rx="2.5" fill={DETAIL} />
      <path d="M23 15l4-3M23 20l8-6" fill="none" {...line} stroke={WHITE} strokeWidth={1.8} />
      <circle cx="28" cy="47" r="2.2" fill={DETAIL} />
    </>
  ),
  headphones: (
    <>
      <path d="M10 33v-7a18 18 0 0 1 36 0v7" fill="none" {...line} strokeWidth={10} />
      <path d="M10 33v-7a18 18 0 0 1 36 0v7" fill="none" stroke="var(--c-orange)" strokeWidth={5} />
      <rect x="5" y="30" width="12" height="20" rx="6" fill="var(--c-orange)" {...line} />
      <rect x="39" y="30" width="12" height="20" rx="6" fill="var(--c-orange)" {...line} />
      <rect x="15" y="32" width="6" height="16" rx="3" fill={DETAIL} {...line} stroke={DETAIL} />
      <rect x="35" y="32" width="6" height="16" rx="3" fill={DETAIL} {...line} stroke={DETAIL} />
    </>
  ),
  laptop: (
    <>
      <rect x="10" y="9" width="36" height="26" rx="3" fill="var(--c-blue)" {...line} />
      <rect x="14" y="13" width="28" height="18" rx="1.5" fill={DETAIL} />
      <path d="M4 39h48l-3.5 8h-41z" fill="var(--c-blue)" {...line} />
      <path d="M24 43h8" fill="none" {...line} stroke="var(--on-blue)" />
    </>
  ),
  plant: (
    <>
      <path d="M28 31C22 22 24 10 28 3c4 7 6 19 0 28z" fill="var(--c-lime)" {...line} />
      <path d="M27 31C18 30 10 22 8 13c9 1 17 8 19 18z" fill="var(--c-lime)" {...line} />
      <path d="M29 31c9-1 17-9 19-18c-9 1-17 8-19 18z" fill="var(--c-lime)" {...line} />
      <path d="M17 34h22l-3 17H20z" fill="var(--c-pink)" {...line} />
      <rect x="14" y="29" width="28" height="6" rx="2" fill="var(--c-pink)" {...line} />
      <path
        d="M21 41l3.5 4 3.5-4 3.5 4 3.5-4"
        fill="none"
        {...line}
        stroke={DETAIL}
        strokeWidth={2}
      />
    </>
  ),
  books: (
    <>
      <rect x="6" y="40" width="44" height="10" rx="2.5" fill="var(--c-yellow)" {...line} />
      <rect x="9" y="30" width="40" height="10" rx="2.5" fill="var(--c-pink)" {...line} />
      <rect x="7" y="20" width="40" height="10" rx="2.5" fill="var(--c-blue)" {...line} />
      <path d="M13 40v10M16 30v10" fill="none" {...line} stroke={DETAIL} strokeWidth={2} />
      <path d="M14 20v10" fill="none" {...line} stroke="var(--on-blue)" strokeWidth={2} />
    </>
  ),
  fire: (
    <>
      <path
        d="M28 52c-11 0-18-7-18-17c0-9 6-14 8-22c4 4 5 8 5 11c3-6 4-13 2-20c9 5 19 15 19 29c0 11-7 19-16 19z"
        fill="var(--c-pink)"
        {...line}
      />
      <path
        d="M28 52c-5 0-9-4-9-9c0-5 4-8 5-13c2 3 3 5 3 7c2-2 4-5 4-9c4 4 6 8 6 14c0 6-4 10-9 10z"
        fill="var(--c-yellow)"
        {...line}
      />
    </>
  ),
  star: (
    <>
      <path
        d="M28 4l6.9 15.3 16.6 1.8-12.4 11.2 3.4 16.4L28 40.4l-14.5 8.3 3.4-16.4L4.5 21.1l16.6-1.8z"
        fill="var(--c-yellow)"
        {...line}
      />
      <path d="M21 24l3-4" fill="none" {...line} stroke={WHITE} strokeWidth={2.5} />
    </>
  ),
  rainbow: (
    <>
      <path d="M5 42a23 23 0 0 1 46 0h-5.5a17.5 17.5 0 0 0-35 0z" fill="var(--c-pink)" {...line} />
      <path
        d="M10.5 42a17.5 17.5 0 0 1 35 0H40a12 12 0 0 0-24 0z"
        fill="var(--c-orange)"
        {...line}
      />
      <path d="M16 42a12 12 0 0 1 24 0h-5.5a6.5 6.5 0 0 0-13 0z" fill="var(--c-lime)" {...line} />
      <path d="M3 49c-2-4 2-8 6-6c1-4 8-4 9 1c3 0 5 2 4 5z" fill={WHITE} {...line} />
      <path d="M53 49c2-4-2-8-6-6c-1-4-8-4-9 1c-3 0-5 2-4 5z" fill={WHITE} {...line} />
    </>
  ),
  cloud: (
    <>
      <path
        d="M14 44c-6 0-10-4-10-9s4-9 10-9c1-8 7-13 14-13 7 0 13 5 14 12 5 0 10 4 10 9.5S48 44 42 44z"
        fill="var(--c-lilac)"
        {...line}
      />
      <path d="M15 32q2-4 6-4" fill="none" {...line} stroke={WHITE} strokeWidth={2.5} />
    </>
  ),
  ghost: (
    <>
      <path
        d="M12 50V26c0-10 7-18 16-18s16 8 16 18v24l-5.3-5-5.3 5-5.4-5-5.3 5-5.4-5z"
        fill={WHITE}
        {...line}
      />
      <ellipse cx="23" cy="26" rx="2.4" ry="3.2" fill={DETAIL} />
      <ellipse cx="33" cy="26" rx="2.4" ry="3.2" fill={DETAIL} />
      <ellipse cx="28" cy="35" rx="2.2" ry="2.8" fill={DETAIL} />
    </>
  ),
  eyes: (
    <>
      <path d="M8 11q9-6 17 0M31 11q9-6 17 0" fill="none" {...line} />
      <ellipse cx="17" cy="32" rx="10" ry="13" fill={WHITE} {...line} />
      <ellipse cx="39" cy="32" rx="10" ry="13" fill={WHITE} {...line} />
      <circle cx="20" cy="35" r="5" fill={DETAIL} />
      <circle cx="42" cy="35" r="5" fill={DETAIL} />
      <circle cx="22" cy="33" r="1.6" fill={WHITE} />
      <circle cx="44" cy="33" r="1.6" fill={WHITE} />
    </>
  ),
  pizza: (
    <>
      <path d="M7 13c14-6 28-4 42 2L26 53z" fill="var(--c-yellow)" {...line} />
      <path d="M7 13c14-6 28-4 42 2l-2.2 5c-12-5-25-6-37-2z" fill="var(--c-orange)" {...line} />
      <circle cx="22" cy="26" r="4" fill="var(--c-pink)" {...line} />
      <circle cx="34" cy="28" r="3.6" fill="var(--c-pink)" {...line} />
      <circle cx="26" cy="38" r="3.4" fill="var(--c-pink)" {...line} />
    </>
  ),
  boba: (
    <>
      <path d="M31 2l4.5 1-2.5 16h-4.5z" fill={DETAIL} {...line} />
      <path
        d="M14 19h28l-3.4 30a3.5 3.5 0 0 1-3.5 3H20.9a3.5 3.5 0 0 1-3.5-3z"
        fill="var(--c-pink)"
        {...line}
      />
      <path d="M11 19c0-6 7-10 17-10s17 4 17 10z" fill={WHITE} {...line} />
      <circle cx="22.5" cy="45" r="2.7" fill={DETAIL} />
      <circle cx="28.5" cy="46.5" r="2.7" fill={DETAIL} />
      <circle cx="34" cy="45" r="2.7" fill={DETAIL} />
      <circle cx="25.5" cy="39.5" r="2.7" fill={DETAIL} />
      <circle cx="31.5" cy="39.5" r="2.7" fill={DETAIL} />
    </>
  ),
  cake: (
    <>
      <path d="M6 30l20 8v14L6 44z" fill="var(--c-yellow)" {...line} />
      <path d="M26 38l24-14v14L26 52z" fill="var(--c-yellow)" {...line} />
      <path d="M6 37l20 8 24-14" fill="none" stroke="var(--c-pink)" strokeWidth={3} />
      <path d="M6 30l24-14 20 8-24 14z" fill="var(--c-lilac)" {...line} />
      <path d="M31 13q1-6 6-8" fill="none" {...line} />
      <circle cx="30" cy="16" r="4.5" fill="var(--c-pink)" {...line} />
    </>
  ),
  donut: (
    <>
      <path
        d="M28 6a22 22 0 1 0 0.01 0zM28 21a7 7 0 1 1-0.01 0z"
        fillRule="evenodd"
        fill="var(--c-orange)"
        {...line}
      />
      <path
        d="M28 10a18 18 0 1 0 0.01 0zM28 19a9 9 0 1 1-0.01 0z"
        fillRule="evenodd"
        fill="var(--c-pink)"
        {...line}
      />
      <g fill="none" strokeWidth={2.6} strokeLinecap="round">
        <path d="M18 22l2-3M41 30l-1 3" stroke="var(--c-yellow)" />
        <path d="M35 14l3 1M18 34l-2-3" stroke="var(--c-lime)" />
        <path d="M33 40l3-1" stroke="var(--c-blue)" />
        <path d="M26 13h3M23 41l3 1" stroke={WHITE} />
      </g>
    </>
  ),
  avocado: (
    <>
      <path
        d="M28 4c8 0 13 8 15 18 3 13-3 28-15 28S10 35 13 22C15 12 20 4 28 4z"
        fill="var(--c-lime)"
        {...line}
      />
      <path
        d="M28 9c6 0 10 6 11 14 2 11-3 22-11 22S15 34 17 23c1-8 5-14 11-14z"
        fill="var(--c-yellow)"
        {...line}
      />
      <circle cx="28" cy="33" r="7" fill="var(--c-orange)" {...line} />
      <circle cx="25.5" cy="30.5" r="1.7" fill={WHITE} />
    </>
  ),
  strawberry: (
    <>
      <path
        d="M28 51C16 47 8 35 10 23c1-5 6-8 18-8s17 3 18 8c2 12-6 24-18 28z"
        fill="var(--c-pink)"
        {...line}
      />
      <path d="M16 17l5-7 3 5 4-9 4 9 3-5 5 7-12 4z" fill="var(--c-lime)" {...line} />
      <g fill="var(--c-yellow)">
        {[
          [20, 26],
          [28, 25],
          [36, 26],
          [16, 33],
          [24, 32],
          [32, 32],
          [40, 33],
          [20, 40],
          [28, 40],
          [36, 40],
          [28, 46],
        ].map(([x, y]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="1.4" ry="2" />
        ))}
      </g>
    </>
  ),
  check: <path d="M5 30l8.5-8.5 9 9L42.5 11 51 19.5 22.5 48z" fill="var(--c-lime)" {...line} />,
  question: (
    <>
      <path
        d="M19 19c0-6 4-10 9-10s9 4 9 9c0 5-4 7-7 9c-2 1.3-2 3-2 6"
        fill="none"
        {...line}
        strokeWidth={12}
      />
      <path
        d="M19 19c0-6 4-10 9-10s9 4 9 9c0 5-4 7-7 9c-2 1.3-2 3-2 6"
        fill="none"
        stroke="var(--c-lilac)"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="28" cy="46" r="5" fill="var(--c-lilac)" {...line} />
    </>
  ),
  exclamation: (
    <>
      <path d="M22.5 5h11l-2 31h-7z" fill="var(--c-pink)" {...line} />
      <circle cx="28" cy="46" r="5.5" fill="var(--c-pink)" {...line} />
    </>
  ),
  sparkles: (
    <>
      <path d="M23 10l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" fill="var(--c-yellow)" {...line} />
      <path d="M43 31l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="var(--c-pink)" {...line} />
      <path
        d="M43 4l1.6 4.4L49 10l-4.4 1.6L43 16l-1.6-4.4L37 10l4.4-1.6z"
        fill="var(--c-lilac)"
        {...line}
      />
    </>
  ),
  arrow: (
    <>
      <path d="M10 46c0-14 9-23 24-23" fill="none" {...line} strokeWidth={13} />
      <path
        d="M10 46c0-14 9-23 24-23"
        fill="none"
        stroke="var(--c-orange)"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <path d="M32 10l17 13-17 13z" fill="var(--c-orange)" {...line} />
    </>
  ),
  hundred: (
    <g transform="rotate(-8 28 28)">
      <path
        d="M9 16l5-3v24M26 14c-3 0-5 5-5 11s2 11 5 11 5-5 5-11-2-11-5-11zM42 14c-3 0-5 5-5 11s2 11 5 11 5-5 5-11-2-11-5-11zM8 44q20-5 40-4M12 50q16-3 32-2"
        fill="none"
        {...line}
        strokeWidth={9}
      />
      <path
        d="M9 16l5-3v24M26 14c-3 0-5 5-5 11s2 11 5 11 5-5 5-11-2-11-5-11zM42 14c-3 0-5 5-5 11s2 11 5 11 5-5 5-11-2-11-5-11zM8 44q20-5 40-4M12 50q16-3 32-2"
        fill="none"
        stroke="var(--c-pink)"
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
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
