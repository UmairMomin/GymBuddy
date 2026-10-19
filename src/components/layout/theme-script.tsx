"use client";

import * as React from "react";
import { applyTheme, buildThemeInitScript, parseTheme, readStoredThemeRaw } from "@/lib/theme";

/** Runs synchronously while the HTML is parsed so the saved theme paints on the first frame. */
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }}
    />
  );
}

/** Re-applies the theme when the OS appearance changes (only matters for the "System" mode). */
export function ThemeSync() {
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme(parseTheme(readStoredThemeRaw()));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}
