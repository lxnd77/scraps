import type { JSONContent } from "@tiptap/core";

export type NoteKind = "text" | "list" | "pic" | "link" | "voice" | "quote";

export interface ChecklistPreview {
  done: number;
  total: number;
  items: Array<{ text: string; done: boolean }>;
}

export interface NotePreviewData {
  checklist?: ChecklistPreview;
  images?: string[];
  /** storage paths of the same images, in order, so cards can sign them without a lookup */
  imagePaths?: string[];
  /** how many images the note has in all, for "+N pics" */
  imageCount?: number;
  link?: {
    url: string;
    title?: string;
    description?: string;
    domain?: string;
    image?: string;
    duration?: number;
    mediaType?: "article" | "video" | "maps";
  };
  voice?: { assetId: string; path?: string; durationMs?: number; peaks?: number[]; excerpt?: string };
  quote?: string;
}

export interface NotePreview {
  title: string;
  previewText: string;
  kind: NoteKind;
  wordCount: number;
  /** plain text for full-text search: title, all text, checklist items, link titles */
  searchText: string;
  preview: NotePreviewData;
}

const TITLE_MAX = 120;
const PREVIEW_MAX = 280;
const CHECKLIST_ITEMS = 4;
const IMAGES_MAX = 4;

/** Block types that make a note a particular kind when they come first (SPEC 8.1). */
const KIND_BY_NODE: Record<string, NoteKind> = {
  taskList: "list",
  image: "pic",
  moodBoard: "pic",
  linkEmbed: "link",
  voiceMemo: "voice",
  bigText: "quote",
};

function textOf(node: JSONContent | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (!node.content) return "";
  // keep words from adjacent blocks apart
  const separator = node.type === "doc" || isBlockContainer(node.type) ? " " : "";
  return node.content.map(textOf).join(separator);
}

function isBlockContainer(type: string | undefined): boolean {
  return (
    type === "bulletList" ||
    type === "orderedList" ||
    type === "taskList" ||
    type === "listItem" ||
    type === "taskItem" ||
    type === "callout" ||
    type === "table" ||
    type === "tableRow" ||
    type === "tableCell" ||
    type === "tableHeader"
  );
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function walk(node: JSONContent, visit: (n: JSONContent) => void): void {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

function isEmptyParagraph(node: JSONContent): boolean {
  return node.type === "paragraph" && clean(textOf(node)) === "";
}

function domainOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Derives the card fields the collab server writes to `notes` (SPEC 8.3). Pure and deterministic. */
export function extractPreview(doc: JSONContent): NotePreview {
  const children = doc.content ?? [];
  const titleNode = children[0]?.type === "title" ? children[0] : undefined;
  const body = titleNode ? children.slice(1) : children;

  const fullTitle = clean(textOf(titleNode));
  const title = fullTitle.slice(0, TITLE_MAX);

  // kind: the first meaningful block decides
  const firstMeaningful = body.find((block) => !isEmptyParagraph(block));
  const kind: NoteKind = (firstMeaningful && KIND_BY_NODE[firstMeaningful.type ?? ""]) || "text";

  const bodyText = clean(body.map(textOf).join(" "));
  const wordCount = clean(`${fullTitle} ${bodyText}`).split(" ").filter(Boolean).length;

  const preview: NotePreviewData = {};
  const searchParts: string[] = [fullTitle, bodyText];

  const items: Array<{ text: string; done: boolean }> = [];
  const images: string[] = [];
  const imagePaths: string[] = [];
  const captions: string[] = [];

  for (const block of body) {
    walk(block, (n) => {
      switch (n.type) {
        case "taskItem":
          items.push({ text: clean(textOf(n)), done: n.attrs?.checked === true });
          break;
        case "image": {
          const id = n.attrs?.assetId;
          if (typeof id === "string") {
            images.push(id);
            if (typeof n.attrs?.path === "string") imagePaths.push(n.attrs.path);
          }
          for (const key of ["caption", "alt"]) {
            const v = n.attrs?.[key];
            if (typeof v === "string" && v) captions.push(v);
          }
          break;
        }
        case "moodBoard": {
          const list = n.attrs?.images;
          if (Array.isArray(list)) {
            for (const entry of list as Array<{
              assetId?: unknown;
              path?: unknown;
              caption?: unknown;
            }>) {
              if (typeof entry?.assetId === "string") {
                images.push(entry.assetId);
                if (typeof entry.path === "string") imagePaths.push(entry.path);
              }
              if (typeof entry?.caption === "string" && entry.caption) captions.push(entry.caption);
            }
          }
          break;
        }
        case "linkEmbed": {
          const url = n.attrs?.url;
          if (typeof url === "string" && !preview.link) {
            const title = typeof n.attrs?.title === "string" ? n.attrs.title : undefined;
            preview.link = {
              url,
              title,
              domain: typeof n.attrs?.domain === "string" ? n.attrs.domain : domainOf(url),
              image: typeof n.attrs?.image === "string" ? n.attrs.image : undefined,
              duration: typeof n.attrs?.duration === "number" ? n.attrs.duration : undefined,
              description:
                typeof n.attrs?.description === "string" && n.attrs.description
                  ? n.attrs.description
                  : undefined,
              mediaType:
                n.attrs?.mediaType === "video" || n.attrs?.mediaType === "maps"
                  ? n.attrs.mediaType
                  : "article",
            };
            if (title) searchParts.push(title);
            if (preview.link.description) searchParts.push(preview.link.description);
          }
          break;
        }
        case "voiceMemo": {
          const assetId = n.attrs?.assetId;
          if (typeof assetId === "string" && !preview.voice) {
            preview.voice = {
              assetId,
              path: typeof n.attrs?.path === "string" ? n.attrs.path : undefined,
              durationMs: typeof n.attrs?.durationMs === "number" ? n.attrs.durationMs : undefined,
              peaks: Array.isArray(n.attrs?.peaks)
                ? (n.attrs.peaks as unknown[]).filter((p): p is number => typeof p === "number").slice(0, 120)
                : undefined,
            };
          }
          break;
        }
        case "bigText":
          if (preview.quote === undefined) preview.quote = clean(textOf(n));
          break;
      }
    });
  }

  if (items.length > 0) {
    preview.checklist = {
      done: items.filter((i) => i.done).length,
      total: items.length,
      items: items.slice(0, CHECKLIST_ITEMS),
    };
  }
  if (images.length > 0) {
    preview.images = images.slice(0, IMAGES_MAX);
    preview.imageCount = images.length;
    if (imagePaths.length > 0) preview.imagePaths = imagePaths.slice(0, IMAGES_MAX);
  }
  searchParts.push(...captions);
  if (preview.quote === "") delete preview.quote;

  return {
    title,
    previewText: bodyText.slice(0, PREVIEW_MAX),
    kind,
    wordCount,
    searchText: clean(searchParts.join(" ")),
    preview,
  };
}
