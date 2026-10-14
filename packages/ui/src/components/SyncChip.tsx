import { AlertTriangle, Check, CloudOff, RefreshCw } from "lucide-react";
import { cx } from "../lib";

export type SyncState = "saved" | "syncing" | "slow" | "offline" | "error";

const DEFAULT_LABEL: Record<SyncState, string> = {
  saved: "saved",
  syncing: "syncing…",
  slow: "still saving…",
  offline: "offline · saved on this device",
  error: "couldn't sync. tap for details",
};

const ICON = {
  saved: Check,
  syncing: RefreshCw,
  slow: RefreshCw,
  offline: CloudOff,
  error: AlertTriangle,
} as const;

export interface SyncChipProps {
  state: SyncState;
  /** override the default copy (comes from the copy module in the app) */
  label?: string;
  className?: string;
  /** makes the chip a button (used for the error state, which opens the details) */
  onClick?: () => void;
}

export function SyncChip({ state, label, className, onClick }: SyncChipProps) {
  const Icon = ICON[state];
  if (onClick) {
    return (
      <button
        type="button"
        className={cx("sc-sync sc-sync--action", `sc-sync--${state}`, className)}
        onClick={onClick}
        aria-haspopup="dialog"
      >
        <Icon size={16} strokeWidth={2.6} aria-hidden="true" />
        <span className="sc-sync__label">{label ?? DEFAULT_LABEL[state]}</span>
      </button>
    );
  }
  return (
    <span role="status" className={cx("sc-sync", `sc-sync--${state}`, className)}>
      <Icon size={16} strokeWidth={2.6} aria-hidden="true" />
      <span className="sc-sync__label">{label ?? DEFAULT_LABEL[state]}</span>
    </span>
  );
}
