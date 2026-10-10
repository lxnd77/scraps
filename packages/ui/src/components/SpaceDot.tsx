import { cx, type Accent } from "../lib";

export function SpaceDot({ color, className }: { color: Accent; className?: string }) {
  return <span aria-hidden="true" className={cx("sc-space-dot", `sc-fill-${color}`, className)} />;
}
