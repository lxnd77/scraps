"use client";

import { scrubEvent } from "@scraps/db";
import { useEffect } from "react";

/**
 * Error monitoring (Phase 9.8). A no-op, and nothing is downloaded, unless NEXT_PUBLIC_SENTRY_DSN
 * is set. Every event and breadcrumb passes through scrubEvent first, so scrap text, titles,
 * tokens, emails and query strings never leave the browser.
 */
export function Monitoring() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    let cancelled = false;
    void import("@sentry/browser").then((Sentry) => {
      if (cancelled) return;
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
        tracesSampleRate: 0,
        // an unattended page should not keep a trail of what someone typed or clicked
        beforeSend: (event) => scrubEvent(event),
        beforeBreadcrumb: (breadcrumb) =>
          breadcrumb.category === "ui.input" ? null : scrubEvent(breadcrumb),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
