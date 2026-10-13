import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx, tiltFor, type CardColor } from "../lib";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "color"> {
  /** element id; also the tilt seed when `tiltKey` is not given */
  id?: string;
  /** note id; the tilt is derived from it so a card keeps its tilt, without setting an element id */
  tiltKey?: string;
  color?: CardColor | "polaroid";
  /** tidy mode removes the tilt */
  tidy?: boolean;
  as?: "article" | "div" | "section" | "li";
  children?: ReactNode;
}

/** Outlined, hard-shadowed, tilted wrapper used by every note card. */
export function Card({
  id,
  tiltKey,
  color = "yellow",
  tidy = false,
  as: Tag = "article",
  className,
  style,
  children,
  ...rest
}: CardProps) {
  const seed = tiltKey ?? id;
  const tilt = tidy || !seed ? "0deg" : tiltFor(seed);
  const cardStyle = { "--tilt": tilt, ...style } as CSSProperties;
  return (
    <Tag
      id={id}
      className={cx("sc-card", `sc-card--${color}`, className)}
      style={cardStyle}
      {...rest}
    >
      {children}
    </Tag>
  );
}
