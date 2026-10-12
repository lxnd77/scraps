"use client";

import { SyncChip, type SyncState } from "@scraps/ui";
import { useT } from "@/copy/useT";
import { useSyncStatus } from "@/lib/offline/syncStore";
import { useSyncDetails } from "./SyncDetails";

/** The app-wide sync chip: saved, syncing, offline (saved on this device) or error. */
export function SyncIndicator({ className }: { className?: string }) {
  const t = useT();
  const status = useSyncStatus();
  const details = useSyncDetails();
  const state: SyncState = status.kind;
  const label =
    state === "offline"
      ? t("offline.chip")
      : state === "saved"
        ? t("sync.saved")
        : state === "syncing"
          ? t("sync.syncing")
          : t("sync.error");
  return (
    <>
      <SyncChip
        className={className}
        state={state}
        label={label}
        onClick={state === "error" ? details.open : undefined}
      />
      {details.dialog}
    </>
  );
}
