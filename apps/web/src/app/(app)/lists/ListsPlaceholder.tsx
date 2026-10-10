"use client";

import { Sticker } from "@scraps/ui";
import { PageHeading } from "@/components/shell/PageHeading";
import { useT } from "@/copy/useT";

// Lists across spaces arrive with the board in Phase 3.
export function ListsPlaceholder() {
  const t = useT();
  return (
    <div className="page">
      <PageHeading title={t("nav.lists")} />
      <div className="board__empty">
        <Sticker id="zzz" size={96} />
        <p className="board__empty-copy">{t("empty.board")}</p>
      </div>
    </div>
  );
}
