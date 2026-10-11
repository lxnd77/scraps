import { scrubEvent } from "@scraps/db";

/**
 * Error monitoring for the collab server (Phase 9.8). A no-op without SENTRY_DSN. Uses one fetch
 * to Sentry's store endpoint rather than the Node SDK, which pulls in an OpenTelemetry tree this
 * process does not need. Only the structured log's static message and a scrubbed copy of its
 * fields are sent: log entries carry ids and counts, never content.
 */
export function initMonitoring(dsn: string | undefined): (entry: Record<string, unknown>) => void {
  if (!dsn) return () => {};
  let target: { url: string } | null = null;
  try {
    const parsed = new URL(dsn);
    const projectId = parsed.pathname.replace(/^\//, "");
    if (projectId && parsed.username) {
      target = {
        url: `${parsed.protocol}//${parsed.host}/api/${projectId}/store/?sentry_version=7&sentry_key=${parsed.username}`,
      };
    }
  } catch {
    target = null;
  }
  if (!target) return () => {};
  const { url } = target;

  const send = (message: string, extra: Record<string, unknown>) => {
    const event = scrubEvent({
      message,
      level: "error",
      platform: "node",
      logger: "collab",
      environment: process.env.APP_ENV ?? "production",
      extra,
      timestamp: Math.floor(Date.now() / 1000),
    });
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  };

  process.on("uncaughtException", (error) => send("uncaughtException", { name: error.name }));
  process.on("unhandledRejection", (reason) =>
    send("unhandledRejection", { name: reason instanceof Error ? reason.name : typeof reason }),
  );

  return (entry) => {
    if (entry.level === "error") send(String(entry.msg ?? "error"), entry);
  };
}
