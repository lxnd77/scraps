// Minimal error reporting for Edge Functions (Phase 9.8): one fetch to Sentry's store endpoint,
// only when SENTRY_DSN is set. It sends the function name, a static `where` and the error class,
// never the message (which could carry content) and never a request.

export async function reportError(
  dsn: string | undefined | null,
  fn: string,
  where: string,
  error: unknown,
): Promise<void> {
  if (!dsn) return;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    const key = url.username;
    if (!projectId || !key) return;
    const name = error instanceof Error ? error.name : typeof error;
    await fetch(
      `${url.protocol}//${url.host}/api/${projectId}/store/?sentry_version=7&sentry_key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: `${fn}: ${where} (${name})`,
          level: "error",
          platform: "javascript",
          logger: "edge-function",
          tags: { function: fn, where },
          timestamp: Math.floor(Date.now() / 1000),
        }),
        signal: AbortSignal.timeout(3000),
      },
    );
  } catch {
    // reporting must never break the request it is reporting on
  }
}
