"use client";

import { Skeleton } from "@scraps/ui";
import { useParams } from "next/navigation";
import { useShell } from "@/components/shell/ShellContext";
import { useT } from "@/copy/useT";

/**
 * Shown the moment a space is clicked, while the server loads its board. The space name is
 * already in the shell, so the header is real and only the cards are placeholders.
 */
export default function SpaceLoading() {
  const t = useT();
  const { spaceId } = useParams<{ spaceId: string }>();
  const space = useShell().spaces.find((s) => s.id === spaceId);
  return (
    <div className="board" aria-busy="true">
      <header className="board__header">
        <div className="board__heading">
          <p className="sc-label board__kicker">{space?.name ?? ""}</p>
          <Skeleton height={44} className="board__skeleton-title" />
        </div>
      </header>
      <div aria-label={t("board.loading")} className="board__grid">
        {[190, 140, 230, 160, 200, 150].map((h, i) => (
          <Skeleton key={i} height={h} className="board__skeleton" />
        ))}
      </div>
    </div>
  );
}
