import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoteCard, type NoteCardData } from "./NoteCard";

const labels = {
  item: (text: string, done: boolean) => `${text} ${done ? "done" : "open"}`,
  progress: "progress",
};

function card(done: number, total = 3): NoteCardData {
  return {
    id: "n1",
    title: "trip",
    previewText: "",
    kind: "list",
    color: "lime",
    pinned: false,
    preview: {
      checklist: {
        done,
        total,
        items: Array.from({ length: total }, (_, i) => ({ text: `item ${i}`, done: i < done })),
      },
    },
  };
}

// the other required props differ by version; the burst only depends on the checklist numbers
const renderCard = (note: NoteCardData) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal props for a behaviour test
  <NoteCard {...({ note, labels, href: "/n/n1", untitled: "untitled" } as any)} />;

describe("checklist burst", () => {
  it("fires when the last item is ticked, not on first render", () => {
    const { container, rerender } = render(renderCard(card(3)));
    expect(container.querySelector(".sc-burst")).toBeNull();

    rerender(renderCard(card(2)));
    expect(container.querySelector(".sc-burst")).toBeNull();

    rerender(renderCard(card(3)));
    expect(container.querySelectorAll(".sc-burst__spark")).toHaveLength(6);
  });

  it("does not fire when the list grows or an item is unticked", () => {
    const { container, rerender } = render(renderCard(card(2, 3)));
    rerender(renderCard(card(2, 2))); // total shrank, now complete: not a tick
    expect(container.querySelector(".sc-burst")).toBeNull();
    rerender(renderCard(card(1, 2)));
    expect(container.querySelector(".sc-burst")).toBeNull();
  });
});
