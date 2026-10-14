"use client";

import { SyncChip } from "@scraps/ui";
import { useT } from "@/copy/useT";
import { syncChipShown } from "@/lib/offline/syncStatus";
import { useSyncStatus } from "@/lib/offline/syncStore";
import { useSyncDetails } from "./SyncDetails";

/**
 * The app-wide sync chip. Quiet while all is well (saved or syncing); it shows only for "still
 * saving…", offline (saved on this device) and an error.
 */
export function SyncIndicator({ className }: { className?: string }) {
  const t = useT();
  const status = useSyncStatus();
  const details = useSyncDetails();
  const state = status.kind;
  if (!syncChipShown(state)) return details.dialog;
  const label =
    state === "offline" ? t("offline.chip") : state === "slow" ? t("sync.slow") : t("sync.error");
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
