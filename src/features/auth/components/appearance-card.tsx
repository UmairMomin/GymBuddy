"use client";

import * as React from "react";
import { Check, Monitor, Moon, Palette, Sun, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACCENTS,
  THEME_EVENT,
  parseTheme,
  readStoredThemeRaw,
  saveTheme,
  type AccentId,
  type ThemeMode,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const MODES: ReadonlyArray<{ id: ThemeMode; label: string; icon: LucideIcon }> = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Monitor },
];

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function AppearanceCard() {
  const raw = React.useSyncExternalStore(subscribe, readStoredThemeRaw, () => null);
  const theme = React.useMemo(() => parseTheme(raw), [raw]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
          <Palette className="h-4 w-4 text-emerald-400" />
          <span>Appearance</span>
        </CardTitle>
        <CardDescription className="text-xs">
          Pick light or dark, and an accent color. Saved on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div role="radiogroup" aria-label="Color mode" className="grid grid-cols-3 gap-2">
          {MODES.map(({ id, label, icon: Icon }) => {
            const selected = theme.mode === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => saveTheme({ ...theme, mode: id })}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition-all active:scale-95",
                  selected
                    ? "border-accent-ink bg-emerald-500 text-accent-ink ring-2 ring-emerald-500/40"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </div>

        <div role="radiogroup" aria-label="Accent color" className="grid grid-cols-3 gap-2">
          {ACCENTS.map((a) => {
            const selected = theme.accent === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => saveTheme({ ...theme, accent: a.id as AccentId })}
                className={cn(
                  "flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-semibold transition-all active:scale-95",
                  selected
                    ? "border-zinc-50 bg-zinc-900 text-zinc-50 ring-2 ring-emerald-500/50"
                    : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                )}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-black/20"
                  style={{ backgroundColor: a.swatch }}
                >
                  {selected && <Check className="h-4 w-4 text-[#1e1e22]" strokeWidth={3} />}
                </span>
                {a.name}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
