"use client";

import { Button, SpaceDot } from "@scraps/ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/copy/useT";
import { PageHeading } from "@/components/shell/PageHeading";
import { useShell } from "@/components/shell/ShellContext";
import { SpaceDialog } from "@/components/shell/SpaceDialog";

/** The phone's spaces tab; on larger screens the sidebar does this job. */
export function SpacesList() {
  const t = useT();
  const { spaces } = useShell();
  const [creating, setCreating] = useState(false);

  return (
    <div className="page">
      <PageHeading title={t("spaces.title")} />
      <ul className="spaces-list">
        {spaces.map((space) => (
          <li key={space.id}>
            <Link href={`/s/${space.id}`} className="space-card">
              <SpaceDot color={space.color} />
              <span className="space-card__name">{space.name}</span>
              <span className="sc-mono">{space.noteCount}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Button color="yellow" onClick={() => setCreating(true)}>
        <Plus size={20} strokeWidth={3} aria-hidden="true" />
        {t("action.new_space")}
      </Button>
      <SpaceDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
