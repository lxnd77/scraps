import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx, type Accent } from "../lib";

const ACCENT_VAR: Record<Accent, string> = {
  yellow: "var(--c-yellow)",
  lime: "var(--c-lime)",
  pink: "var(--c-pink)",
  blue: "var(--c-blue)",
  lilac: "var(--c-lilac)",
  orange: "var(--c-orange)",
};

export interface FilterChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  pressed: boolean;
  count?: number;
  /** accent used for the active shadow */
  accent?: Accent;
}

/** Toggle chip for board filters. */
export function FilterChip({
  pressed,
  count,
  accent = "pink",
  className,
  style,
  children,
  type = "button",
  ...rest
}: FilterChipProps) {
  const chipStyle = { "--chip-accent": ACCENT_VAR[accent], ...style } as CSSProperties;
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cx("sc-chip sc-chip--filter", className)}
      style={chipStyle}
      {...rest}
    >
      {children}
      {count !== undefined && <span className="sc-chip__count">{count}</span>}
    </button>
  );
}

/** Label plus value, e.g. "when  fri 14 nov". */
export function PropertyChip({
  label,
  children,
  className,
  ...rest
}: { label: string; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx("sc-chip sc-chip--property", className)} {...rest}>
      <span className="sc-chip__key">{label}</span>
      <span>{children}</span>
    </span>
  );
}

/** Coloured tag chip. */
export function TagChip({
  color = "lilac",
  className,
  children,
  ...rest
}: { color?: Accent; children: ReactNode } & Omit<HTMLAttributes<HTMLSpanElement>, "color">) {
  return (
    <span className={cx("sc-chip sc-chip--tag", `sc-fill-${color}`, className)} {...rest}>
      {children}
    </span>
  );
}

/** Small count badge such as 3/7. */
export function CountBadge({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx("sc-chip sc-chip--count", className)} {...rest}>
      {children}
    </span>
  );
}
