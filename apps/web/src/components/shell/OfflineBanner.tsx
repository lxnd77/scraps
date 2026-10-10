"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/copy/useT";
import { useSyncStatus } from "@/lib/offline/syncStore";

/**
 * A thin dashed banner under the header the first time the connection drops (SPEC 6.11), and a
 * warning when work has been waiting to sync for more than a day.
 */
export function OfflineBanner() {
  const t = useT();
  const status = useSyncStatus();
  const [shown, setShown] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    const offline = status.kind === "offline";
    if (offline && !wasOffline.current) {
      // first drop of this session
      setShown(true);
    }
    if (!offline && wasOffline.current) setShown(false);
    wasOffline.current = offline;
  }, [status.kind]);

  if (status.stale) {
    return (
      <p role="alert" className="offline-banner offline-banner--warn">
        {t("offline.stale")}
      </p>
    );
  }
  if (!shown) return null;
  return (
    <p role="status" className="offline-banner">
      {t("offline.banner")}
    </p>
  );
}
