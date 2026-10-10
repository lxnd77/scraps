"use client";

import { Highlight } from "@scraps/ui";
import { Fragment, useCallback, type ReactNode } from "react";
import { useTheme } from "@/theme/ThemeProvider";
import { splitHighlight, t, type CopyKey } from "./en";

/** `t()` bound to the resolved theme, so night copy shows whenever midnight is on. */
export function useT() {
  const { resolved } = useTheme();
  const night = resolved === "midnight";
  return useCallback(
    (key: CopyKey, vars?: Record<string, string | number>) => t(key, vars, { night }),
    [night],
  );
}

/** Renders `**phrase**` markers as accent pills. */
export function RichCopy({ text }: { text: string }): ReactNode {
  return (
    <>
      {splitHighlight(text).map((part, index) => (
        <Fragment key={index}>
          {part.highlight ? <Highlight>{part.text}</Highlight> : part.text}
        </Fragment>
      ))}
    </>
  );
}
