import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { tiltFor, tiltIndex } from "../lib";
import { AvatarStack } from "./Avatar";
import { Card } from "./Card";
import { Checkbox } from "./Checkbox";
import { Menu } from "./Menu";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("is a switch that reflects the resolved theme", () => {
    const { rerender } = render(<ThemeToggle isMidnight={false} onToggle={() => {}} />);
    const toggle = screen.getByRole("switch", { name: "after midnight" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    rerender(<ThemeToggle isMidnight onToggle={() => {}} />);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("asks for the opposite explicit theme when tapped", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ThemeToggle isMidnight={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenLastCalledWith("midnight");
    rerender(<ThemeToggle isMidnight onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenLastCalledWith("day");
  });
});

describe("Card tilt", () => {
  it("is stable for the same id and always one of the four tokens", () => {
    const id = "0191f3c0-7b1e-7c3a-9d2e-5a1f0c2b3d4e";
    expect(tiltFor(id)).toBe(tiltFor(id));
    expect(tiltIndex(id)).toBeGreaterThanOrEqual(1);
    expect(tiltIndex(id)).toBeLessThanOrEqual(4);
  });

  it("spreads ids across all four tilts", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(tiltIndex(`note-${i}`));
    expect(seen.size).toBe(4);
  });

  it("applies the tilt token, and tidy mode removes it", () => {
    const { rerender } = render(<Card id="abc" data-testid="card" />);
    expect(screen.getByTestId("card").style.getPropertyValue("--tilt")).toBe(tiltFor("abc"));
    rerender(<Card id="abc" tidy data-testid="card" />);
    expect(screen.getByTestId("card").style.getPropertyValue("--tilt")).toBe("0deg");
    // a note card tilts by its note id without taking it as the element id
    rerender(<Card tiltKey="abc" data-testid="card" />);
    expect(screen.getByTestId("card").style.getPropertyValue("--tilt")).toBe(tiltFor("abc"));
    expect(screen.getByTestId("card").id).toBe("");
  });
});

describe("Checkbox", () => {
  it("is a toggle button with aria-pressed", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} aria-label="drink water" />);
    const box = screen.getByRole("button", { name: "drink water" });
    expect(box).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("AvatarStack", () => {
  it("collapses people past max into +N", () => {
    const people = ["maya", "dev", "sam", "kai", "lou"].map((name) => ({ name }));
    render(<AvatarStack people={people} max={3} />);
    expect(screen.getByLabelText("and 2 more")).toHaveTextContent("+2");
  });
});

describe("Menu", () => {
  it("moves focus with arrow keys and wraps", () => {
    const items = ["text", "checklist", "callout"].map((id) => ({
      id,
      label: id,
      onSelect: () => {},
    }));
    render(<Menu label="drop a block" items={items} focusOnMount />);
    const [first, second, third] = screen.getAllByRole("menuitem");
    expect(first).toHaveFocus();
    fireEvent.keyDown(first!, { key: "ArrowDown" });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second!, { key: "ArrowUp" });
    fireEvent.keyDown(first!, { key: "ArrowUp" });
    expect(third).toHaveFocus();
  });
});
