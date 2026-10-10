import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteCard, cardColor, cardVariant, type NoteCardData, type NoteCardKind } from "./NoteCard";

const labels = {
  more: "more",
  pinned: "pinned",
  forever: "pinned · forever",
  progress: "progress",
  item: (text: string, done: boolean) => `${text} ${done ? "done" : "todo"}`,
  kind: "kind",
};

function note(over: Partial<NoteCardData> = {}): NoteCardData {
  return {
    id: "0190aaaa-0000-7000-8000-000000000001",
    title: "groceries",
    previewText: "some words",
    kind: "text",
    color: "yellow",
    pinned: false,
    preview: {},
    ...over,
  };
}

function renderCard(data: NoteCardData, props: Partial<Parameters<typeof NoteCard>[0]> = {}) {
  return render(
    <NoteCard
      note={data}
      href="/n/1"
      meta="2 min ago"
      untitled="untitled scrap"
      labels={labels}
      {...props}
    />,
  );
}

describe("cardVariant", () => {
  it("picks the component for each kind", () => {
    const expected: Record<NoteCardKind, string> = {
      text: "text",
      list: "list",
      quote: "quote",
      pic: "fallback",
      link: "fallback",
      voice: "fallback",
    };
    for (const [kind, variant] of Object.entries(expected)) {
      expect(cardVariant(kind as NoteCardKind)).toBe(variant);
    }
  });

  it("falls back to yellow for unknown colours", () => {
    expect(cardColor("lime")).toBe("lime");
    expect(cardColor("chartreuse")).toBe("yellow");
  });
});

describe("NoteCard", () => {
  it("renders a text card with title, body and footer", () => {
    const { container } = renderCard(note());
    expect(container.querySelector(".sc-notecard--text")).not.toBeNull();
    expect(screen.getByRole("link", { name: "groceries" })).toHaveAttribute("href", "/n/1");
    expect(screen.getByText("some words")).toBeInTheDocument();
    expect(screen.getByText("2 min ago")).toBeInTheDocument();
  });

  it("falls back to the untitled placeholder", () => {
    renderCard(note({ title: "" }));
    expect(screen.getByRole("link", { name: "untitled scrap" })).toBeInTheDocument();
  });

  it("renders live checkboxes on a list card and reports toggles", () => {
    const onToggleItem = vi.fn();
    const { container } = renderCard(
      note({
        kind: "list",
        preview: {
          checklist: {
            done: 1,
            total: 2,
            items: [
              { text: "milk", done: true },
              { text: "eggs", done: false },
            ],
          },
        },
      }),
      { onToggleItem },
    );
    expect(container.querySelector(".sc-notecard--list")).not.toBeNull();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    const eggs = screen.getByRole("button", { name: "eggs todo" });
    expect(eggs).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(eggs);
    expect(onToggleItem).toHaveBeenCalledWith(1, true);
    expect(screen.getByRole("button", { name: "milk done" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders a quote card with the pinned footer", () => {
    renderCard(note({ kind: "quote", pinned: true, preview: { quote: "go outside" } }));
    expect(screen.getByRole("link", { name: "go outside" })).toBeInTheDocument();
    expect(screen.getByText("pinned · forever")).toBeInTheDocument();
  });

  it("uses a neutral fallback for kinds that arrive in Phase 4", () => {
    const { container } = renderCard(note({ kind: "voice" }));
    expect(container.querySelector(".sc-notecard--fallback")).not.toBeNull();
  });

  it("offers the menu as a separate labelled button", () => {
    const onMenu = vi.fn();
    renderCard(note(), { onMenu });
    fireEvent.click(screen.getByRole("button", { name: "more" }));
    expect(onMenu).toHaveBeenCalled();
  });
});
