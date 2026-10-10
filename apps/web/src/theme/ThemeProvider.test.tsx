import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeaderThemeToggle } from "./HeaderThemeToggle";
import { ThemeProvider } from "./ThemeProvider";
import { THEME_COOKIE, THEME_INIT_SCRIPT, resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("auto follows the device", () => {
    expect(resolveTheme("auto", true)).toBe("midnight");
    expect(resolveTheme("auto", false)).toBe("day");
  });

  it("explicit choices ignore the device", () => {
    expect(resolveTheme("day", true)).toBe("day");
    expect(resolveTheme("midnight", false)).toBe("midnight");
  });
});

describe("ThemeProvider + header toggle", () => {
  it("toggles aria-checked, sets data-theme and writes the cookie", () => {
    render(
      <ThemeProvider initialTheme="day">
        <HeaderThemeToggle />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole("switch", { name: "after midnight" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement).toHaveAttribute("data-theme", "day");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "midnight");
    expect(document.cookie).toContain(`${THEME_COOKIE}=midnight`);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(document.cookie).toContain(`${THEME_COOKIE}=day`);
  });

  it("auto resolves from the media query", () => {
    window.__prefersDark = true;
    render(
      <ThemeProvider initialTheme="auto">
        <HeaderThemeToggle />
      </ThemeProvider>,
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "midnight");
    window.__prefersDark = false;
  });

  it("reports the change to the caller (Phase 1 persists it to the profile)", () => {
    const onThemeChange = vi.fn();
    render(
      <ThemeProvider initialTheme="day" onThemeChange={onThemeChange}>
        <HeaderThemeToggle />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onThemeChange).toHaveBeenCalledWith("midnight");
  });
});

describe("head script", () => {
  function run(cookie: string, dark: boolean) {
    document.cookie = cookie;
    window.__prefersDark = dark;
    new Function(THEME_INIT_SCRIPT)();
    window.__prefersDark = false;
  }

  it("applies the cookie before React runs", () => {
    run(`${THEME_COOKIE}=midnight; path=/`, false);
    expect(document.documentElement).toHaveAttribute("data-theme", "midnight");
  });

  it("falls back to the device when the cookie is missing or auto", () => {
    run(`${THEME_COOKIE}=auto; path=/`, true);
    expect(document.documentElement).toHaveAttribute("data-theme", "midnight");
    run(`${THEME_COOKIE}=; path=/`, false);
    expect(document.documentElement).toHaveAttribute("data-theme", "day");
  });
});
