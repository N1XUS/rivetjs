// `useTheme()`: reads and sets the colour theme on `<html>` (HeroUI themes = a `light` / `dark` class plus `data-theme` on the root).
// - `theme()`: the stored choice, `"light" | "dark" | "system"` (initial: `defaultTheme`, else what `<html>` shows, else "system").
// - `resolvedTheme()`: `"light" | "dark"` (`system` follows `prefers-color-scheme`, live).
// - `setTheme(t)`: writes the class, `data-theme` and `color-scheme` on `document.documentElement` (no-op on the server) and, if
//   `storageKey` is given, `localStorage` (reads are try/caught: private mode safe). Persistence across loads is NOT automatic.
// Server / resumed markup: `resolvedTheme()` is `defaultResolved` ("light") until the client effect ran.
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { applyRoot, readRoot, readStored, writeStored } from "./use-theme-dom.ts";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface UseThemeOptions {
  /** Initial choice when `<html>` shows none and nothing is stored. @default "system" */
  defaultTheme?: ThemeChoice;
  /** `localStorage` key to read the initial choice from and write `setTheme` to. */
  storageKey?: string;
}

export interface UseThemeReturn {
  theme: () => ThemeChoice;
  resolvedTheme: () => ResolvedTheme;
  setTheme: (theme: ThemeChoice) => void;
}

export function useTheme(options: UseThemeOptions = {}): UseThemeReturn {
  const choice = signal<ThemeChoice>(options.defaultTheme ?? "system");
  const systemDark = signal(false);
  clientEffect(() => {
    const stored = readStored(options.storageKey);
    if (stored) choice.set(stored);
    else {
      const shown = readRoot();
      if (shown && options.defaultTheme === undefined) choice.set(shown);
    }
    if (typeof matchMedia !== "function") return;
    const list = matchMedia("(prefers-color-scheme: dark)");
    systemDark.set(list.matches);
    const onChange = (event: MediaQueryListEvent): void => {
      systemDark.set(event.matches);
    };
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  });
  const resolvedTheme = (): ResolvedTheme => {
    const value = choice();
    return value === "system" ? (systemDark() ? "dark" : "light") : value;
  };
  // Keep <html> in step with the choice / system preference once the client runs (only after an explicit setTheme or a stored choice).
  let touched = false;
  clientEffect(() => {
    const resolved = resolvedTheme();
    if (touched || readStored(options.storageKey)) applyRoot(resolved);
  });
  return {
    theme: choice,
    resolvedTheme,
    setTheme(next: ThemeChoice) {
      touched = true;
      choice.set(next);
      if (typeof document !== "undefined") applyRoot(next === "system" ? (systemDark() ? "dark" : "light") : next);
      writeStored(options.storageKey, next);
    },
  };
}
