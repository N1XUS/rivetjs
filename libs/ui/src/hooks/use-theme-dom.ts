// DOM helpers of `useTheme` (`use-theme.tsx`). A `.ts` module: the compiler checks browser globals in `.tsx` render code (RV2001), and these run
// only from client effects / `setTheme`.
import type { ResolvedTheme, ThemeChoice } from "./use-theme.tsx";

export const isTheme = (value: unknown): value is ThemeChoice => value === "light" || value === "dark" || value === "system";

export function readStored(key: string | undefined): ThemeChoice | undefined {
  if (!key) return undefined;
  try {
    const value = localStorage.getItem(key);
    return isTheme(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function readRoot(): ResolvedTheme | undefined {
  const root = document.documentElement;
  const attr = root.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";
  return undefined;
}

export function applyRoot(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.setAttribute("data-theme", resolved);
  root.style.setProperty("color-scheme", resolved);
}

export function writeStored(key: string | undefined, value: ThemeChoice): void {
  if (!key) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
}
