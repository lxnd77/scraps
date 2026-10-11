"use client";

import { describeStorage, getStorageUsage, type StorageUsage } from "@scraps/db";
import { useQuery } from "@tanstack/react-query";
import { useT } from "@/copy/useT";
import { createClient } from "@/lib/supabase/client";

function megabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 100 ? String(Math.round(mb)) : mb.toFixed(1);
}

/** Storage used against the soft limit (DECISIONS question 4). A warning only, nothing blocks. */
export function StorageMeter() {
  const t = useT();
  const { data } = useQuery<StorageUsage>({
    queryKey: ["storage-usage"],
    queryFn: () => getStorageUsage(createClient()),
    staleTime: 60_000,
  });
  const usage = data ?? describeStorage(0);

  return (
    <div className="storage">
      <p className="switch-row__title" id="storage-title">
        {t("storage.title")}
      </p>
      <div
        role="meter"
        aria-labelledby="storage-title"
        aria-valuemin={0}
        aria-valuemax={usage.limitBytes}
        aria-valuenow={usage.usedBytes}
        aria-valuetext={t("storage.used", {
          used: megabytes(usage.usedBytes),
          limit: megabytes(usage.limitBytes),
        })}
        className="storage__bar"
        data-state={usage.state}
      >
        <span className="storage__fill" style={{ width: `${Math.round(usage.fraction * 100)}%` }} />
      </div>
      <p className="sc-mono">
        {t("storage.used", {
          used: megabytes(usage.usedBytes),
          limit: megabytes(usage.limitBytes),
        })}
      </p>
      {usage.state !== "ok" && (
        <p role="status" className="field-hint">
          {usage.state === "over" ? t("storage.over") : t("storage.warn")}
        </p>
      )}
    </div>
  );
}
