"use client";

import { createContext, useContext } from "react";

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  duration: number | null;
  domain: string | null;
  mediaType: "article" | "video" | "maps";
  pin: { lat: number; lng: number } | null;
}

export interface UploadedImageInfo {
  assetId: string;
  path: string;
  width: number;
  height: number;
  color: string;
}

export interface RecordingResult {
  assetId: string;
  path: string;
  durationMs: number;
  peaks: number[];
}

/** Where a voice memo's transcript is (SPEC 9.4). It is rendered from the asset row, not the document. */
export interface TranscriptState {
  status: "none" | "pending" | "done" | "failed";
  text: string | null;
}

export interface RecorderApi {
  state: "idle" | "starting" | "recording" | "saving" | "denied" | "error";
  elapsedMs: number;
  /** live bars, 0..1, newest last */
  peaks: number[];
  start: () => Promise<void>;
  /** stops, uploads and resolves with the stored asset; null when cancelled */
  stop: () => Promise<RecordingResult | null>;
  cancel: () => void;
}

/**
 * What the editor needs from the app for media: uploads, signed urls, link unfurling and the
 * recorder. The editor package stays free of Supabase; the web app supplies these.
 */
export interface MediaApi {
  noteId: string;
  currentUser: { id: string; name: string };
  /** resizes, converts and uploads; rejects with a message fit for the screen */
  uploadImage: (file: File) => Promise<UploadedImageInfo>;
  useSignedUrl: (path: string | null | undefined) => string | null;
  unfurl: (url: string) => Promise<LinkPreviewData>;
  /** third-party preview images go through the app's proxy */
  imageProxyUrl: (url: string) => string;
  useRecorder: () => RecorderApi;
  /** a hook: the transcript of a voice memo, live. Optional so read-only previews can omit it. */
  useTranscript?: (assetId: string | null | undefined) => TranscriptState;
  /** asks the server to transcribe a failed memo again */
  retryTranscript?: (assetId: string) => Promise<void>;
  /** one line saying where audio goes to become text, shown before a first recording */
  transcriptionNotice?: string;
}

const MediaContext = createContext<MediaApi | null>(null);

export const MediaProvider = MediaContext.Provider;

export function useMedia(): MediaApi {
  const api = useContext(MediaContext);
  if (!api) throw new Error("media blocks need a MediaProvider around the editor");
  return api;
}

/** For views that can render without media (read-only previews, tests). */
export function useOptionalMedia(): MediaApi | null {
  return useContext(MediaContext);
}
