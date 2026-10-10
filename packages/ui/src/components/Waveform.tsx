import { cx } from "../lib";

export interface WaveformProps {
  /** bar heights in px, or any positive numbers (normalised against the max) */
  peaks: number[];
  /** playback progress, 0 to 1 */
  progress?: number;
  height?: number;
  className?: string;
}

/** Bars from stored peaks: 4px wide, 3px gap. Colour comes from currentColor. */
export function Waveform({ peaks, progress = 0, height = 40, className }: WaveformProps) {
  const max = Math.max(1, ...peaks);
  const playedUpTo = Math.round(progress * peaks.length);
  return (
    <div aria-hidden="true" className={cx("sc-waveform", className)} style={{ height }}>
      {peaks.map((peak, index) => (
        <span
          // peaks are positional and never reorder
          key={index}
          className="sc-waveform__bar"
          data-played={index < playedUpTo}
          style={{ height: Math.max(4, Math.round((peak / max) * height)) }}
        />
      ))}
    </div>
  );
}
