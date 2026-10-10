import { PermanentError, TransientError } from "./outbox";

/**
 * Decides whether a failed write is worth retrying.
 * Network failures and server trouble are transient; so is 401 (an expired token is refreshed
 * by the next attempt). Everything else the server said no to is permanent.
 */
export function classifyStatus(status: number | undefined | null): "transient" | "permanent" {
  if (!status) return "transient"; // no response at all
  if (status === 401 || status === 408 || status === 425 || status === 429) return "transient";
  if (status >= 500) return "transient";
  return "permanent";
}

export function errorFor(status: number | undefined | null, message: string): Error {
  return classifyStatus(status) === "transient"
    ? new TransientError(message)
    : new PermanentError(message);
}

/** Anything thrown by fetch itself (offline, DNS, CORS) is transient. */
export function fromThrown(error: unknown): Error {
  if (error instanceof TransientError || error instanceof PermanentError) return error;
  const status = (error as { status?: number } | null)?.status;
  const message = error instanceof Error ? error.message : String(error);
  return errorFor(status, message);
}
