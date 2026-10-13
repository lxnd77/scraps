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
  "offline.stale": same(
    "some changes have been waiting over a day to sync. open scraps online soon so they're not lost.",
  ),
  "sync.saved": same("saved"),
  "sync.syncing": same("syncing…"),
  "sync.error": same("couldn't sync. tap for details"),
  "sync.detail.title": same("couldn't sync these"),
  "sync.detail.hint": same(
    "the server said no, so they weren't saved there. anything in a note you have open is still on this device.",
  ),
  "sync.detail.retrying": same(
    "the sync server isn't answering, so {n} tries have failed. your scraps are safe on this device and we keep trying.",
  ),
  "sync.detail.server": same("sync server: {host}"),
  "sync.detail.createNote": same("a new scrap"),
  "sync.detail.patchNote": same("a change to a scrap"),
  "sync.detail.tag": same("a tag"),
  "sync.detail.board": same("where cards sit on a board"),
  "sync.detail.sticker": same("a sticker on a board"),
  "sync.detail.toggleChecklist": same("a checklist tick"),
  "sync.detail.upload": same("a pic or voice memo"),
  "sync.detail.clear": same("ok, got it"),
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
  "auth.legal.lead": same("by continuing you agree to the"),
  "auth.legal.terms": same("terms"),
  "auth.legal.and": same("and"),
  "auth.legal.privacy": same("privacy page"),
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
  "note.loading": same("opening your scrap"),

  // keyboard shortcuts and the ? cheat sheet
  "keys.title": same("keyboard shortcuts"),
  "keys.zoom.in": same("zoom in"),
  "keys.zoom.out": same("zoom out"),
  "keys.zoom.reset": same("back to 100%"),
  "keys.zoom.fit": same("fit every card on screen"),
  "keys.board.nudge": same("move the card a step (shift: five)"),
  "canvas.zoom": same("zoom"),
  "canvas.zoom_in": same("zoom in"),
  "canvas.zoom_out": same("zoom out"),
  "canvas.zoom_reset": same("back to 100%"),
  "canvas.fit": same("fit every card on screen"),
  "canvas.moved": same("moved to column {x}, row {y}"),
  "capture.colour": same("card colour"),
  "capture.colour.auto": same("colour by kind"),
  "note.colour.quick": same("card colour"),
  "keys.hint": same("press ? any time to see these again."),
  "keys.mod.mac": same("cmd"),
  "keys.mod.other": same("ctrl"),
  "keys.then": same("then"),
  "keys.group.anywhere": same("anywhere"),
  "keys.group.go": same("get around"),
  "keys.group.board": same("on a board"),
  "keys.group.scrap": same("in a scrap"),
  "keys.new": same("new scrap"),
  "keys.search": same("search"),
  "keys.theme": same("flip daylight and midnight"),
  "keys.help": same("this list"),
  "keys.go.home": same("home"),
  "keys.go.spaces": same("all spaces"),
  "keys.go.lists": same("lists"),
  "keys.go.settings": same("settings"),
  "keys.go.trash": same("this space's trash"),
  "keys.space.n": same("jump to space 1 to 9"),
  "keys.space.step": same("previous or next space"),
  "keys.board.move": same("move between cards"),
  "keys.board.open": same("open the card"),
  "keys.board.pin": same("pin or unpin"),
  "keys.board.menu": same("card menu: colour, move, trash"),
  "keys.scrap.block": same("drop a block"),
  "keys.scrap.leave": same("leave the text, again to go back to the board"),
  "keys.scrap.bold": same("bold"),
  "keys.scrap.italic": same("italic"),
  "keys.scrap.highlight": same("highlight"),
  "keys.scrap.checklist": same("checklist"),
  "keys.scrap.undo": same("undo"),
  "keys.open": same("keyboard shortcuts"),
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
  "card.more_pics": same("+{n} pics"),
  "card.voice.play": same("play memo"),
  "card.voice.pause": same("pause memo"),
  "move.strip": same("drop it in another space"),
  "move.strip.keyboard": same("move to which space?"),
  "move.done": same("moved to {space}."),
  "move.undo": same("undo"),
  "move.cancel": same("cancel"),
  "move.dismiss": same("ok"),
  "keys.board.move_space": same("move the card to another space"),
  "card.error.toggle": same("couldn't tick that. try again."),
  "card.error.action": same("couldn't do that. try again."),
  "card.error.offline": same("open this scrap once online first, then you can tick it offline."),
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
  "capture.pic.choose": same("choose a pic"),
  "capture.pic.change": same("choose another"),
  "capture.pic.unreadable": same("couldn't read that pic. try another one."),
  "capture.pic.too_big": same("that pic is huge. try a smaller one."),
  "capture.pic.type": same("that file isn't a pic we can use. try jpeg, png, webp or gif."),
  "capture.link.label": same("paste a link"),
  "capture.link.invalid": same("that doesn't look like a web address yet."),
  "capture.voice.record": same("record"),
  "capture.voice.stop": same("stop"),
  "capture.voice.redo": same("record again"),
  "capture.voice.denied": same(
    "we need the mic to record. allow it in your browser and try again.",
  ),
  "capture.voice.error": same("couldn't record that. try again."),
  "capture.voice.too_long": same("that recording is over five minutes. try a shorter one."),
  "capture.voice.unreadable": same("couldn't read that recording. try another one."),
  "capture.shared": same("shared with scraps. tweak it, then save."),
  "capture.pic.board": same("{n} pics, they'll land as a mood board"),
  "capture.drop": same("drop it to make a scrap"),

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
  "search.local_only": same("searching this device only"),
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
  "starter.mood.title": same("vibes board"),
  "starter.mood.1": same("sunny side"),
  "starter.mood.2": same("late night"),
  "starter.mood.3": same("fresh start"),

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

  // invites and sharing
  "invite.kicker": same("{name} invited you"),
  "invite.title": same("join {space}?"),
  "invite.role.editor": same("you'll be able to add and edit scraps."),
  "invite.role.viewer": same("you'll be able to look, not touch."),
  "invite.join": same("join"),
  "invite.later": same("not now"),
  "invite.open": same("open it"),
  "invite.already": same("you're already in this space."),
  "invite.broken.title": same("this link isn't working"),
  "invite.broken.body": same("it may have expired or been used up. ask for a new one."),
  "invite.error": same("couldn't join just now. try again."),
  "share.title": same("share {space}"),
  "share.members": same("people here"),
  "share.you": same("you"),
  "share.role.owner": same("owner"),
  "share.role.editor": same("editor"),
  "share.role.viewer": same("viewer"),
  "share.role.label": same("role for {name}"),
  "share.remove": same("remove {name}"),
  "share.leave": same("leave space"),
  "share.leave.confirm": same("leave this space?"),
  "share.leave.body": same("you'll lose access to its scraps until someone invites you again."),
  "share.invite.title": same("invite link"),
  "share.invite.role": same("they can"),
  "share.invite.expires": same("expires in"),
  "share.invite.days.1": same("1 day"),
  "share.invite.days.7": same("7 days"),
  "share.invite.days.30": same("30 days"),
  "share.invite.uses": same("max people"),
  "share.invite.create": same("make a link"),
  "share.invite.copy": same("copy"),
  "share.invite.copied": same("copied."),
  "share.invite.revoke": same("revoke"),
  "share.invite.new": same("new link (shown once)"),
  "share.invite.list": same("active links"),
  "share.invite.item": same("{role} · {uses}/{max} used · expires {when}"),
  "share.invite.none": same("no active links."),
  "share.invite.viewer_only": same("editors can invite viewers. owners can invite editors too."),
  "share.error": same("couldn't do that. try again."),
  "share.open": same("share this space"),

  "note.offline.unavailable": same(
    "this scrap isn't on this device yet. open it once online and it will work offline too.",
  ),
  "note.revoked.title": same("you no longer have access"),
  "note.revoked.body": same(
    "someone changed who is in this space. what you wrote up to now is saved.",
  ),

  // install
  "install.prompt": same("put scraps on your home screen? it opens fast and works offline."),
  "install.yes": same("install"),
  "install.no": same("not now"),
  "install.howto.title": same("add scraps to your home screen"),
  "install.howto.step1": same("tap the share button in safari's toolbar."),
  "install.howto.step2": same("choose add to home screen, then add."),
  "install.howto.title.taskbar": same("pin scraps to your taskbar"),
  "install.howto.ffa.step1": same("tap the menu button in firefox."),
  "install.howto.ffa.step2": same("choose add app to home screen, then add."),
  "install.howto.ffw.step1": same(
    "needs firefox 143 or newer. look for the add to taskbar button at the end of the address bar.",
  ),
  "install.howto.ffw.step2": same(
    "click it and scraps opens in its own window, pinned to your taskbar.",
  ),
  "install.howto.ffo": same(
    "firefox can only install apps on windows and android for now. chrome or edge can install scraps here.",
  ),
  "install.howto.done": same("got it"),
  "settings.install": same("install the app"),
  "settings.install.hint": same("opens fast, works offline, lives on your home screen."),
  "settings.install.button": same("add scraps to this device"),
  "settings.install.done": same("you're using the installed app."),
  "settings.install.unavailable": same(
    "your browser will offer this when the app can be installed.",
  ),

  // capture tokens and the iOS shortcut
  "settings.capture": same("capture"),
  "settings.capture.hint": same(
    "send links, text and pics to scraps from your iphone's share sheet. a token lets the shortcut in without your password.",
  ),
  "settings.capture.label": same("name this token"),
  "settings.capture.placeholder": same("my iphone"),
  "settings.capture.create": same("make a token"),
  "settings.capture.created": same("copy it now. it's only shown once."),
  "settings.capture.copy": same("copy token"),
  "settings.capture.copied": same("copied"),
  "settings.capture.done": same("done"),
  "settings.capture.empty": same("no tokens yet."),
  "settings.capture.never": same("never used"),
  "settings.capture.used": same("last used {when}"),
  "settings.capture.created_on": same("made {when}"),
  "settings.capture.revoke": same("revoke"),
  "settings.capture.revoke_confirm": same("revoke {name}? the shortcut using it stops working."),
  "settings.capture.error": same("couldn't do that. try again."),
  "settings.capture.limit": same("ten live tokens is the max. revoke one first."),
  "settings.capture.unnamed": same("untitled token"),
  "settings.shortcut.title": same("the send to scraps shortcut"),
  "settings.shortcut.get": same("get the shortcut"),
  "settings.shortcut.missing": same(
    "the shortcut file isn't hosted yet. build it yourself with the steps below, it takes two minutes.",
  ),
  "settings.shortcut.steps": same("build it by hand"),
  "settings.shortcut.step1": same(
    "open shortcuts on your iphone and make a new shortcut called send to scraps.",
  ),
  "settings.shortcut.step2": same("turn on show in share sheet and accept urls, text and images."),
  "settings.shortcut.step3": same(
    "add the action get contents of url. set the url to the address below and the method to post.",
  ),
  "settings.shortcut.step4": same(
    "add a header: authorization, with the value bearer then your token. for text and links send a json body with url, text and title. for a photo send a form with the file.",
  ),
  "settings.shortcut.step5": same("for photos, add convert image to jpeg first. heic isn't kept."),
  "settings.shortcut.step6": same("finish with show notification: saved to scraps."),
  "settings.shortcut.endpoint": same("shortcut address"),
  "settings.shortcut.lost": same(
    "lost your phone? revoke the token and the shortcut stops at once.",
  ),

  // ai suggestions and transcripts (phase 8)
  "settings.ai": same("suggestions"),
  "settings.ai.title": same("suggest where scraps go"),
  "settings.ai.hint": same(
    "when on, a new scrap's text, its link title and the names of your spaces and tags are sent to claude to suggest a space and tags. never pictures or voice. nothing moves unless you say yes.",
  ),
  "ai.optin.title": same("turn on suggestions?"),
  "ai.optin.body": same(
    "scraps can suggest where a new scrap belongs and which tags fit. to do that it sends the scrap's text, its link title and the names of your spaces and tags to claude. never pictures or voice memos. nothing moves unless you say yes, and you can switch it off in settings.",
  ),
  "ai.optin.yes": same("turn on"),
  "ai.optin.no": same("not now"),
  "ai.toast.file": same("file under"),
  "ai.toast.add": same("add"),
  "ai.toast.title": same("call it"),
  "ai.toast.yes": same("yes"),
  "ai.toast.no": same("nah"),
  "ai.toast.none": same("nothing to suggest for this one."),
  "ai.toast.limit": same("that's a lot of asking. try again in a bit."),
  "ai.toast.disabled": same("suggestions are off. switch them on in settings."),
  "ai.toast.unconfigured": same("suggestions aren't set up on this server yet."),
  "ai.toast.notice": same("ai looked at the text of this scrap to suggest this."),
  "ai.toast.notice.link": same("change it in settings"),
  "note.menu.suggest": same("suggest where this goes"),
  "voice.notice": same(
    "voice memos are turned into text by groq. only the audio is sent, nothing else.",
  ),

  "storage.title": same("storage"),
  "storage.used": same("{used} mb of {limit} mb"),
  "storage.warn": same("getting full. delete big pics or voice memos you don't need."),
  "storage.over": same("over the limit. nothing is blocked yet, but please clear some space."),

  // export (phase 9)
  "settings.data": same("your data"),
  "export.hint": same("a zip with one markdown file per scrap, plus your pics and voice memos."),
  "export.button": same("export everything"),
  "export.building": same("packing it up…"),
  "export.download": same("download zip ({n} scraps)"),
  "export.skipped": same("{n} files were too big to fit and were left out."),
  "export.limit": same("you've exported a lot today. try again tomorrow."),
  "export.error": same("couldn't build the export. try again."),

  // account deletion (phase 9)
  "account.delete": same("delete account"),
  "account.delete.title": same("delete your account?"),
  "account.delete.body": same(
    "this removes your profile, your scraps in spaces you own, your capture tokens and your pics and voice memos. it can't be undone.",
  ),
  "account.delete.solo": same("these spaces are only yours, so they'll be deleted: {names}."),
  "account.delete.shared": same("{space} has other people in it"),
  "account.delete.transfer": same("hand it to someone else"),
  "account.delete.transfer_to": same("who gets it"),
  "account.delete.remove": same("delete it for everyone"),
  "account.delete.confirm": same("type your name ({name}) to confirm"),
  "account.delete.yes": same("delete everything"),
  "account.delete.error": same("couldn't delete your account. nothing was lost, try again."),

  // trash (phase 9)
  "trash.title": same("trash"),
  "trash.link": same("trash"),
  "trash.back": same("back to {space}"),
  "trash.hint": same("scraps stay here for {days} days, then they're gone."),
  "trash.empty": same("nothing in the trash. clean."),
  "trash.days_left": same("{n} days left"),
  "trash.restore": same("restore"),
  "trash.delete": same("delete forever"),
  "trash.empty_all": same("empty trash"),
  "trash.owner_only": same("only the owner can delete forever."),
  "trash.confirm.title": same("delete forever?"),
  "trash.confirm.body": same("this scrap and its pics and voice memos are gone for good."),
  "trash.confirm.many": same("{n} scraps, with their pics and voice memos, are gone for good."),
  "trash.confirm.yes": same("delete forever"),
  "trash.error": same("couldn't do that. try again."),

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
