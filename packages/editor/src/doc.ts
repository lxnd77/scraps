import { TiptapTransformer } from "@hocuspocus/transformer";
import type { JSONContent } from "@tiptap/core";
import { getSchema } from "@tiptap/core";
import * as Y from "yjs";
import type { Doc } from "yjs";
import { YDOC_FIELD, scrapsExtensions } from "./extensions";

// Building a schema is not free, so the server-side extension list is built once.
let transformer: ReturnType<typeof TiptapTransformer.extensions> | undefined;

function getTransformer() {
  transformer ??= TiptapTransformer.extensions(scrapsExtensions());
  return transformer;
}

/** ProseMirror JSON into a fresh Yjs document (the `default` fragment). */
export function contentToYdoc(content: JSONContent): Doc {
  return getTransformer().toYdoc(content, YDOC_FIELD);
}

let schema: ReturnType<typeof getSchema> | undefined;

/**
 * Throws unless the content satisfies the shared schema (title first, known nodes and attrs).
 * Used on documents that arrive from clients, which could otherwise store anything.
 */
export function validateContent(content: JSONContent): void {
  schema ??= getSchema(scrapsExtensions());
  schema.nodeFromJSON(content).check();
}

/** A Yjs state update from a client, validated against the schema, as a fresh document. */
export function ydocFromState(state: Uint8Array): Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  validateContent(ydocToContent(doc));
  return doc;
}

function collectTaskItems(node: Y.XmlFragment | Y.XmlElement, into: Y.XmlElement[]): void {
  for (const child of node.toArray()) {
    if (child instanceof Y.XmlElement) {
      if (child.nodeName === "taskItem") into.push(child);
      collectTaskItems(child, into);
    }
  }
}

function plainText(node: unknown): string {
  if (node instanceof Y.XmlText) {
    return node
      .toDelta()
      .map((d: { insert?: unknown }) => (typeof d.insert === "string" ? d.insert : ""))
      .join("");
  }
  if (node instanceof Y.XmlElement) return node.toArray().map(plainText).join(" ");
  return "";
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

export interface ChecklistChange {
  /** position among the note's task items in document order (what the card preview lists) */
  index: number;
  checked: boolean;
  /** the item's text as the card saw it; a mismatch means the card is stale */
  text?: string;
}

/**
 * Ticks or unticks a task item in a document. The one implementation behind both the collab
 * server's endpoint and a device applying a card toggle to its local copy.
 */
export function setTaskItemChecked(
  doc: Doc,
  change: ChecklistChange,
): { status: "ok"; done: number; total: number } | { status: "stale" | "missing" } {
  const items: Y.XmlElement[] = [];
  collectTaskItems(doc.getXmlFragment(YDOC_FIELD), items);
  const item = items[change.index];
  if (!item) return { status: "missing" };
  if (change.text !== undefined && squash(plainText(item)) !== squash(change.text)) {
    return { status: "stale" };
  }
  item.setAttribute("checked", change.checked as never);
  return {
    status: "ok",
    done: items.filter((i) => (i.getAttribute("checked") as unknown) === true).length,
    total: items.length,
  };
}

/**
 * Gives an untitled note a title (an accepted AI suggestion). Never overwrites: a note that
 * already has a title is left alone, so a suggestion that arrives late cannot clobber an edit.
 */
export function setNoteTitleIfEmpty(
  doc: Doc,
  title: string,
): { status: "ok" | "has_title" | "missing" } {
  const first = doc.getXmlFragment(YDOC_FIELD).get(0);
  if (!(first instanceof Y.XmlElement) || first.nodeName !== "title") return { status: "missing" };
  if (squash(plainText(first)) !== "") return { status: "has_title" };
  const text = new Y.XmlText();
  text.insert(0, title);
  first.insert(0, [text]);
  return { status: "ok" };
}

/** The `default` fragment of a Yjs document as ProseMirror JSON. */
export function ydocToContent(ydoc: Doc): JSONContent {
  return getTransformer().fromYdoc(ydoc, YDOC_FIELD) as JSONContent;
}
