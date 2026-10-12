"use client";

import { Ban } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cx } from "../lib";

export interface SwatchesProps<C extends string> {
  /** the group's name for screen readers; shown above the swatches unless `hideLabel` */
  label: string;
  hideLabel?: boolean;
  /** colour token names; each swatch paints with its sc-fill-* class */
  colors: readonly C[];
  value: C | null;
  onChange: (color: C | null) => void;
  /** adds a "no colour" choice first, with this accessible name */
  none?: string;
  /** icon for the "no colour" choice; a crossed circle by default */
  noneIcon?: ReactNode;
  /** "sm" draws 28px swatches inside the same 44px hit area, for toolbars */
  size?: "sm" | "md";
  className?: string;
}

/**
 * The one colour picker: native radios (arrow keys and screen readers for free), styled as
 * chunky swatches. Used for cards, callouts, highlights and quick capture.
 */
export function Swatches<C extends string>({
  label,
  hideLabel,
  colors,
  value,
  onChange,
  none,
  noneIcon,
  size = "md",
  className,
}: SwatchesProps<C>) {
  const name = useId();
  return (
    <fieldset className={cx("sc-swatches", size === "sm" && "sc-swatches--sm", className)}>
      <legend className={hideLabel ? "sr-only" : "sc-swatches__label"}>{label}</legend>
      <div className="sc-swatches__row">
        {none && (
          <label className="sc-swatches__option">
            <input
              type="radio"
              name={name}
              checked={value === null}
              onChange={() => onChange(null)}
              className="sc-swatches__input"
            />
            <span className="sc-swatches__swatch sc-swatches__swatch--none" aria-hidden="true">
              {noneIcon ?? <Ban size={size === "sm" ? 14 : 18} strokeWidth={2.6} />}
            </span>
            <span className="sr-only">{none}</span>
          </label>
        )}
        {colors.map((color) => (
          <label key={color} className="sc-swatches__option">
            <input
              type="radio"
              name={name}
              value={color}
              checked={value === color}
              onChange={() => onChange(color)}
              className="sc-swatches__input"
            />
            <span className={`sc-swatches__swatch sc-fill-${color}`} aria-hidden="true" />
            <span className="sr-only">{color}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
