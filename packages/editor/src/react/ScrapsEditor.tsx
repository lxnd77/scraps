"use client";

import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { EditorContent, ReactNodeViewRenderer, useEditor, type Editor } from "@tiptap/react";
import { GripVertical, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Doc } from "yjs";
import {
  YDOC_FIELD,
  ScrapsTaskItem,
  Callout,
  ImageBlock,
  LinkEmbed,
  MoodBoard,
  StickerNode,
  VoiceMemo,
  scrapsExtensions,
} from "../extensions";
import { AfterTitle } from "./AfterTitle";
import { BlockPicker } from "./BlockPicker";
import { BlockToolbar } from "./BlockToolbar";
import { FormatBubble } from "./FormatBubble";
import { StickerLayer } from "./StickerLayer";
import { CalloutView } from "./CalloutView";
import {
  LazyImageView,
  LazyLinkEmbedView,
  LazyMoodBoardView,
  LazyVoiceMemoView,
} from "./LazyMediaViews";
import { MediaDrop } from "./MediaDrop";
import { MediaProvider, type MediaApi } from "./media";
import { MembersProvider, type SpaceMemberInfo } from "./members";
import { SlashCommand, StickerCommand } from "./SlashCommand";
import { StickerView } from "./StickerView";
import { TaskItemView } from "./TaskItemView";

// The same schema as the server, with React node views swapped in for two nodes.
const ClientTaskItem = ScrapsTaskItem.extend({
  addNodeView() {
    // the renderer's own container becomes the <li>, so <ul> only ever holds <li>
    return ReactNodeViewRenderer(TaskItemView, { as: "li", className: "scrap-task-item" });
  },
});

const ClientCallout = Callout.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});

const ClientImage = ImageBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(LazyImageView);
  },
});
const ClientMoodBoard = MoodBoard.extend({
  addNodeView() {
    return ReactNodeViewRenderer(LazyMoodBoardView);
  },
});
const ClientLinkEmbed = LinkEmbed.extend({
  addNodeView() {
    return ReactNodeViewRenderer(LazyLinkEmbedView);
  },
});
const ClientVoiceMemo = VoiceMemo.extend({
  addNodeView() {
    return ReactNodeViewRenderer(LazyVoiceMemoView);
  },
});
const ClientSticker = StickerNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(StickerView, { as: "span" });
  },
});

/** Who you are in the room: the name and accent other people see on your caret. */
export interface CollabIdentity {
  /** the Hocuspocus provider for this note (carries awareness) */
  provider: unknown;
  user: { userId: string; name: string; sticker?: string; accent: string };
}

function caretElement(user: Record<string, unknown>): HTMLElement {
  const accent = String(user.accent ?? "pink");
  const caret = document.createElement("span");
  caret.className = "scrap-caret";
  caret.dataset.accent = accent;
  caret.style.setProperty("--caret", `var(--c-${accent})`);
  const label = document.createElement("span");
  label.className = "scrap-caret__label";
  label.textContent = String(user.name ?? "someone");
  caret.append(label);
  return caret;
}

export interface ScrapsEditorProps {
  /** the people in this space, for assignees */
  members?: SpaceMemberInfo[];
  /** live presence: named carets for everyone else in the note */
  collab?: CollabIdentity;
  /** uploads, signed urls, unfurling and recording; media blocks need it */
  media?: MediaApi;
  /** the shared Yjs document; sync is the caller's provider's job */
  ydoc: Doc;
  /** viewers get a read-only editor */
  editable: boolean;
  /** show the phone block toolbar */
  showToolbar?: boolean;
  placeholder?: { title: string; block: string };
  onReady?: (editor: Editor) => void;
  /** page furniture shown between the title and the first block (the property chips) */
  afterTitle?: ReactNode;
}

