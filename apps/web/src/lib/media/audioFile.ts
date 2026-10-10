import { MAX_RECORD_MS, PEAK_COUNT, blockPeak, reducePeaks } from "./audio";
import type { RecordedClip } from "./useRecorder";

/** What the `media` bucket accepts (migrations phase4 and audio_wav), by browser-reported type. */
const AUDIO_TYPES: Record<string, { mime: string; ext: string }> = {
  "audio/webm": { mime: "audio/webm", ext: "webm" },
  "audio/mp4": { mime: "audio/mp4", ext: "m4a" },
  "audio/x-m4a": { mime: "audio/mp4", ext: "m4a" },
  "audio/m4a": { mime: "audio/mp4", ext: "m4a" },
  "audio/aac": { mime: "audio/aac", ext: "aac" },
  "audio/ogg": { mime: "audio/ogg", ext: "ogg" },
  "audio/mpeg": { mime: "audio/mpeg", ext: "mp3" },
  "audio/wav": { mime: "audio/wav", ext: "wav" },
  "audio/x-wav": { mime: "audio/wav", ext: "wav" },
};

export class AudioFileError extends Error {
  constructor(readonly problem: "type" | "too_long" | "unreadable") {
    super(problem);
  }
}

/** The stored mime and extension for a shared audio file, or null when it cannot be kept. */
export function audioFormat(type: string): { mime: string; ext: string } | null {
  return AUDIO_TYPES[type.toLowerCase().split(";")[0]!.trim()] ?? null;
}

/**
 * Turns a shared audio file into the same clip shape the recorder produces (duration and waveform
 * peaks come from decoding it), so it follows the normal voice-memo path.
 */
export async function clipFromFile(file: File): Promise<RecordedClip> {
  const format = audioFormat(file.type);
  if (!format) throw new AudioFileError("type");

  let decoded: AudioBuffer;
  try {
    const Context = window.AudioContext;
    const context = new Context();
    try {
      decoded = await context.decodeAudioData(await file.arrayBuffer());
    } finally {
      void context.close();
    }
  } catch {
    throw new AudioFileError("unreadable");
  }

  const durationMs = Math.round(decoded.duration * 1000);
  if (durationMs > MAX_RECORD_MS) throw new AudioFileError("too_long");

  const samples = decoded.getChannelData(0);
  const blocks = PEAK_COUNT * 4;
  const size = Math.max(1, Math.floor(samples.length / blocks));
  const raw: number[] = [];
  for (let at = 0; at < samples.length; at += size) {
    raw.push(blockPeak(samples.subarray(at, Math.min(samples.length, at + size))));
  }
  return { blob: file, mime: format.mime, ext: format.ext, durationMs, peaks: reducePeaks(raw) };
}
