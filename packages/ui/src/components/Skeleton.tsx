import type { CSSProperties } from "react";
import { cx } from "../lib";

/** Outline-only placeholder card. Decorative; pair with an aria-busy region. */
export function Skeleton({
  height = 160,
  className,
  style,
}: {
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div aria-hidden="true" className={cx("sc-skeleton", className)} style={{ height, ...style }} />
  );
}
