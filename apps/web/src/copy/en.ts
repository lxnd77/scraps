/**
 * All UI strings live here (SPEC section 4).
 * Rules: lowercase, short, friendly, verbs on buttons, no em-dashes.
 * `**phrase**` marks the highlighted pill in greetings.
 */

interface Pair {
  day: string;
  night: string;
}

const same = (value: string): Pair => ({ day: value, night: value });

export const en = {
  "board.greeting": {
    day: "gm bestie. what's living **your head** today?",
    night: "it's 3am. what's living **rent free** in your head?",
  },
  "board.greeting.afternoon": {
    day: "hey bestie. what's on the **brain** this afternoon?",
    night: "it's 3am. what's living **rent free** in your head?",
  },
  "board.greeting.evening": {
    day: "evening. what's still **rattling around** up there?",
    night: "it's 3am. what's living **rent free** in your head?",
  },
  "board.kicker": { day: "{weekday} · {space}", night: "{time} · {space}" },
  "phone.greeting": {
    day: "gm. what's the **mess** today?",
    night: "still up? same. spill the **3am** thoughts.",
  },
  "phone.section": { day: "pinned", night: "tonight" },
  "search.placeholder": { day: "find that one thing…", night: "find that 3am thought…" },
  "capture.label": { day: "what's on your mind", night: "what's keeping you up" },
  "capture.placeholder": {
    day: "type anything. we'll figure out what it is.",
    night: "3am thought? spill it. we'll sort it out in the morning.",
  },
  "capture.save": { day: "save it", night: "save it, sleep" },
  "streak.title": { day: "streak · {n} days", night: "night owl streak · {n} nights" },
  "streak.body": {
    day: "dump one thought today to keep it alive.",
    night: "log one 3am thought to keep it alive. or, hear us out, sleep.",
  },
  "empty.board": {
    day: "it's quiet in here. drop your first scrap.",
    night: "nothing yet. the night is young.",
  },
  "list.cheer.none": { day: "fresh start, let's go", night: "the night is young (sadly)" },
  "list.cheer.some": { day: "making moves", night: "winding down" },
  "list.cheer.almost": { day: "so close, keep going", night: "almost horizontal" },
  "list.cheer.all": { day: "all done. iconic.", night: "goodnight. iconic." },
  "offline.chip": same("offline · saved on this device"),
  "offline.banner": same("you're offline. keep going, we'll sync later."),
  "sync.saved": same("saved"),
  "sync.syncing": same("syncing…"),
  "sync.error": same("couldn't sync. tap for details"),
  "action.new_scrap": same("new scrap"),
  "action.new_space": same("new space"),
  "action.switch_layout": same("switch layout"),
  "theme.toggle_label": same("after midnight"),
} as const satisfies Record<string, Pair>;

export type CopyKey = keyof typeof en;

export interface TOptions {
  /** true when the resolved theme is midnight */
  night?: boolean;
}

/** Pick the day or night variant and fill `{vars}`. */
export function t(
  key: CopyKey,
  vars: Record<string, string | number> = {},
  { night = false }: TOptions = {},
): string {
  const pair: Pair = en[key];
  const template = night ? pair.night : pair.day;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export type GreetingPeriod = "morning" | "afternoon" | "evening";

/** gm before 12:00, afternoon 12:00 to 17:59, evening 18:00 to 23:59. */
export function greetingPeriod(hour: number): GreetingPeriod {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function boardGreetingKey(hour: number): CopyKey {
  const period = greetingPeriod(hour);
  if (period === "afternoon") return "board.greeting.afternoon";
  if (period === "evening") return "board.greeting.evening";
  return "board.greeting";
}

/** Split `a **b** c` into plain and highlighted parts for rendering. */
export function splitHighlight(text: string): Array<{ text: string; highlight: boolean }> {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? { text: part.slice(2, -2), highlight: true }
        : { text: part, highlight: false },
    );
}
