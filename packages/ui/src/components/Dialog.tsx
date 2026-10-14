"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "../lib";
import { Button } from "./Button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** the dialog's name; shown as its heading unless `heading` replaces it */
  title: string;
  /**
   * Something to show in the heading's place (the capture sheet's title field). The dialog is then
   * named by `title` through aria-label.
   */
  heading?: ReactNode;
  children: ReactNode;
  /** "sheet" slides up from the bottom on phones, "drawer" slides in from the left */
  variant?: "dialog" | "sheet" | "drawer";
  className?: string;
}

/**
 * Modal built on the native <dialog>: focus trap, scrim, Escape closes and
 * focus returns to the opener are all handled by showModal().
 */
export function Dialog({
  open,
  onClose,
  title,
  heading,
  children,
  variant = "dialog",
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    } else if (!open && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
  }, [open]);

  // A click on the backdrop lands on the <dialog> element itself. Escape is already
  // handled natively, so this pointer shortcut needs no keyboard twin.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onBackdropClick = (event: MouseEvent) => {
      if (event.target === el) onClose();
    };
    el.addEventListener("click", onBackdropClick);
    return () => el.removeEventListener("click", onBackdropClick);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={heading ? undefined : titleId}
      aria-label={heading ? title : undefined}
      className={cx(
        "sc-dialog",
        variant === "sheet" && "sc-dialog--sheet",
        variant === "drawer" && "sc-dialog--drawer",
        className,
      )}
      onClose={onClose}
    >
      {variant === "sheet" && <div className="sc-grab" aria-hidden="true" />}
      <div className="sc-dialog__head">
        {heading ?? (
          <h2 id={titleId} className="sc-dialog__title">
            {title}
          </h2>
        )}
        <Button variant="icon" size="sm" aria-label="close" data-tip-align="end" onClick={onClose}>
          <X size={20} strokeWidth={2.6} aria-hidden="true" />
        </Button>
      </div>
      <div className="sc-dialog__body">{children}</div>
    </dialog>
  );
}

export function Sheet(props: Omit<DialogProps, "variant">) {
  return <Dialog {...props} variant="sheet" />;
}
