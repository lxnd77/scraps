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

  // auth
  "auth.tagline": same("your brain, but organised-ish."),
  "auth.email.label": same("your email"),
  "auth.email.placeholder": same("you@somewhere.com"),
  "auth.send": same("send magic link"),
  "auth.sending": same("sending…"),
  "auth.google": same("continue with google"),
  "auth.divider": same("or"),
  "auth.sent.title": same("check your inbox"),
  "auth.sent.body": same("we sent a link to {email}. tap it and you're in."),
  "auth.sent.again": same("use a different email"),
  "auth.error.link": same("that link didn't work. it may have expired. ask for a new one."),
  "auth.error.generic": same("couldn't send that. try again in a sec."),
  "auth.error.google": same("google sign-in isn't set up here yet. use the magic link."),

  // onboarding
  "onboarding.title": { day: "first things first.", night: "first things first. it's late." },
  "onboarding.name.label": same("what should we call you?"),
  "onboarding.birth.label": same("what year were you born?"),
  "onboarding.birth.hint": same("scraps is for 16 and up. we only keep the year."),
  "onboarding.sticker.label": same("pick your sticker"),
  "onboarding.submit": same("let's go"),
  "onboarding.underage": same("scraps is for 16 and up. come back when you're older."),

  // navigation and spaces
  "nav.home": same("home"),
  "nav.spaces": same("spaces"),
  "nav.lists": same("lists"),
  "nav.profile": same("profile"),
  "nav.menu": same("open spaces"),
  "spaces.title": same("your spaces"),
  "spaces.edit": same("edit space"),
  "space.dialog.new": same("new space"),
  "space.dialog.edit": same("edit space"),
  "space.name": same("name"),
  "space.name.placeholder": same("side quests"),
  "space.colour": same("colour"),
  "space.save": same("save it"),
  "space.cancel": same("cancel"),
  "space.notice.owner_only": same("only the owner can change this space."),
  "streak.count": { day: "{n} days", night: "{n} nights" },
  "streak.count.one": { day: "1 day", night: "1 night" },
  "coming.soon": same("coming soon"),

  // settings
  "settings.title": same("settings"),
  "settings.profile": same("profile"),
  "settings.name": same("display name"),
  "settings.sticker": same("avatar sticker"),
  "settings.save": same("save it"),
  "settings.saved": same("saved."),
  "settings.look": same("look"),
  "settings.theme": same("theme"),
  "settings.theme.day": same("daylight"),
  "settings.theme.midnight": same("after midnight"),
  "settings.theme.auto": same("match my device"),
  "settings.tidy": same("tidy mode"),
  "settings.tidy.hint": same("no tilt on cards. calm."),
  "settings.account": same("account"),
  "settings.signout": same("sign out"),

  // notes and the editor
  "note.untitled": same("untitled scrap"),
  "note.placeholder.block": same("type / for blocks"),
  "note.back": same("back to {space}"),
  "note.share": same("share"),
  "note.more": same("more"),
  "note.menu.title": same("this scrap"),
  "note.colour": same("card colour"),
  "note.pin": same("pin it"),
  "note.unpin": same("unpin"),
  "note.delete": same("delete"),
  "note.delete.confirm": same("delete this scrap?"),
  "note.delete.body": same("it goes to the trash for 30 days."),
  "note.delete.yes": same("delete it"),
  "note.chip.vibe": same("vibe"),
  "note.chip.when": same("when"),
  "note.tag.add": same("add tag"),
  "note.tag.placeholder": same("new tag"),
  "note.tag.remove": same("remove tag {name}"),
  "note.view_only": same("view only"),
  "note.sync.reconnecting": same("reconnecting…"),
  "note.error.save": same("couldn't save that change. try again."),
  "note.error.create": same("couldn't start a new scrap. try again."),
  "note.denied.title": same("this scrap isn't yours to see"),
  "note.list.title": same("your scraps"),
  "note.list.empty": same("no scraps here yet."),
  "note.words": same("{n} words"),

  // board
  "phone.greeting.afternoon": same("hey. what's on the **brain** this afternoon?"),
  "phone.greeting.evening": same("evening. what's still **rattling** around?"),
  "filter.label": same("filter scraps"),
  "filter.all": same("everything"),
  "filter.text": same("notes"),
  "filter.list": same("lists"),
  "filter.pic": same("pics"),
  "filter.link": same("links"),
  "filter.voice": same("voice"),
  "filter.quote": same("quotes"),
  "board.layout.list": same("switch to list view"),
  "board.layout.cards": same("switch to card view"),
  "board.loading": same("loading your scraps"),
  "board.more": same("more scraps"),
  "board.error": same("couldn't load your scraps. check your connection and try again."),
  "board.filter_empty": same("no scraps like that here yet."),
  "action.retry": same("try again"),
  "card.more": same("more for {title}"),
  "card.pinned": same("pinned"),
  "card.forever": same("pinned · forever"),
  "card.progress": same("checklist progress"),
  "card.item.done": same("{text}, done"),
  "card.item.todo": same("{text}, not done"),
  "card.kind.pic": same("pic"),
  "card.kind.link": same("link"),
  "card.kind.voice": same("voice"),
  "card.kind.text": same("note"),
  "card.kind.list": same("list"),
  "card.kind.quote": same("quote"),
  "card.menu": same("scrap options"),
  "card.move": same("move to {space}"),
  "card.error.toggle": same("couldn't tick that. try again."),
  "card.error.action": same("couldn't do that. try again."),
  "card.deleted": same("scrap deleted."),

  // quick capture
  "capture.title": same("new scrap"),
  "capture.types": same("or pick a type"),
  "capture.type.text": same("text"),
  "capture.type.list": same("list"),
  "capture.type.pic": same("pic"),
  "capture.type.link": same("link"),
  "capture.type.voice": same("voice"),
  "capture.type.sticker": same("sticker"),
  "capture.list.hint": same("one item per line."),
  "capture.clipboard": same("link on your clipboard"),
  "capture.paste": same("paste"),
  "capture.space": same("space"),
  "capture.error": same("couldn't save that. we kept your words, try again."),
  "capture.saving": same("saving…"),

  // search
  "search.title": same("search"),
  "search.empty": same("nothing yet. try another word."),
  "search.group.scraps": same("scraps"),
  "search.group.spaces": same("spaces"),
  "search.group.actions": same("actions"),
  "search.action.new": same("new scrap"),
  "search.action.theme": same("switch theme"),
  "search.error": same("search broke. try again."),
  "search.loading": same("looking…"),
  "search.results": same("search results"),

  // starter scraps
  "starter.welcome.title": same("welcome to scraps."),
  "starter.welcome.body": same(
    "this is a scrap. type anything, make a mess, come back later. it all lives on your board.",
  ),
  "starter.list.title": same("try ticking these"),
  "starter.list.1": same("open this scrap"),
  "starter.list.2": same("tick a box on the board"),
  "starter.list.3": same("drop your first real thought"),
  "starter.quote.text": same("your brain, but organised-ish."),

  // covers, icon, rail
  "cover.add": same("add a cover"),
  "cover.change": same("change cover"),
  "cover.pattern": same("stripes"),
  "cover.first": same("first stripe colour"),
  "cover.second": same("second stripe colour"),
  "cover.use_pattern": same("use these stripes"),
  "cover.illustration": same("night illustration"),
  "cover.upload": same("upload a pic"),
  "cover.remove": same("remove cover"),
  "cover.error": same("couldn't use that pic. try another."),
  "icon.change": same("change page icon"),
  "icon.add": same("icon"),
  "icon.remove": same("remove icon"),
  "rail.label": same("page extras"),
  "rail.stickers": same("stickers"),
  "rail.sticker_insert": same("add {name} sticker"),
  "rail.outfit": same("page outfit"),
  "rail.activity": same("activity"),
  "rail.people": same("{n} here"),
  "rail.edited": same("edited {when}"),

  // empty and error states
  "error.space_not_found.title": same("this space isn't yours to see"),
  "error.back_to_board": same("back to board"),
  "error.generic": same("something broke. try again."),
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

/** The greeting copy key for an hour, theme and surface. Night copy wins whenever midnight is on. */
export function greetingKey(hour: number, night: boolean, surface: "board" | "phone"): CopyKey {
  if (night) return surface === "phone" ? "phone.greeting" : "board.greeting";
  const period = greetingPeriod(hour);
  if (surface === "phone") {
    if (period === "afternoon") return "phone.greeting.afternoon";
    if (period === "evening") return "phone.greeting.evening";
    return "phone.greeting";
  }
  return boardGreetingKey(hour);
}

/** Cheer line for a checklist by how much is done. */
export function cheerKey(done: number, total: number): CopyKey {
  if (total === 0 || done === 0) return "list.cheer.none";
  if (done >= total) return "list.cheer.all";
  return done / total >= 0.7 ? "list.cheer.almost" : "list.cheer.some";
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
