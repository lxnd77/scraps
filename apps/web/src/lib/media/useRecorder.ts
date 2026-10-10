"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_RECORD_MS, PEAK_COUNT, blockPeak, pickRecorderMime, reducePeaks } from "./audio";
import { uploadAudio } from "./upload";

export interface RecordingResult {
  assetId: string;
  path: string;
  durationMs: number;
  peaks: number[];
}

type RecorderState = "idle" | "starting" | "recording" | "saving" | "denied" | "error";

/**
 * MediaRecorder with live peaks for the waveform. Format is chosen by what the browser can
 * encode (Opus/WebM, or AAC/MP4 on iOS Safari). Capped at five minutes (SPEC 9.4).
 */
export function useRecorder(noteId: string, spaceId: string) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [livePeaks, setLivePeaks] = useState<number[]>([]);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const chunks = useRef<Blob[]>([]);
  const allPeaks = useRef<number[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const sampler = useRef<number | null>(null);
  const finish = useRef<((r: RecordingResult | null) => void) | null>(null);
  const cancelled = useRef(false);

  const cleanup = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    if (sampler.current) window.clearInterval(sampler.current);
    timer.current = null;
    sampler.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void context.current?.close().catch(() => {});
    context.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    const format = pickRecorderMime();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      setState("error");
      return;
    }
    setState("starting");
    cancelled.current = false;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;

      const ctx = new AudioContext();
      context.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(media).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);

      chunks.current = [];
      allPeaks.current = [];
      setLivePeaks([]);
      setElapsedMs(0);

      const rec = new MediaRecorder(media, { mimeType: format.mime });
      recorder.current = rec;
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        const durationMs = Math.min(Date.now() - startedAt.current, MAX_RECORD_MS);
        cleanup();
        if (cancelled.current) {
          finish.current?.(null);
          setState("idle");
          return;
        }
        const blob = new Blob(chunks.current, { type: format.mime });
        const peaks = reducePeaks(allPeaks.current, PEAK_COUNT);
        setState("saving");
        uploadAudio(noteId, spaceId, {
          blob,
          mime: format.mime,
          ext: format.ext,
          durationMs,
          peaks,
        })
          .then((up) => {
            setState("idle");
            finish.current?.({ ...up, peaks });
          })
          .catch(() => {
            setState("error");
            finish.current?.(null);
          });
      };

      rec.start(250);
      startedAt.current = Date.now();
      setState("recording");

      timer.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt.current;
        setElapsedMs(elapsed);
        if (elapsed >= MAX_RECORD_MS && rec.state === "recording") rec.stop();
      }, 200);
      sampler.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(buffer);
        const peak = blockPeak(buffer);
        allPeaks.current.push(peak);
        setLivePeaks((p) => [...p.slice(-127), peak]);
      }, 100);
    } catch (error) {
      cleanup();
      const name = error instanceof DOMException ? error.name : "";
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
    }
  }, [cleanup, noteId, spaceId]);

  const stop = useCallback(() => {
    return new Promise<RecordingResult | null>((resolve) => {
      const rec = recorder.current;
      if (!rec || rec.state !== "recording") return resolve(null);
      finish.current = resolve;
      rec.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    const rec = recorder.current;
    if (rec && rec.state === "recording") rec.stop();
    else cleanup();
    setState("idle");
  }, [cleanup]);

  return { state, elapsedMs, peaks: livePeaks, start, stop, cancel };
}
