/** Recording cap and the warning point (SPEC 9.4). */
export const MAX_RECORD_MS = 5 * 60 * 1000;
export const WARN_RECORD_MS = 4.5 * 60 * 1000;
export const PEAK_COUNT = 96;

/** Opus/WebM where supported, AAC/MP4 on iOS Safari. */
export function pickRecorderMime(
  isSupported: (type: string) => boolean = (t) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
): { mime: string; ext: string } | null {
  const candidates: Array<[string, string]> = [
    ["audio/webm;codecs=opus", "webm"],
    ["audio/webm", "webm"],
    ["audio/mp4", "m4a"],
    ["audio/ogg;codecs=opus", "ogg"],
  ];
  for (const [mime, ext] of candidates) {
    if (isSupported(mime)) return { mime: mime.split(";")[0]!, ext };
  }
  return null;
}

/** Peak (0..1) of a block of float samples in -1..1. */
export function blockPeak(samples: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]!);
    if (v > max) max = v;
  }
  return Math.min(1, max);
}

/**
 * Reduces a long list of per-block peaks to `count` bars (max of each bucket), normalised so the
 * loudest bar is 1. Quiet recordings still draw a readable waveform.
 */
export function reducePeaks(peaks: number[], count = PEAK_COUNT): number[] {
  if (peaks.length === 0) return [];
  const out: number[] = [];
  const size = peaks.length / count;
  for (let i = 0; i < count; i++) {
    const from = Math.min(peaks.length - 1, Math.floor(i * size));
    const to = Math.max(from + 1, Math.floor((i + 1) * size));
    let max = 0;
    for (let j = from; j < Math.min(to, peaks.length); j++) max = Math.max(max, peaks[j]!);
    out.push(max);
  }
  const loudest = Math.max(...out, 0.0001);
  return out.map((v) => Math.round((v / loudest) * 100) / 100);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
