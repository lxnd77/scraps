"use client";

import { Collaboration } from "@tiptap/extension-collaboration";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { EditorContent, ReactNodeViewRenderer, useEditor, type Editor } from "@tiptap/react";
import { GripVertical, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { BlockToolbar } from "./BlockToolbar";
import { CalloutView } from "./CalloutView";
import { ImageView, LinkEmbedView, MoodBoardView, StickerView, VoiceMemoView } from "./MediaViews";
import { MediaDrop } from "./MediaDrop";
import { MediaProvider, type MediaApi } from "./media";
import { SlashCommand, StickerCommand } from "./SlashCommand";
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
    return ReactNodeViewRenderer(ImageView);
  },
});
const ClientMoodBoard = MoodBoard.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MoodBoardView);
  },
});
const ClientLinkEmbed = LinkEmbed.extend({
  addNodeView() {
    return ReactNodeViewRenderer(LinkEmbedView);
  },
});
const ClientVoiceMemo = VoiceMemo.extend({
  addNodeView() {
    return ReactNodeViewRenderer(VoiceMemoView);
  },
});
const ClientSticker = StickerNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(StickerView, { as: "span" });
  },
});

export interface ScrapsEditorProps {
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
}

export function ScrapsEditor({
  ydoc,
  editable,
  showToolbar = false,
  placeholder = { title: "untitled scrap", block: "type / for blocks" },
  onReady,
  media,
}: ScrapsEditorProps) {
  const lastPos = useRef<{ pos: number; size: number } | null>(null);
  // the drop plugin reads the api at event time, so it always sees the latest one
  const mediaRef = useRef<MediaApi | null>(null);
  useEffect(() => {
    mediaRef.current = media ?? null;
  }, [media]);
  const [busy, setBusy] = useState(0);
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
    // placeholder strings are static per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ydoc],
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
      {showToolbar && editable && <BlockToolbar editor={editor} />}
    </div>
  );

  return media ? <MediaProvider value={media}>{shell}</MediaProvider> : shell;
}
