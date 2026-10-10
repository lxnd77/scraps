import type { JSONContent } from "@tiptap/core";

/** Which block a new note starts with. Quick capture's type tile decides this (SPEC 8.1). */
export type StartBlock =
  "text" | "list" | "quote" | "image" | "mood" | "link" | "voice" | "sticker";

export const START_BLOCKS: readonly StartBlock[] = [
  "text",
  "list",
  "quote",
  "image",
  "mood",
  "link",
  "voice",
  "sticker",
];

/** What a media-led start carries. The asset rows are inserted by the client right after. */
export interface StartMedia {
  assetId?: string;
  path?: string;
  width?: number;
  height?: number;
  color?: string;
  url?: string;
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
  duration?: number;
  mediaType?: "article" | "video" | "maps";
  durationMs?: number;
  peaks?: number[];
  authorId?: string;
  authorName?: string;
  /** sticker id */
  sticker?: string;
  /** mood board pictures */
  images?: Array<{ assetId: string; path: string; caption?: string }>;
}

export interface InitialContentOptions {
  title?: string;
  /** text to put in the first block (a captured thought) */
  text?: string;
  /** checklist starts only: one task item per entry; `text` becomes the first when given */
  items?: string[];
  /** attributes for image, link, voice and sticker starts */
  media?: StartMedia;
}

function paragraph(text?: string): JSONContent {
  return text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
}

/** A valid starting document: a title node, then the starting block(s). */
export function initialContent(
  start: StartBlock = "text",
  { title, text, items, media = {} }: InitialContentOptions = {},
): JSONContent {
  const titleNode: JSONContent = title
    ? { type: "title", content: [{ type: "text", text: title }] }
    : { type: "title" };

  let blocks: JSONContent[];
  switch (start) {
    case "list": {
      const lines = [...(text ? [text] : []), ...(items ?? [])].filter((l) => l.trim() !== "");
      blocks = [
        {
          type: "taskList",
          content: (lines.length > 0 ? lines : [undefined]).map((line) => ({
            type: "taskItem",
            attrs: { checked: false },
            content: [paragraph(line)],
          })),
        },
      ];
      break;
    }
    case "image":
      blocks = [
        {
          type: "image",
          attrs: {
            assetId: media.assetId ?? null,
            path: media.path ?? null,
            width: media.width ?? null,
            height: media.height ?? null,
            color: media.color ?? null,
          },
        },
      ];
      break;
    case "mood":
      blocks = [{ type: "moodBoard", attrs: { images: media.images ?? [] } }];
      break;
    case "link":
      blocks = [
        {
          type: "linkEmbed",
          attrs: {
            url: media.url ?? null,
            title: media.title ?? null,
            description: media.description ?? null,
            image: media.image ?? null,
            domain: media.domain ?? null,
            duration: media.duration ?? null,
            mediaType: media.mediaType ?? "article",
          },
        },
      ];
      break;
    case "voice":
      blocks = [
        {
          type: "voiceMemo",
          attrs: {
            assetId: media.assetId ?? null,
            path: media.path ?? null,
            durationMs: media.durationMs ?? null,
            peaks: media.peaks ?? [],
            authorId: media.authorId ?? null,
            authorName: media.authorName ?? "",
          },
        },
      ];
      break;
    case "sticker":
      blocks = [
        {
          type: "paragraph",
          content: [{ type: "sticker", attrs: { id: media.sticker ?? "sparkle", size: 96 } }],
        },
      ];
      break;
    case "quote":
      blocks = [
        text ? { type: "bigText", content: [{ type: "text", text }] } : { type: "bigText" },
      ];
      break;
    default: {
      // one paragraph per line of captured text
      const lines = text ? text.split("\n").filter((l) => l.trim() !== "") : [];
      blocks = lines.length > 0 ? lines.map((l) => paragraph(l)) : [paragraph()];
    }
  }

  return { type: "doc", content: [titleNode, ...blocks] };
}
