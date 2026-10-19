export type ThemeMode = "dark" | "light" | "system";
export type AccentId = "lime" | "peach" | "sky" | "rose" | "mint" | "butter";

export type ThemePrefs = { mode: ThemeMode; accent: AccentId };

export const THEME_STORAGE_KEY = "gt-appearance";
export const THEME_EVENT = "gt-appearance-change";
export const DEFAULT_THEME: ThemePrefs = { mode: "dark", accent: "lime" };

/** `bg` = dark-mode ground, `lightBg` = pastel light-mode ground; both feed the browser theme-color. */
export const ACCENTS: ReadonlyArray<{
  id: AccentId;
  name: string;
  swatch: string;
  bg: string;
  lightBg: string;
}> = [
  { id: "lime", name: "Pastel Lime", swatch: "#D4F28A", bg: "#0B0B0C", lightBg: "#F3FADB" },
  { id: "peach", name: "Peach", swatch: "#FFB88C", bg: "#0C0A09", lightBg: "#FFF0E6" },
  { id: "sky", name: "Sky", swatch: "#A8CBFF", bg: "#080A10", lightBg: "#EAF2FF" },
  { id: "rose", name: "Rose", swatch: "#FFB3BB", bg: "#0C0809", lightBg: "#FFEBEE" },
  { id: "mint", name: "Mint", swatch: "#9AF0D5", bg: "#070F0D", lightBg: "#E6FAF3" },
  { id: "butter", name: "Butter", swatch: "#FFE08A", bg: "#0C0B08", lightBg: "#FFF7DB" },
];

export function parseTheme(raw: string | null): ThemePrefs {
  if (!raw) return DEFAULT_THEME;
  try {
    const v = JSON.parse(raw) as Partial<ThemePrefs>;
    const mode: ThemeMode =
      v.mode === "light" || v.mode === "system" || v.mode === "dark" ? v.mode : DEFAULT_THEME.mode;
    const accent: AccentId = ACCENTS.some((a) => a.id === v.accent)
      ? (v.accent as AccentId)
      : DEFAULT_THEME.accent;
    return { mode, accent };
  } catch {
    return DEFAULT_THEME;
  }
}

export function readStoredThemeRaw(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Applies the theme to <html> and the theme-color meta tag. Client-only. */
export function applyTheme(prefs: ThemePrefs) {
  const root = document.documentElement;
  const resolved =
    prefs.mode === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : prefs.mode;
  root.dataset.mode = resolved;
  root.dataset.accent = prefs.accent;
  const accent = ACCENTS.find((a) => a.id === prefs.accent) ?? ACCENTS[0];
  const bg = resolved === "light" ? accent.lightBg : accent.bg;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}

export function saveTheme(prefs: ThemePrefs) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be blocked (private mode); the theme still applies for this page view.
  }
  applyTheme(prefs);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Source of the pre-paint script that sets data-mode / data-accent before React hydrates. */
export function buildThemeInitScript(): string {
  const bgMap = JSON.stringify(Object.fromEntries(ACCENTS.map((a) => [a.id, [a.bg, a.lightBg]])));
  return `(function(){try{var d=document.documentElement,s={};try{s=JSON.parse(localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )})||"{}")}catch(e){}var bg=${bgMap};var a=bg[s.accent]?s.accent:"${DEFAULT_THEME.accent}";var m=s.mode==="light"||s.mode==="system"?s.mode:"dark";if(m==="system")m=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";d.dataset.mode=m;d.dataset.accent=a;var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute("content",bg[a][m==="light"?1:0])}catch(e){}})()`;
}
