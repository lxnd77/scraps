"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { lazy, Suspense, type ComponentType, type ReactElement } from "react";

// The media node views (recorder, mood board, link embed, image tools) are heavy and most
// notes have none, so they load on first use. Until then the block holds its place.
const Image = lazy(() => import("./MediaViews").then((m) => ({ default: m.ImageView })));
const MoodBoard = lazy(() => import("./MediaViews").then((m) => ({ default: m.MoodBoardView })));
const LinkEmbed = lazy(() => import("./MediaViews").then((m) => ({ default: m.LinkEmbedView })));
const VoiceMemo = lazy(() => import("./MediaViews").then((m) => ({ default: m.VoiceMemoView })));

function lazyView(View: ComponentType<NodeViewProps>, type: string) {
  function LazyNodeView(props: NodeViewProps): ReactElement {
    return (
      <Suspense
        fallback={
          <NodeViewWrapper
            className="scrap-media scrap-media--loading"
            data-type={type}
            aria-busy="true"
          />
        }
      >
        <View {...props} />
      </Suspense>
    );
  }
  return LazyNodeView;
}

export const LazyImageView = lazyView(Image, "image");
export const LazyMoodBoardView = lazyView(MoodBoard, "moodBoard");
export const LazyLinkEmbedView = lazyView(LinkEmbed, "linkEmbed");
export const LazyVoiceMemoView = lazyView(VoiceMemo, "voiceMemo");
