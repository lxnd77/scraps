"use client";

import {
  AvatarStack,
  BrandMark,
  Button,
  SpaceDot,
  SyncChip,
  type StickerId,
  type SyncState,
} from "@scraps/ui";
import type { AwarenessUser } from "@/lib/presence";
import type { SpaceSummary } from "@scraps/db";
import { ChevronLeft, MoreHorizontal, Share2 } from "lucide-react";
import Link from "next/link";
import { useSyncDetails } from "@/components/shell/SyncDetails";
import { useT } from "@/copy/useT";
import { HeaderThemeToggle } from "@/theme/HeaderThemeToggle";

interface Props {
  space: Pick<SpaceSummary, "id" | "name" | "color">;
  title: string;
  syncState: SyncState;
  viewOnly: boolean;
  onMore: () => void;
  onShare: () => void;
  /** who is in the note right now, yourself first */
  people?: AwarenessUser[];
}

/**
 * Editor header. Desktop: brand, breadcrumb, then toggle, sync chip, share and more.
 * Phone (SPEC 6.5 sub-screen): back button, space label and more; no toggle.
 */
export function NoteTopBar({
  space,
  title,
  syncState,
  viewOnly,
  onMore,
  onShare,
  people = [],
}: Props) {
  const t = useT();
  const details = useSyncDetails();
  const shown = title.trim() || t("note.untitled");

  return (
    <header className="notebar">
      <Link
        href={`/s/${space.id}`}
        className="notebar__back"
        aria-label={t("note.back", { space: space.name })}
      >
        <ChevronLeft size={24} strokeWidth={2.8} aria-hidden="true" />
      </Link>

      <Link href="/" className="notebar__brand" aria-label="scraps. home">
        <BrandMark size={40} />
      </Link>

      <nav aria-label="breadcrumb" className="notebar__crumbs">
        <Link href={`/s/${space.id}`} className="notebar__space">
          <SpaceDot color={space.color} />
          <span>{space.name}</span>
        </Link>
        <span aria-hidden="true" className="notebar__slash">
          /
        </span>
        <span aria-current="page" className="notebar__title">
          {shown}
        </span>
      </nav>

      <div className="notebar__actions">
        {viewOnly && <span className="notebar__viewonly sc-label">{t("note.view_only")}</span>}
        <span className="notebar__toggle">
          <HeaderThemeToggle size="md" />
        </span>
        <SyncChip
          state={syncState}
          label={syncState === "offline" ? t("offline.chip") : undefined}
          onClick={syncState === "error" ? details.open : undefined}
        />
        {details.dialog}
        {people.length > 0 && (
          <AvatarStack
            className="notebar__people"
            people={people.map((p) => ({
              name: p.name,
              color: p.color,
              sticker: p.sticker as StickerId | undefined,
            }))}
            max={3}
            size={36}
          />
        )}
        <span className="notebar__share">
          <Button variant="dark" onClick={onShare}>
            <Share2 size={18} strokeWidth={2.6} aria-hidden="true" />
            {t("note.share")}
          </Button>
        </span>
        {!viewOnly && (
          <Button variant="icon" size="sm" aria-label={t("note.more")} onClick={onMore}>
            <MoreHorizontal size={20} strokeWidth={2.6} aria-hidden="true" />
          </Button>
        )}
      </div>
    </header>
  );
}
