// Orchestration of one `ai-sort` call (SPEC 9.5) against a small store interface, so the order of
// the checks and the handling of bad model output can be tested with an in-memory store and a
// mocked fetch. The Supabase-backed store is in ./aiSortStore.ts. Note content is never logged.
import {
  AI_SORT_MODEL,
  SYSTEM_PROMPT,
  buildSortInput,
  buildUserMessage,
  parseModelOutput,
  toSuggestion,
  type SortSpace,
  type Suggestion,
} from "./aiSort.ts";

export interface SortContext {
  aiEnabled: boolean;
  /** the person may move and tag this note (owner or editor of its space) */
  canWrite: boolean;
  note: {
    spaceId: string;
    title: string;
    text: string;
    linkTitle?: string | null;
    linkDomain?: string | null;
    transcript?: string | null;
  };
  /** spaces the person can write to */
  spaces: SortSpace[];
  /** tag names, the scrap's own space first */
  tags: string[];
}

export interface SortStore {
  /** null when the note does not exist or the person has no access to it */
  loadContext(userId: string, noteId: string): Promise<SortContext | null>;
  /** false once the person is over 60 calls this hour */
  takeSlot(userId: string): Promise<boolean>;
  /** replaces any pending suggestion for the note and stores this one */
  saveSuggestion(row: {
    noteId: string;
    userId: string;
    spaceId: string | null;
    tags: string[];
    title: string | null;
    confidence: number;
    model: string;
  }): Promise<{ id: string; createdAt: string }>;
}

export interface StoredSuggestion extends Suggestion {
  id: string;
  noteId: string;
  createdAt: string;
}

/**
 * Why a request ended without a suggestion: an empty scrap, a failed model call, an answer that
 * did not parse, or a parsed answer that was too unsure or changed nothing. It goes back to the
 * caller so "nothing to suggest" can be told apart from a fault; it never carries note content.
 */
export type NoSuggestionReason = "empty" | "model_error" | "bad_output" | "unsure";

export type SortResult =
  | { status: "ok"; suggestion: StoredSuggestion }
  | { status: "ok"; suggestion: null; reason: NoSuggestionReason; detail?: string }
  // "unconfigured": the server has no ANTHROPIC_API_KEY, a setup problem rather than a user one
  | { status: "disabled" | "rate_limited" | "not_found" | "forbidden" | "unconfigured" };

export interface SortOptions {
  apiKey: string | undefined | null;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** The model's text answer, or a short description of what failed (it never throws). */
export async function askClaude(
  system: string,
  user: string,
  options: SortOptions,
): Promise<{ text: string } | { error: string }> {
  if (!options.apiKey) return { error: "no api key" };
  try {
    const response = await (options.fetch ?? fetch)("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": options.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_SORT_MODEL,
        max_tokens: 300,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
    if (!response.ok) return { error: `anthropic answered ${response.status}` };
    const body = (await response.json().catch(() => null)) as {
      content?: Array<{ type?: string; text?: unknown }>;
    } | null;
    const block = body?.content?.find((c) => c.type === "text");
    return typeof block?.text === "string" ? { text: block.text } : { error: "no text block" };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return { error: timedOut ? "timed out" : "network error" };
  }
}

export async function runAiSort(
  store: SortStore,
  userId: string,
  noteId: string,
  options: SortOptions,
): Promise<SortResult> {
  const context = await store.loadContext(userId, noteId);
  if (!context) return { status: "not_found" };
  // the setting is checked here, on the server, before anything else costs money or leaves
  if (!context.aiEnabled) return { status: "disabled" };
  if (!context.canWrite) return { status: "forbidden" };

  const input = buildSortInput({
    note: {
      title: context.note.title,
      text: context.note.text,
      linkTitle: context.note.linkTitle,
      linkDomain: context.note.linkDomain,
      transcript: context.note.transcript,
    },
    spaces: context.spaces,
    tags: context.tags,
  });
  // nothing to read, nothing to ask
  if (!input.title && !input.text && !input.link && !input.transcript) {
    return { status: "ok", suggestion: null, reason: "empty" };
  }
  // before the rate limit, so a missing key does not use up the person's requests
  if (!options.apiKey) return { status: "unconfigured" };

  if (!(await store.takeSlot(userId))) return { status: "rate_limited" };

  const answer = await askClaude(SYSTEM_PROMPT, buildUserMessage(input), options);
  if ("error" in answer) {
    return { status: "ok", suggestion: null, reason: "model_error", detail: answer.error };
  }
  const output = parseModelOutput(answer.text);
  if (!output) return { status: "ok", suggestion: null, reason: "bad_output" };
  const suggestion = toSuggestion(output, {
    writableSpaceIds: new Set(context.spaces.map((s) => s.id)),
    currentSpaceId: context.note.spaceId,
    existingTags: input.tags,
    hasTitle: input.title.length > 0,
  });
  if (!suggestion) return { status: "ok", suggestion: null, reason: "unsure" };

  const saved = await store.saveSuggestion({
    noteId,
    userId,
    spaceId: suggestion.spaceId,
    tags: suggestion.tags,
    title: suggestion.title,
    confidence: suggestion.confidence,
    model: AI_SORT_MODEL,
  });
  return {
    status: "ok",
    suggestion: { ...suggestion, id: saved.id, noteId, createdAt: saved.createdAt },
  };
}
