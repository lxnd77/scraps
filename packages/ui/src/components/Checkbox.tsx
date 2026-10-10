import type { ButtonHTMLAttributes } from "react";
import { cx } from "../lib";

export interface CheckboxProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onChange?: (next: boolean) => void;
  /** required: the checkbox has no visible text of its own */
  "aria-label": string;
}

/** Toggle button drawn as a rounded box. Inside cards it is a separate button with aria-pressed. */
export function Checkbox({
  checked,
  onChange,
  className,
  onClick,
  type = "button",
  ...rest
}: CheckboxProps) {
  return (
    <button
      type={type}
      aria-pressed={checked}
      className={cx("sc-checkbox", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onChange?.(!checked);
      }}
      {...rest}
    >
      <span className="sc-checkbox__box" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            className="sc-checkbox__tick"
            d="M5 12.5l4.5 4.5L19 7.5"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}
