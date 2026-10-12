"use client";

import { Button, Dialog } from "@scraps/ui";
import { useState, type ReactNode } from "react";
import type { CopyKey } from "@/copy/en";
import { useT } from "@/copy/useT";
import { collabHttpUrl } from "@/lib/collab";
import { getOutbox } from "@/lib/offline/runtime";
import type { OutboxOp } from "@/lib/offline/outbox";

const KIND: Record<OutboxOp["type"], CopyKey> = {
  createNote: "sync.detail.createNote",
  patchNote: "sync.detail.patchNote",
  tagAdd: "sync.detail.tag",
  tagRemove: "sync.detail.tag",
  toggleChecklist: "sync.detail.toggleChecklist",
  upload: "sync.detail.upload",
};

/**
 * What "couldn't sync. tap for details" opens: the writes the server refused and why, plus which
 * server this app is talking to (a wrong collab address is the usual cause after a deploy).
 * "ok, got it" clears the list, which lets the chip return to saved.
 */
export function SyncDetails({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  // read when it opens; the list only changes when the outbox drops something new
  const failed = open ? getOutbox().snapshot().failed : [];
  let host = "";
  try {
    host = new URL(collabHttpUrl()).host;
  } catch {
    host = collabHttpUrl();
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("sync.detail.title")}>
      <div className="note-menu">
        <p className="field-hint">{t("sync.detail.hint")}</p>
        <ul className="sync-detail__list">
          {failed.map((item, index) => (
            <li key={index} className="sync-detail__row">
              <strong>{t(KIND[item.op.type])}</strong>
              <span className="sc-mono">{item.message}</span>
            </li>
          ))}
        </ul>
        <p className="sc-mono sync-detail__server">{t("sync.detail.server", { host })}</p>
        <div className="space-form__actions">
          <Button
            onClick={() => {
              getOutbox().clearFailed();
              onClose();
            }}
          >
            {t("sync.detail.clear")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** A chip click handler plus the dialog to render next to it. */
export function useSyncDetails(): { open: () => void; dialog: ReactNode } {
  const [isOpen, setOpen] = useState(false);
  return {
    open: () => setOpen(true),
    dialog: <SyncDetails open={isOpen} onClose={() => setOpen(false)} />,
  };
}
