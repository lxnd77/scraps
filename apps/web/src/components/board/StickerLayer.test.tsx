import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { AddStickerButton } from "./StickerLayer";

const KEY = "scraps.hint.board-stickers";
const renderButton = (nudge: boolean) =>
  render(
    <ThemeProvider initialTheme="day">
      <AddStickerButton onPick={vi.fn()} nudge={nudge} />
    </ThemeProvider>,
  );

describe("board sticker button", () => {
  beforeEach(() => window.localStorage.clear());

  it("says what it does, and offers no hint without a nudge", () => {
    renderButton(false);
    expect(screen.getByRole("button", { name: "slap a sticker on" })).toHaveTextContent("sticker");
    expect(screen.queryByText("psst. your board takes stickers too.")).toBeNull();
  });

  it("hints once: 'got it' retires the hint on this device", () => {
    const first = renderButton(true);
    expect(screen.getByRole("status")).toHaveTextContent("psst. your board takes stickers too.");
    fireEvent.click(screen.getByRole("button", { name: "got it" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBe("1");
    first.unmount();

    renderButton(true);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("'show me' opens the picker and retires the hint too", () => {
    renderButton(true);
    fireEvent.click(screen.getByRole("button", { name: "show me" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("dialog", { name: "slap a sticker on" })).toBeInTheDocument();
    expect(window.localStorage.getItem(KEY)).toBe("1");
  });
});
