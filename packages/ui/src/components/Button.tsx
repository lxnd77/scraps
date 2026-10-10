import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx, type Accent } from "../lib";

type Base = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color">;

export type ButtonProps =
  | (Base & { variant?: "primary"; color?: Accent; children: ReactNode })
  | (Base & { variant: "dark" | "ghost"; children: ReactNode })
  | (Base & { variant: "icon"; "aria-label": string; size?: "md" | "sm"; children: ReactNode });

const FILL: Record<Accent, string> = {
  yellow: "sc-fill-yellow",
  lime: "sc-fill-lime",
  pink: "sc-fill-pink",
  blue: "sc-fill-blue",
  lilac: "sc-fill-lilac",
  orange: "sc-fill-orange",
};

export function Button(props: ButtonProps) {
  const variant = props.variant ?? "primary";
  if (variant === "icon") {
    const {
      variant: _v,
      size = "md",
      className,
      children,
      type = "button",
      ...rest
    } = props as Base & {
      variant: "icon";
      size?: "md" | "sm";
      children: ReactNode;
    };
    return (
      <button
        type={type}
        className={cx("sc-btn sc-btn--icon", size === "sm" && "sc-btn--sm", className)}
        {...rest}
      >
        {children}
      </button>
    );
  }
  if (variant === "primary") {
    const {
      variant: _v,
      color = "pink",
      className,
      children,
      type = "button",
      ...rest
    } = props as Base & {
      variant?: "primary";
      color?: Accent;
      children: ReactNode;
    };
    return (
      <button
        type={type}
        className={cx("sc-btn sc-btn--primary", FILL[color], className)}
        {...rest}
      >
        {children}
      </button>
    );
  }
  const {
    variant: _v,
    className,
    children,
    type = "button",
    ...rest
  } = props as Base & {
    variant: "dark" | "ghost";
    children: ReactNode;
  };
  return (
    <button type={type} className={cx("sc-btn", `sc-btn--${variant}`, className)} {...rest}>
      {children}
    </button>
  );
}