export function ScrapsEditor({
  ydoc,
  editable,
  showToolbar = false,
  placeholder = { title: "untitled scrap", block: "type / for blocks" },
  onReady,
  media,
  collab,
  members,
  afterTitle,
}: ScrapsEditorProps) {
  // the element the after-title widget shows; React renders into it through a portal
  const [titleSlot] = useState(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.className = "scrap-after-title";
    el.contentEditable = "false";
    return el;
  });
  const lastPos = useRef<{ pos: number; size: number } | null>(null);
  // the drop plugin reads the api at event time, so it always sees the latest one
  const mediaRef = useRef<MediaApi | null>(null);
  useEffect(() => {
    mediaRef.current = media ?? null;
  }, [media]);
  const [busy, setBusy] = useState(0);
  // the "+" block picker: where the chosen block goes, or null when closed
  const [picker, setPicker] = useState<"caret" | "end" | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const extensions = useMemo(
    () => [
      ...scrapsExtensions({
        placeholder,
        overrides: {
          taskItem: ClientTaskItem,
          callout: ClientCallout,
          image: ClientImage,
          moodBoard: ClientMoodBoard,
          linkEmbed: ClientLinkEmbed,
          voiceMemo: ClientVoiceMemo,
          sticker: ClientSticker,
        },
      }),
      Collaboration.configure({ document: ydoc, field: YDOC_FIELD }),
      ...(collab
        ? [
            CollaborationCaret.configure({
              provider: collab.provider,
              user: {
                userId: collab.user.userId,
                name: collab.user.name,
                sticker: collab.user.sticker,
                accent: collab.user.accent,
                color: `var(--c-${collab.user.accent})`,
              },
              render: caretElement,
              selectionRender: (user) => ({
                nodeName: "span",
                class: "scrap-selection",
                style: `background-color: color-mix(in srgb, var(--c-${String(user.accent ?? "pink")}) 35%, transparent)`,
              }),
            }),
          ]
        : []),
      AfterTitle.configure({ getHost: () => titleSlot }),
      SlashCommand,
      StickerCommand,
      // the ref is read when a file is dropped, never during render
      // eslint-disable-next-line react-hooks/refs
      MediaDrop.configure({
        getApi: () => mediaRef.current,
        onBusy: (delta: number) => setBusy((n) => Math.max(0, n + delta)),
        onError: (message: string) => setMediaError(message),
      }),
    ],
    // placeholder strings and the identity are fixed for the life of the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ydoc, collab?.provider],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions,
      editorProps: {
        attributes: {
          class: "scrap-editor",
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": "scrap",
          spellcheck: "true",
        },
      },
    },
    [extensions],
  );

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (editor) onReady?.(editor);
  }, [editor, onReady]);

  if (!editor) return <div className="scrap-editor scrap-editor--loading" aria-busy="true" />;

  const shell = (
    <div className="scrap-editor-shell">
      {editable && (
        <DragHandle
          editor={editor}
          onNodeChange={({ node, pos }) => {
            lastPos.current = node ? { pos, size: node.nodeSize } : null;
          }}
        >
          <div className="scrap-gutter">
            <button
              type="button"
              aria-label="add a block below"
              className="scrap-gutter__btn"
              onClick={() => {
                const target = lastPos.current;
                if (!target) return;
                // an empty paragraph with a "/" opens the slash menu right there
                editor
                  .chain()
                  .focus()
                  .insertContentAt(target.pos + target.size, {
                    type: "paragraph",
                    content: [{ type: "text", text: "/" }],
                  })
                  .run();
              }}
            >
              <Plus size={16} strokeWidth={3} aria-hidden="true" />
            </button>
            <span className="scrap-gutter__grip" aria-hidden="true" title="drag to move">
              <GripVertical size={16} strokeWidth={2.6} />
            </span>
          </div>
        </DragHandle>
      )}
      <EditorContent editor={editor} />
      {editable && <FormatBubble editor={editor} />}
      <StickerLayer editor={editor} ydoc={ydoc} editable={editable} />
      {editable && (
        // the empty space under the last block: clicking it continues the note, even after a
        // table, divider or code block
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="scrap-tail"
          onClick={() => {
            const last = editor.state.doc.lastChild;
            const chain = editor.chain().focus("end");
            if (last && last.type.name !== "paragraph") {
              chain.insertContentAt(editor.state.doc.content.size, { type: "paragraph" });
            }
            chain.run();
          }}
        />
      )}
      {editable && (
        <button type="button" className="scrap-add" onClick={() => setPicker("end")}>
          <Plus size={16} strokeWidth={3} aria-hidden="true" />
          add a block
        </button>
      )}
      {editable && (
        <BlockPicker
          editor={editor}
          open={picker !== null}
          onClose={() => setPicker(null)}
          where={picker ?? "end"}
        />
      )}
      {(busy > 0 || mediaError) && (
        <p role={mediaError ? "alert" : "status"} className="scrap-media-status">
          {mediaError ?? "uploading…"}
          {mediaError && (
            <button type="button" className="scrap-media__link" onClick={() => setMediaError(null)}>
              ok
            </button>
          )}
        </p>
      )}
      {showToolbar && editable && (
        <BlockToolbar editor={editor} onMore={() => setPicker("caret")} />
      )}
      {afterTitle && titleSlot && createPortal(afterTitle, titleSlot)}
    </div>
  );

  const withMembers = members ? <MembersProvider value={members}>{shell}</MembersProvider> : shell;
  return media ? <MediaProvider value={media}>{withMembers}</MediaProvider> : withMembers;
}
