"use client";

import {
  ACCENTS,
  Avatar,
  AvatarStack,
  BrandMark,
  Button,
  Card,
  Checkbox,
  CountBadge,
  Dialog,
  FilterChip,
  Menu,
  ProgressBar,
  PropertyChip,
  SearchField,
  Sheet,
  Skeleton,
  Sparkle,
  SpaceDot,
  STICKER_IDS,
  Sticker,
  SyncChip,
  TagChip,
  Tape,
  ThemeToggle,
  Toast,
  Waveform,
  type CardColor,
} from "@scraps/ui";
import { CheckSquare, Heading2, LayoutGrid, Plus, Type } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { t } from "@/copy/en";
import { GREETINGS } from "@/copy/greetings";
import { RichCopy } from "@/copy/useT";
import { TokenSwatches } from "./TokenSwatches";

const PEAKS = [10, 18, 26, 14, 30, 22, 12, 28, 34, 20, 16, 26, 10, 22, 30, 18, 12, 24, 32, 16];
const FILTERS = [
  ["everything", 9],
  ["notes", 2],
  ["lists", 2],
  ["pics", 2],
  ["links", 1],
  ["voice", 1],
] as const;
const CARD_COLORS: CardColor[] = [...ACCENTS, "surface"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h3 className="sc-label" style={{ margin: 0, color: "var(--ink-muted)" }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

const row = { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" } as const;

export function Showcase({ night }: { night: boolean }) {
  const id = useId();
  const [filter, setFilter] = useState<string>("everything");
  const [done, setDone] = useState<boolean[]>([true, false, false, false]);
  const [lg, setLg] = useState(night);
  const [md, setMd] = useState(night);
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const items = [
    "drink a glass of water",
    "plug in phone",
    "stop doomscrolling",
    "close your eyes",
  ];
  const doneCount = done.filter(Boolean).length;
  const variant = night ? ("night" as const) : ("day" as const);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <Section title="greeting copy">
        <p
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "-0.045em",
            lineHeight: 1.05,
          }}
        >
          <RichCopy text={GREETINGS[variant === "night" ? "late" : "morning"].board[0]!} />
        </p>
        <p className="sc-mono" style={{ margin: 0, fontSize: 12 }}>
          {t("board.kicker", { weekday: "fri", time: "3:07 am", space: "brain dump" }, { night })}
        </p>
      </Section>

      <Section title="tokens">
        <TokenSwatches />
      </Section>

      <Section title="type scale">
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-hero)",
            fontWeight: 800,
            letterSpacing: "-0.045em",
            lineHeight: 1.02,
          }}
        >
          hero greeting
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-h2)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
          }}
        >
          section heading
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-card-title)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          card title
        </p>
        <p style={{ margin: 0, fontSize: "var(--text-body-lg)", lineHeight: 1.55 }}>
          editor paragraph. type anything, we&apos;ll figure out what it is.
        </p>
        <p style={{ margin: 0, fontSize: "var(--text-body)", lineHeight: 1.45 }}>card body text.</p>
        <p className="sc-label" style={{ margin: 0 }}>
          mono label · 2 min ago
        </p>
      </Section>

      <Section title="buttons">
        <div style={row}>
          <Button color="pink">
            <Plus size={20} strokeWidth={3} aria-hidden="true" />
            {t("action.new_scrap")}
          </Button>
          <Button color="yellow">save it</Button>
          <Button color="lime">paste</Button>
          <Button variant="dark">share</Button>
          <Button variant="ghost">cancel</Button>
          <Button variant="primary" disabled>
            disabled
          </Button>
          <Button variant="icon" aria-label="switch layout">
            <LayoutGrid size={22} strokeWidth={2.3} aria-hidden="true" />
          </Button>
          <Button variant="icon" size="sm" aria-label="add block">
            <Plus size={20} strokeWidth={2.6} aria-hidden="true" />
          </Button>
        </div>
      </Section>

      <Section title="chips">
        <div role="group" aria-label="filter by type" style={row}>
          {FILTERS.map(([label, count]) => (
            <FilterChip
              key={label}
              pressed={filter === label}
              count={count}
              onClick={() => setFilter(label)}
            >
              {label}
            </FilterChip>
          ))}
        </div>
        <div style={row}>
          <PropertyChip label="vibe">chaotic</PropertyChip>
          <PropertyChip label="when">fri 14 nov</PropertyChip>
          {ACCENTS.map((color) => (
            <TagChip key={color} color={color}>
              #{color}
            </TagChip>
          ))}
          <CountBadge>3/7</CountBadge>
        </div>
      </Section>

      <Section title="theme toggle">
        <div style={row}>
          <ThemeToggle size="lg" isMidnight={lg} onToggle={(next) => setLg(next === "midnight")} />
          <ThemeToggle size="md" isMidnight={md} onToggle={(next) => setMd(next === "midnight")} />
          <span className="sc-mono" style={{ fontSize: 12 }}>
            demo only, the header one is real
          </span>
        </div>
      </Section>

      <Section title="cards">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 24,
            padding: "8px 8px 12px",
          }}
        >
          {CARD_COLORS.map((color) => (
            <Card key={color} id={`${id}-${color}`} color={color} style={{ padding: 20 }}>
              <h4 className="sc-card__title">{color} card</h4>
              <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.45 }}>
                made total sense at 3am. revisit in daylight.
              </p>
              <p className="sc-mono" style={{ margin: "14px 0 0", fontSize: 11 }}>
                3:02 am · 21 words
              </p>
            </Card>
          ))}

          <Card id={`${id}-polaroid`} color="polaroid" style={{ padding: "12px 12px 16px" }}>
            <Tape />
            <div
              role="img"
              aria-label="blue block standing in for a photo"
              className="sc-fill-blue"
              style={{
                height: 120,
                border: "var(--border-sm) solid var(--on-accent)",
                borderRadius: "var(--radius-sm)",
              }}
            />
            <div
              style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 8 }}
            >
              <span style={{ fontWeight: 700, fontSize: 18 }}>night drive</span>
              <span className="sc-mono" style={{ fontSize: 11 }}>
                +8 pics
              </span>
            </div>
          </Card>

          <Card id={`${id}-list`} color="lime" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 className="sc-card__title" style={{ fontSize: 22 }}>
                before bed (lol)
              </h4>
              <CountBadge>
                {doneCount}/{items.length}
              </CountBadge>
            </div>
            <div style={{ marginTop: 8 }}>
              {items.map((item, index) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Checkbox
                    aria-label={item}
                    checked={Boolean(done[index])}
                    onChange={(next) => setDone((d) => d.map((v, i) => (i === index ? next : v)))}
                  />
                  <span className={done[index] ? "sc-done" : undefined} style={{ fontWeight: 500 }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <ProgressBar label="checklist progress" value={doneCount} max={items.length} />
            </div>
          </Card>

          <Card id={`${id}-voice`} color="lilac" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 48,
                  height: 48,
                  flex: "none",
                  borderRadius: "50%",
                  background: "var(--on-accent)",
                }}
              />
              <Waveform peaks={PEAKS} progress={0.4} height={40} />
              <span className="sc-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                1:06
              </span>
            </div>
            <h4 className="sc-card__title" style={{ fontSize: 20, marginTop: 14 }}>
              voice note to future me
            </h4>
          </Card>

          <Card id={`${id}-quote`} color="pink" style={{ padding: "26px 22px 20px" }}>
            <Sticker id="sleepy-moon" size={58} className="sc-quote-sticker" />
            <p
              style={{
                margin: 0,
                fontSize: 40,
                fontWeight: 800,
                lineHeight: 0.95,
                letterSpacing: "-0.05em",
              }}
            >
              go to sleep.
            </p>
          </Card>
        </div>
      </Section>

      <Section title="people and search">
        <div style={row}>
          <Avatar name="maya" color="yellow" />
          <Avatar name="dev" color="lime" sticker="smiley" />
          <AvatarStack
            people={[
              { name: "maya", color: "yellow" },
              { name: "dev", color: "lime" },
              { name: "sam", color: "pink" },
              { name: "kai", color: "lilac" },
              { name: "lou", color: "orange" },
            ]}
          />
        </div>
        <SearchField
          aria-label="search scraps"
          placeholder={t("search.placeholder", {}, { night })}
          hint="⌘K"
        />
      </Section>

      <Section title="status">
        <div style={row}>
          <SyncChip state="saved" />
          <SyncChip state="syncing" />
          <SyncChip state="slow" />
          <SyncChip state="offline" />
          <SyncChip state="error" />
        </div>
        <div style={row}>
          {ACCENTS.map((color) => (
            <span key={color} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <SpaceDot color={color} />
              <span className="sc-mono" style={{ fontSize: 12 }}>
                {color}
              </span>
            </span>
          ))}
        </div>
        <Skeleton height={96} />
      </Section>

      <Section title="toast">
        <Toast>copied. paste it anywhere.</Toast>
        <Toast variant="suggestion">
          file under <strong>side quests</strong>? add #travel #money
        </Toast>
      </Section>

      <Section title="menu">
        <Menu
          label="drop a block"
          items={[
            {
              id: "text",
              label: "text",
              description: "just start typing",
              icon: <Type size={20} aria-hidden="true" />,
              shortcut: "/text",
              onSelect: () => {},
            },
            {
              id: "todo",
              label: "checklist",
              description: "things to tick off",
              icon: <CheckSquare size={20} aria-hidden="true" />,
              shortcut: "[]",
              onSelect: () => {},
            },
            {
              id: "h2",
              label: "heading",
              description: "a section title",
              icon: <Heading2 size={20} aria-hidden="true" />,
              shortcut: "##",
              onSelect: () => {},
            },
          ]}
        />
      </Section>

      <Section title="dialog and sheet">
        <div style={row}>
          <Button variant="ghost" onClick={() => setDialog(true)}>
            open dialog
          </Button>
          <Button variant="ghost" onClick={() => setSheet(true)}>
            open sheet
          </Button>
        </div>
        <Dialog open={dialog} onClose={() => setDialog(false)} title="new space">
          <p style={{ marginTop: 0 }}>give it a name and a colour.</p>
          <Button onClick={() => setDialog(false)}>save it</Button>
        </Dialog>
        <Sheet open={sheet} onClose={() => setSheet(false)} title="new scrap">
          <p style={{ marginTop: 0 }}>{t("capture.placeholder", {}, { night })}</p>
          <Button onClick={() => setSheet(false)}>{t("capture.save", {}, { night })}</Button>
        </Sheet>
      </Section>

      <Section title="stickers and decoration">
        <div style={row}>
          {STICKER_IDS.map((stickerId) => (
            <Sticker key={stickerId} id={stickerId} size={64} title={stickerId.replace("-", " ")} />
          ))}
        </div>
        <div style={row}>
          <BrandMark />
          <Sparkle color="yellow" />
          <Sparkle color="pink" size={14} />
          <Sparkle color="ink" size={18} />
        </div>
      </Section>
    </div>
  );
}
