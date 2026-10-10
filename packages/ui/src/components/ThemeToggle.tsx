import { cx } from "../lib";

export interface ThemeToggleProps {
  /** true when the resolved theme is after midnight */
  isMidnight: boolean;
  /** called with the explicit theme the user picked */
  onToggle: (next: "day" | "midnight") => void;
  /** lg is 96 x 52 (desktop board), md is 78 x 44 (editor bar, phone home) */
  size?: "lg" | "md";
  className?: string;
}

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
    </svg>
  );
}

/** Sun/moon switch that lives in the header. Tapping sets an explicit day or midnight. */
export function ThemeToggle({ isMidnight, onToggle, size = "lg", className }: ThemeToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isMidnight}
      aria-label="after midnight"
      className={cx("sc-toggle", size === "md" && "sc-toggle--md", className)}
      onClick={() => onToggle(isMidnight ? "day" : "midnight")}
    >
      <span className="sc-toggle__knob" aria-hidden="true" />
      <span className="sc-toggle__icon sc-toggle__sun">
        <SunIcon />
      </span>
      <span className="sc-toggle__icon sc-toggle__moon">
        <MoonIcon />
      </span>
    </button>
  );
}
