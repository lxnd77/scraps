import type { ReactNode } from "react";
import { cx } from "../lib";

export interface ToastProps {
  children: ReactNode;
  /** "suggestion" is the AI file-under toast with accept and dismiss */
  variant?: "default" | "suggestion";
  acceptLabel?: string;
  dismissLabel?: string;
  onAccept?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/** Position it from the caller: bottom-centre on phone, bottom-right on desktop. */
export function Toast({
  children,
  variant = "default",
  acceptLabel = "yes",
  dismissLabel = "nah",
  onAccept,
  onDismiss,
  className,
}: ToastProps) {
  return (
    <div
      role="status"
      className={cx("sc-toast", variant === "suggestion" && "sc-toast--suggestion", className)}
    >
      <span className="sc-toast__msg">{children}</span>
      {variant === "suggestion" && (
        <span className="sc-toast__actions">
          <button type="button" className="sc-toast__btn" onClick={onAccept}>
            {acceptLabel}
          </button>
          <button type="button" className="sc-toast__btn sc-toast__btn--quiet" onClick={onDismiss}>
            {dismissLabel}
          </button>
        </span>
      )}
    </div>
  );
}
