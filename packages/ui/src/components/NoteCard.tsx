"use client";

import { MoreHorizontal, Pin } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cx, type CardColor } from "../lib";
import { Card } from "./Card";
import { Checkbox } from "./Checkbox";
import { ProgressBar } from "./ProgressBar";
import { Sticker } from "./Sticker";

export type NoteCardKind = "text" | "list" | "pic" | "link" | "voice" | "quote";

export interface NoteCardData {
  id: string;
  title: string;
  previewText: string;
  kind: NoteCardKind;
  color: string;
  pinned: boolean;
  preview: {
    checklist?: { done: number; total: number; items: Array<{ text: string; done: boolean }> };
    quote?: string;
  };
}

export interface NoteCardProps {
  note: NoteCardData;
  href: string;
  /** the framework link component (next/link); a plain anchor by default */
  LinkComponent?: ComponentType<{ href: string; className?: string; children: ReactNode }>;
  tidy?: boolean;
  /** mono footer, already formatted: "2 min ago · 48 words" */
  meta: string;
  /** small label pill: space name or first tag */
  label?: string;
  untitled: string;
  /** all strings are passed in so the package stays copy-free */
  labels: {
    more: string;
    pinned: string;
    forever: string;
    progress: string;
    item: (text: string, done: boolean) => string;
    kind: string;
  };
  cheer?: string;
  onToggleItem?: (index: number, checked: boolean) => void;
  onMenu?: (anchor: HTMLElement) => void;
  className?: string;
}

const COLORS: readonly string[] = ["yellow", "lime", "pink", "blue", "lilac", "orange", "surface"];

export function cardColor(color: string): CardColor {
  return (COLORS.includes(color) ? color : "yellow") as CardColor;
}

/** The variant a kind renders as. pic, link and voice use the plain fallback until Phase 4. */
export function cardVariant(kind: NoteCardKind): "text" | "list" | "quote" | "fallback" {
  switch (kind) {
    case "text":
      return "text";
    case "list":
      return "list";
    case "quote":
      return "quote";
    default:
      return "fallback";
  }
}

export function NoteCard(props: NoteCardProps) {
  const { note, tidy, meta, label, labels, cheer, onToggleItem, onMenu, className, href } = props;
  const Link = props.LinkComponent ?? "a";
  const variant = cardVariant(note.kind);
  const checklist = note.preview.checklist;
  const quote = note.preview.quote || note.title || props.untitled;

  return (
    <Card
      as="article"
      color={cardColor(note.color)}
      tidy={tidy}
      className={cx("sc-notecard", `sc-notecard--${variant}`, className)}
      data-note-id={note.id}
      data-kind={note.kind}
    >
      <div className="sc-notecard__top">
        {label && <span className="sc-notecard__label sc-mono">{label}</span>}
        {variant === "fallback" && (
          <span className="sc-notecard__label sc-mono">{labels.kind}</span>
        )}
        <span className="sc-notecard__spacer" />
        {note.pinned && (
          <span className="sc-notecard__pin">
            <Pin size={16} strokeWidth={2.8} aria-label={labels.pinned} />
          </span>
        )}
        {onMenu && (
          <button
            type="button"
            className="sc-notecard__more"
            aria-label={labels.more}
            aria-haspopup="menu"
            onClick={(event) => onMenu(event.currentTarget)}
          >
            <MoreHorizontal size={20} strokeWidth={2.6} aria-hidden="true" />
          </button>
        )}
      </div>

      {variant === "quote" ? (
        <>
          <span className="sc-notecard__sticker" aria-hidden="true">
            <Sticker id="sparkle" size={56} />
          </span>
          <p className="sc-notecard__quote">
            <Link href={href} className="sc-notecard__link">
              {quote}
            </Link>
          </p>
        </>
      ) : (
        <h2 className="sc-card__title sc-notecard__title">
          <Link href={href} className="sc-notecard__link">
            {note.title || props.untitled}
          </Link>
        </h2>
      )}

      {variant === "list" && checklist && (
        <div className="sc-notecard__checklist">
          <div className="sc-notecard__progress-row">
            <span className="sc-chip sc-chip--count sc-mono">
              {checklist.done}/{checklist.total}
            </span>
            {cheer && <span className="sc-notecard__cheer sc-mono">{cheer}</span>}
          </div>
          <ul className="sc-notecard__items">
            {checklist.items.map((item, index) => (
              <li key={index} className="sc-notecard__item" data-done={item.done}>
                <Checkbox
                  checked={item.done}
                  aria-label={labels.item(item.text, item.done)}
                  onChange={(next) => onToggleItem?.(index, next)}
                />
                <span className="sc-notecard__item-text">{item.text}</span>
              </li>
            ))}
          </ul>
          <ProgressBar
            value={checklist.done}
            max={Math.max(checklist.total, 1)}
            label={labels.progress}
          />
        </div>
      )}

      {(variant === "text" || variant === "fallback") && note.previewText && (
        <p className="sc-notecard__body">{note.previewText}</p>
      )}

      <p className="sc-notecard__meta sc-mono">
        {variant === "quote" && note.pinned ? labels.forever : meta}
      </p>
    </Card>
  );
}
