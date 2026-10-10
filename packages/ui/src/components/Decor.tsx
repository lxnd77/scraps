import type { CSSProperties, ReactNode } from "react";
import { cx, type Accent } from "../lib";

/** Washi tape strip for polaroid cards. Decorative. */
export function Tape({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={cx("sc-tape", className)} style={style} />;
}

/** Four-point sparkle star. Decorative. */
export function Sparkle({
  size = 22,
  color = "yellow",
  className,
  style,
}: {
  size?: number;
  color?: Accent | "ink";
  className?: string;
  style?: CSSProperties;
}) {
  const fill = color === "ink" ? "var(--ink)" : `var(--c-${color})`;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={style}
    >
      <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill={fill} />
    </svg>
  );
}

/** Rounded brand square: sparkle by day, crescent by night (switched in CSS, no flash). */
export function BrandMark({ size = 46, className }: { size?: number; className?: string }) {
  const inner = Math.round(size * 0.52);
  return (
    <span
      aria-hidden="true"
      className={cx("sc-brand", className)}
      style={{ width: size, height: size }}
    >
      <svg
        className="sc-brand__sparkle"
        width={inner}
        height={inner}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
      </svg>
      <svg
        className="sc-brand__moon"
        width={inner}
        height={inner}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
      </svg>
    </span>
  );
}

/** The accent pill around the key phrase in a greeting. */
export function Highlight({ color = "pink", children }: { color?: Accent; children: ReactNode }) {
  return <span className={cx("sc-highlight", `sc-fill-${color}`)}>{children}</span>;
}
