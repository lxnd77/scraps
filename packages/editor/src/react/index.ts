// Browser entry: the Tiptap editor with Yjs collaboration, node views, slash menu and gutter.
// The schema itself comes from "@scraps/editor" so the server and the browser cannot drift.
export type { Editor } from "@tiptap/core";
export { ScrapsEditor } from "./ScrapsEditor";
export type { CollabIdentity, ScrapsEditorProps } from "./ScrapsEditor";
export { BlockToolbar } from "./BlockToolbar";
export { SLASH_ITEMS, filterSlashItems } from "./slashItems";
export type { SlashItem } from "./slashItems";
export { MediaProvider, useMedia } from "./media";
export type {
  LinkPreviewData,
  MediaApi,
  RecorderApi,
  RecordingResult,
  TranscriptState,
  UploadedImageInfo,
} from "./media";
export { MembersProvider, useMembers } from "./members";
export type { SpaceMemberInfo } from "./members";
export { STICKER_PACK } from "./SlashCommand";
