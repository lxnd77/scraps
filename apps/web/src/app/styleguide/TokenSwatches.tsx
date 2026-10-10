"use client";

import { useEffect, useRef, useState } from "react";
import { contrastRatio } from "./contrast";

const SWATCHES = [
  "--c-yellow",
  "--c-lime",
  "--c-pink",
  "--c-blue",
  "--c-lilac",
  "--c-orange",
  "--bg",
  "--surface",
  "--surface-2",
  "--ink",
  "--ink-muted",
  "--on-accent",
  "--on-blue",
  "--inverse-bg",
  "--inverse-ink",
] as const;

// The only text pairs the system allows (see tokens.css).
const PAIRS: Array<[fg: string, bg: string]> = [
  ["--ink", "--bg"],
  ["--ink", "--surface"],
  ["--ink", "--surface-2"],
  ["--ink-muted", "--bg"],
  ["--ink-muted", "--surface"],
  ["--ink-muted", "--surface-2"],
  ["--on-accent", "--c-yellow"],
  ["--on-accent", "--c-lime"],
  ["--on-accent", "--c-pink"],
  ["--on-accent", "--c-lilac"],
  ["--on-accent", "--c-orange"],
  ["--on-blue", "--c-blue"],
  ["--inverse-ink", "--inverse-bg"],
];

type Values = Record<string, string>;

/** Reads resolved token values from the nearest themed ancestor, so each panel shows its own theme. */
export function TokenSwatches() {
  const ref = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Values>({});

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const next: Values = {};
    for (const name of new Set([...SWATCHES, ...PAIRS.flat()])) {
      next[name] = style.getPropertyValue(name).trim();
    }
    setValues(next);
  }, []);

  return (
    <div ref={ref}>
      <ul
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 10,
          margin: 0,
          padding: 0,
          listStyle: "none",
        }}
      >
        {SWATCHES.map((name) => (
          <li key={name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              aria-hidden="true"
              style={{
                height: 44,
                border: "var(--border-sm) solid var(--line)",
                borderRadius: "var(--radius-sm)",
                background: `var(${name})`,
              }}
            />
            <span className="sc-mono" style={{ fontSize: 11 }}>
              {name}
            </span>
            <span className="sc-mono" style={{ fontSize: 11, color: "var(--ink-muted)" }}>
              {values[name] ?? ""}
            </span>
          </li>
        ))}
      </ul>

      <table style={{ marginTop: 16, borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <caption className="sc-label" style={{ textAlign: "left", paddingBottom: 6 }}>
          text pairs (aa needs 4.5)
        </caption>
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: "left" }}>
              text
            </th>
            <th scope="col" style={{ textAlign: "left" }}>
              on
            </th>
            <th scope="col" style={{ textAlign: "right" }}>
              ratio
            </th>
          </tr>
        </thead>
        <tbody>
          {PAIRS.map(([fg, bg]) => {
            const ratio = values[fg] && values[bg] ? contrastRatio(values[fg]!, values[bg]!) : null;
            return (
              <tr key={`${fg}/${bg}`} style={{ borderTop: "1px solid var(--divider-soft)" }}>
                <td className="sc-mono">{fg}</td>
                <td className="sc-mono">{bg}</td>
                <td className="sc-mono" style={{ textAlign: "right" }}>
                  {ratio === null
                    ? "…"
                    : `${ratio.toFixed(1)}:1${ratio >= 4.5 ? " pass" : " FAIL"}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
