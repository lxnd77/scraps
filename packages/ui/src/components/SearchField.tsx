import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cx } from "../lib";

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** key cap hint shown on desktop, e.g. "⌘K" */
  hint?: string;
  size?: "md" | "lg";
  "aria-label": string;
}

export function SearchField({ hint, size = "md", className, ...rest }: SearchFieldProps) {
  return (
    <label className={cx("sc-search", size === "lg" && "sc-search--lg", className)}>
      <Search size={18} strokeWidth={2.4} aria-hidden="true" />
      <input type="search" {...rest} />
      {hint && (
        <span className="sc-keycap" aria-hidden="true">
          {hint}
        </span>
      )}
    </label>
  );
}
