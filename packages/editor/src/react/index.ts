// Browser entry: the Tiptap editor with Yjs collaboration, node views, slash menu and gutter.
// The schema itself comes from "@scraps/editor" so the server and the browser cannot drift.
export { ScrapsEditor } from "./ScrapsEditor";
export type { ScrapsEditorProps } from "./ScrapsEditor";
export { BlockToolbar } from "./BlockToolbar";
export { SLASH_ITEMS, filterSlashItems } from "./slashItems";
export type { SlashItem } from "./slashItems";
