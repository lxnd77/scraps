// Speech-to-text behind one interface (SPEC 9.4). No Deno or Node APIs beyond fetch, Blob and
// FormData, so the unit tests import it through packages/db like the other shared helpers.

export interface TranscriptionResult {
  text: string;
  language?: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(audio: Blob, mime: string, languageHint?: string): Promise<TranscriptionResult>;
}

/** `retryable` says whether trying the same audio again could succeed (network, 429, 5xx). */
export class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

/** Deterministic provider for tests and local runs without a vendor key. */
export class FakeProvider implements TranscriptionProvider {
  readonly name = "fake";
  readonly calls: Array<{ bytes: number; mime: string; languageHint?: string }> = [];

  constructor(private readonly text = "remember to book the train tickets for the goa trip") {}

  async transcribe(audio: Blob, mime: string, languageHint?: string): Promise<TranscriptionResult> {
    this.calls.push({ bytes: audio.size, mime, languageHint });
    if (audio.size === 0) throw new TranscriptionError("empty audio", false);
    return { text: this.text, language: languageHint ?? "en" };
  }
}

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/** File name the vendor sniffs the container from: `memo.webm` for `audio/webm;codecs=opus`. */
export function audioFileName(mime: string): string {
  const base = mime.split(";")[0]!.trim().toLowerCase();
  return `memo.${EXTENSIONS[base] ?? "webm"}`;
}

export interface HttpProviderConfig {
  name: string;
  url: string;
  model: string;
  apiKey: string;
  fetch?: typeof fetch;
  /** one request, so a hung vendor cannot hold the function open */
  timeoutMs?: number;
}

/** Any OpenAI-compatible `audio/transcriptions` endpoint (Groq and OpenAI share the shape). */
export class HttpTranscriptionProvider implements TranscriptionProvider {
  readonly name: string;

  constructor(private readonly config: HttpProviderConfig) {
    this.name = config.name;
  }

  async transcribe(audio: Blob, mime: string, languageHint?: string): Promise<TranscriptionResult> {
    const form = new FormData();
    form.set("file", new File([audio], audioFileName(mime), { type: mime }));
    form.set("model", this.config.model);
    form.set("response_format", "verbose_json");
    form.set("temperature", "0");
    if (languageHint) form.set("language", languageHint);

    let response: Response;
    try {
      response = await (this.config.fetch ?? fetch)(this.config.url, {
        method: "POST",
        headers: { authorization: `Bearer ${this.config.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 60_000),
      });
    } catch {
      throw new TranscriptionError("transcription request failed", true);
    }

    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new TranscriptionError(`transcription provider answered ${response.status}`, retryable);
    }

    const body = (await response.json().catch(() => null)) as {
      text?: unknown;
      language?: unknown;
    } | null;
    if (!body || typeof body.text !== "string") {
      throw new TranscriptionError("transcription provider sent no text", false);
    }
    return {
      text: body.text.trim(),
      language: typeof body.language === "string" ? body.language : undefined,
    };
  }
}

export type ProviderName = "groq" | "openai" | "fake";

export function parseProviderName(value: string | undefined | null): ProviderName {
  const v = (value ?? "").trim().toLowerCase();
  return v === "openai" || v === "fake" ? v : "groq";
}

/** Builds the provider `TRANSCRIPTION_PROVIDER` names. Returns null when a vendor has no key. */
export function createProvider(
  env: { provider?: string | null; apiKey?: string | null },
  options: { fetch?: typeof fetch; fakeText?: string } = {},
): TranscriptionProvider | null {
  const name = parseProviderName(env.provider);
  if (name === "fake") return new FakeProvider(options.fakeText);
  if (!env.apiKey) return null;
  if (name === "openai") {
    return new HttpTranscriptionProvider({
      name,
      url: "https://api.openai.com/v1/audio/transcriptions",
      model: "gpt-4o-mini-transcribe",
      apiKey: env.apiKey,
      fetch: options.fetch,
    });
  }
  return new HttpTranscriptionProvider({
    name,
    url: "https://api.groq.com/openai/v1/audio/transcriptions",
    model: "whisper-large-v3-turbo",
    apiKey: env.apiKey,
    fetch: options.fetch,
  });
}

/**
 * Runs `fn`, retrying twice (SPEC 8.2) with doubling backoff while the error says it is worth it.
 * `sleep` is injectable so tests do not wait.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; baseMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const baseMs = options.baseMs ?? 1000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const retryable = error instanceof TranscriptionError ? error.retryable : true;
      if (!retryable || attempt >= retries) throw error;
      await sleep(baseMs * 2 ** attempt);
    }
  }
}
