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

export type SortResult =
  | { status: "ok"; suggestion: StoredSuggestion | null }
  | { status: "disabled" | "rate_limited" | "not_found" | "forbidden" };

export interface SortOptions {
  apiKey: string | undefined | null;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** The model's text answer, or null on any failure (it never throws). */
export async function askClaude(
  system: string,
  user: string,
  options: SortOptions,
): Promise<string | null> {
  if (!options.apiKey) return null;
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
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as {
      content?: Array<{ type?: string; text?: unknown }>;
    } | null;
    const block = body?.content?.find((c) => c.type === "text");
    return typeof block?.text === "string" ? block.text : null;
  } catch {
    return null;
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
    return { status: "ok", suggestion: null };
  }

  if (!(await store.takeSlot(userId))) return { status: "rate_limited" };

  const answer = await askClaude(SYSTEM_PROMPT, buildUserMessage(input), options);
  const suggestion = toSuggestion(parseModelOutput(answer), {
    writableSpaceIds: new Set(context.spaces.map((s) => s.id)),
    currentSpaceId: context.note.spaceId,
    existingTags: input.tags,
    hasTitle: input.title.length > 0,
  });
  if (!suggestion) return { status: "ok", suggestion: null };

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
