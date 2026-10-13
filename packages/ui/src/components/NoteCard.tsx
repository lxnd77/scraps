"use client";

import { MoreHorizontal, Pin } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { cx, type CardColor } from "../lib";
import { Card } from "./Card";
import { Sparkle, Tape } from "./Decor";
import { Checkbox } from "./Checkbox";
import { ProgressBar } from "./ProgressBar";
import { Sticker } from "./Sticker";

/**
 * Counts how many times a checklist has just been completed (done reached total from below), so
 * the card can fire a sparkle burst each time. Not on first render and not when the list grows.
 */
function useCompletionBurst(done: number, total: number): number {
  const [bursts, setBursts] = useState(0);
  const previous = useRef({ done, total });
  useEffect(() => {
    const before = previous.current;
    previous.current = { done, total };
    if (total > 0 && total === before.total && done === total && before.done < before.total) {
      setBursts((n) => n + 1);
    }
  }, [done, total]);
  return bursts;
}

const BURST_COLORS = ["yellow", "pink", "ink", "yellow", "pink", "ink"] as const;

function ChecklistBurst({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span key={count} className="sc-burst" aria-hidden="true">
      {BURST_COLORS.map((color, index) => (
        <span key={index} className="sc-burst__spark" style={{ "--i": index } as React.CSSProperties}>
          <Sparkle size={index % 2 ? 12 : 16} color={color} />
        </span>
      ))}
    </span>
  );
}

export type NoteCardKind = "text" | "list" | "pic" | "link" | "voice" | "quote";

export interface NoteCardData {
  id: string;
  title: string;
  previewText: string;
  kind: NoteCardKind;
  color: string;
  pinned: boolean;
  iconSticker?: string | null;
  preview: {
    checklist?: { done: number; total: number; items: Array<{ text: string; done: boolean }> };
    quote?: string;
    imageCount?: number;
    link?: {
      title?: string;
      description?: string;
      domain?: string;
      duration?: number;
      mediaType?: "article" | "video" | "maps";
    };
    voice?: { durationMs?: number; excerpt?: string };
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
  /** the picture, link header or voice player, supplied by the app (signed urls, audio) */
  media?: ReactNode;
  /** plus-N-pics and similar, already formatted */
  extra?: string;
  onToggleItem?: (index: number, checked: boolean) => void;
  onMenu?: (anchor: HTMLElement) => void;
  className?: string;
}

const COLORS: readonly string[] = ["yellow", "lime", "pink", "blue", "lilac", "orange", "surface"];

export function cardColor(color: string): CardColor {
  return (COLORS.includes(color) ? color : "yellow") as CardColor;
}

export type CardVariant = "text" | "list" | "quote" | "pic" | "link" | "voice";

/** The variant a kind renders as (SPEC 8.4). */
export function cardVariant(kind: NoteCardKind): CardVariant {
  return kind;
}

export function NoteCard(props: NoteCardProps) {
  const {
    note,
    tidy,
    meta,
    label,
    labels,
    cheer,
    media,
    extra,
    onToggleItem,
    onMenu,
    className,
    href,
  } = props;
  const Link = props.LinkComponent ?? "a";
  const variant = cardVariant(note.kind);
  const checklist = note.preview.checklist;
  const quote = note.preview.quote || note.title || props.untitled;
  const bursts = useCompletionBurst(checklist?.done ?? 0, checklist?.total ?? 0);

  return (
    <Card
      as="article"
      color={variant === "pic" ? "polaroid" : cardColor(note.color)}
      tidy={tidy}
      tiltKey={note.id}
      className={cx("sc-notecard", `sc-notecard--${variant}`, className)}
      data-note-id={note.id}
      data-kind={note.kind}
    >
      {variant === "pic" && <Tape className="sc-notecard__tape" />}
      {(variant === "pic" || variant === "link") && media && (
        <div className="sc-notecard__media">{media}</div>
      )}
      <div className="sc-notecard__top">
        {label && <span className="sc-notecard__label sc-mono">{label}</span>}
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
            <Sticker id={(note.iconSticker ?? "sparkle") as never} size={56} />
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
            <ChecklistBurst count={bursts} />
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

      {variant === "voice" && media && <div className="sc-notecard__voice">{media}</div>}
      {variant === "voice" && note.preview.voice?.excerpt && (
        <p className="sc-notecard__speech sc-mono">{note.preview.voice.excerpt}</p>
      )}
      {variant === "link" && (
        <>
          {note.preview.link?.domain && (
            <p className="sc-notecard__domain sc-mono">{note.preview.link.domain}</p>
          )}
          {note.preview.link?.description && (
            <p className="sc-notecard__body">{note.preview.link.description}</p>
          )}
        </>
      )}
      {variant === "pic" && extra && <p className="sc-notecard__more-pics sc-mono">{extra}</p>}
      {variant === "text" && note.previewText && (
        <p className="sc-notecard__body">{note.previewText}</p>
      )}

      <p className="sc-notecard__meta sc-mono">
        {variant === "quote" && note.pinned ? labels.forever : meta}
      </p>
    </Card>
  );
}
