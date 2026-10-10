import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx, tiltFor, type CardColor } from "../lib";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "color"> {
  /** note id; the tilt is derived from it so a card keeps its tilt */
  id?: string;
  color?: CardColor | "polaroid";
  /** tidy mode removes the tilt */
  tidy?: boolean;
  as?: "article" | "div" | "section" | "li";
  children?: ReactNode;
}

/** Outlined, hard-shadowed, tilted wrapper used by every note card. */
export function Card({
  id,
  color = "yellow",
  tidy = false,
  as: Tag = "article",
  className,
  style,
  children,
  ...rest
}: CardProps) {
  const tilt = tidy || !id ? "0deg" : tiltFor(id);
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
