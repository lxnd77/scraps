import type { JSONContent } from "@tiptap/core";

const text = (value: string): JSONContent => ({ type: "text", text: value });
const p = (value?: string, id?: string): JSONContent => ({
  type: "paragraph",
  ...(id ? { attrs: { id } } : {}),
  ...(value ? { content: [text(value)] } : {}),
});
const title = (value: string): JSONContent =>
  value ? { type: "title", content: [text(value)] } : { type: "title" };
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

const task = (
  value: string,
  checked: boolean,
  extra: Record<string, unknown> = {},
): JSONContent => ({
  type: "taskItem",
  attrs: { checked, ...extra },
  content: [p(value)],
});

/** Documents covering every node type in the Phase 2 schema, with ids so round-trips compare exactly. */
export const fixtures = {
  empty: doc(title(""), p()),

  plainText: doc(
    title("is the moon a notification light"),
    p("made total sense at 3am.", "p1"),
    p("revisit in daylight.", "p2"),
  ),

  marks: doc(title("marks"), {
    type: "paragraph",
    attrs: { id: "m1" },
    content: [
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
      text(" "),
      { type: "text", text: "italic", marks: [{ type: "italic" }] },
      text(" "),
      { type: "text", text: "strike", marks: [{ type: "strike" }] },
      text(" "),
      { type: "text", text: "code", marks: [{ type: "code" }] },
      text(" "),
      { type: "text", text: "pill", marks: [{ type: "highlight" }] },
      text(" "),
      {
        type: "text",
        text: "link",
        marks: [
          {
            type: "link",
            attrs: {
              href: "https://example.test",
              target: "_blank",
              rel: "noopener noreferrer nofollow",
              class: null,
            },
          },
        ],
      },
    ],
  }),

  headings: doc(
    title("headings"),
    { type: "heading", attrs: { id: "h1", level: 1 }, content: [text("one")] },
    { type: "heading", attrs: { id: "h2", level: 2 }, content: [text("two")] },
    { type: "heading", attrs: { id: "h3", level: 3 }, content: [text("three")] },
  ),

  lists: doc(
    title("lists"),
    {
      type: "bulletList",
      attrs: { id: "bl" },
      content: [
        { type: "listItem", attrs: { id: "li1" }, content: [p("one", "lp1")] },
        { type: "listItem", attrs: { id: "li2" }, content: [p("two", "lp2")] },
      ],
    },
    {
      type: "orderedList",
      attrs: { id: "ol", start: 1, type: null },
      content: [{ type: "listItem", attrs: { id: "li3" }, content: [p("first", "lp3")] }],
    },
  ),

  checklist: doc(title("before bed (lol)"), {
    type: "taskList",
    attrs: { id: "tl" },
    content: [
      {
        ...task("drink a glass of water", true, { id: "t1", assigneeId: null, due: null }),
        content: [p("drink a glass of water", "tp1")],
      },
      {
        ...task("plug in phone", false, { id: "t2", assigneeId: "user-1", due: "2026-10-12" }),
        content: [p("plug in phone", "tp2")],
      },
      {
        ...task("stop doomscrolling", false, { id: "t3", assigneeId: null, due: null }),
        content: [p("stop doomscrolling", "tp3")],
      },
      {
        ...task("close your eyes", false, { id: "t4", assigneeId: null, due: null }),
        content: [p("close your eyes", "tp4")],
      },
      {
        ...task("sleep", false, { id: "t5", assigneeId: null, due: null }),
        content: [p("sleep", "tp5")],
      },
    ],
  }),

  callout: doc(title("callout"), {
    type: "callout",
    attrs: { id: "c1", color: "lime", sticker: "heart" },
    content: [p("remember the charger", "cp1")],
  }),

  quote: doc(title("go to sleep"), {
    type: "bigText",
    attrs: { id: "b1" },
    content: [text("go to sleep.")],
  }),

  divider: doc(
    title("divider"),
    p("above", "d1"),
    { type: "horizontalRule", attrs: { id: "hr" } },
    p("below", "d2"),
  ),

  code: doc(title("code"), {
    type: "codeBlock",
    attrs: { id: "cb", language: null },
    content: [text("const sleep = never;")],
  }),

  table: doc(title("table"), {
    type: "table",
    attrs: { id: "tb" },
    content: [
      {
        type: "tableRow",
        content: [
          {
            type: "tableHeader",
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [p("what", "th1")],
          },
          {
            type: "tableHeader",
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [p("when", "th2")],
          },
        ],
      },
      {
        type: "tableRow",
        content: [
          {
            type: "tableCell",
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [p("noodles", "tc1")],
          },
          {
            type: "tableCell",
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [p("2am", "tc2")],
          },
        ],
      },
    ],
  }),

  /** a blank paragraph first, then a checklist: kind still resolves to list */
  blankThenList: doc(title("shopping"), p(), {
    type: "taskList",
    attrs: { id: "tl2" },
    content: [
      {
        ...task("milk", false, { id: "t9", assigneeId: null, due: null }),
        content: [p("milk", "tp9")],
      },
    ],
  }),

  /** text first, checklist later: kind stays text */
  textThenList: doc(title("notes"), p("some thoughts", "x1"), {
    type: "taskList",
    attrs: { id: "tl3" },
    content: [
      {
        ...task("a thing", true, { id: "t8", assigneeId: null, due: null }),
        content: [p("a thing", "tp8")],
      },
    ],
  }),
} satisfies Record<string, JSONContent>;
