"use client";

import { Button, Dialog } from "@scraps/ui";
import { LayoutGrid, List, Pencil, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useT } from "@/copy/useT";
import type { BoardLayout } from "@/lib/layout";

/**
 * The board header's actions for phones and tablets, where the header has no room for them:
 * switch layout, share, trash and (owners) edit space. Same shape as a card's menu.
 */
export function SpaceMenu({
  open,
  onClose,
  title,
  spaceId,
  layout,
  onToggleLayout,
  onShare,
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  spaceId: string;
  layout: BoardLayout;
  onToggleLayout: () => void;
  onShare: () => void;
  /** owners only */
  onEdit?: () => void;
}) {
  const t = useT();
  const then = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="note-menu">
        <Button variant="ghost" onClick={then(onToggleLayout)}>
          {layout === "cards" ? (
            <List size={18} strokeWidth={2.6} aria-hidden="true" />
          ) : (
            <LayoutGrid size={18} strokeWidth={2.6} aria-hidden="true" />
          )}
          {layout === "cards" ? t("board.layout.list") : t("board.layout.cards")}
        </Button>
        <Button variant="ghost" onClick={then(onShare)}>
          <Share2 size={18} strokeWidth={2.6} aria-hidden="true" />
          {t("share.open")}
        </Button>
        {onEdit && (
          <Button variant="ghost" onClick={then(onEdit)}>
            <Pencil size={18} strokeWidth={2.6} aria-hidden="true" />
            {t("spaces.edit")}
          </Button>
        )}
        <Link href={`/s/${spaceId}/trash`} className="sc-btn sc-btn--ghost" onClick={onClose}>
          <Trash2 size={18} strokeWidth={2.6} aria-hidden="true" />
          {t("trash.link")}
        </Link>
      </div>
    </Dialog>
  );
}
