// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no app layout). Feature set inspired by HeroUI Pro's public AppLayout
// docs; independent implementation. Serializable state of `AppLayout` (aside open state, mobile aside sheet, panel sizes)
// as plain signals + free functions (resume-safe: no closures are created here).
import { controllable, controlledValue, setControlledValue, type ControlledState } from "@rivetjs/cdk/interactions";
import { matchesSidebarShortcut, parseSidebarShortcut } from "@rivetjs/cdk/sidebar/state";
import { signal, untrack, type Signal } from "@rivetjs/reactivity";

/** Cookie holding the aside's open state (`true` / `false`), written on every change. */
export const ASIDE_COOKIE_NAME = "aside_state";
export const ASIDE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
/** Below this width the aside is hidden (`asideMobile="hidden"`) or becomes a sheet (`"sheet"`). */
export const ASIDE_BREAKPOINT = 1024;

/** A panel size: a number = percent of the layout width, a string = any CSS length (`"280px"`, `"20rem"`). */
export type AppLayoutSize = number | string;

export interface AsideStateProps {
  /** Open state of the aside (controlled): a value, a two-way Signal or an accessor. */
  asideOpen?: boolean | Signal<boolean> | (() => boolean);
  /** @default true */
  defaultAsideOpen?: boolean;
  onAsideOpenChange?: (open: boolean) => void;
  /** Shortcut toggling the aside (`"mod+shift+b"`, `sidebar` shortcut syntax); off by default. */
  asideToggleShortcut?: string | false | null;
}

/** Aside state (serializable). */
export interface AsideState {
  readonly control: ControlledState<boolean>;
  /** Whether the mobile sheet (`asideMobile="sheet"`) is open. */
  readonly mobileOpen: Signal<boolean>;
  readonly shortcut: string | null;
}

export function createAsideState(props: AsideStateProps): AsideState {
  return {
    control: controllable<boolean>(props.asideOpen, props.defaultAsideOpen ?? true, props.onAsideOpenChange),
    mobileOpen: signal(false),
    shortcut: props.asideToggleShortcut || null,
  };
}

export const isAsideOpen = (state: AsideState): boolean => state.control.value();

/** Writes the aside cookie (browser only). */
export function writeAsideCookie(open: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ASIDE_COOKIE_NAME}=${open}; path=/; max-age=${ASIDE_COOKIE_MAX_AGE}`;
}

/** Sets the desktop aside open state (controlled: `onAsideOpenChange`), then writes the cookie. */
export function setAsideOpen(state: AsideState, value: boolean | ((open: boolean) => boolean)): void {
  untrack(() => {
    const next = typeof value === "function" ? value(controlledValue(state.control)) : value;
    setControlledValue(state.control, next);
    writeAsideCookie(next);
  });
}

/** Whether the viewport is below `ASIDE_BREAKPOINT` (`false` on the server). */
export const asideViewportIsMobile = (): boolean => typeof window !== "undefined" && window.innerWidth < ASIDE_BREAKPOINT;

/** Toggles the aside: the mobile sheet below 1024 px when `sheet` is on, else the desktop aside. */
export function toggleAside(state: AsideState, sheet: boolean): void {
  if (sheet && asideViewportIsMobile()) untrack(() => state.mobileOpen.set(!state.mobileOpen()));
  else setAsideOpen(state, (open) => !open);
}

const handledShortcuts = new WeakSet<Event>();

/** The aside shortcut handler (delegated wrapper keydown + window listener: an event is handled once). */
export function asideShortcutKeyDown(event: KeyboardEvent, state: AsideState, sheet: boolean): void {
  if (handledShortcuts.has(event) || !state.shortcut) return;
  const spec = parseSidebarShortcut(state.shortcut);
  if (spec && matchesSidebarShortcut(event, spec)) {
    handledShortcuts.add(event);
    event.preventDefault();
    toggleAside(state, sheet);
  }
}

/**
 * The persisted aside state for SSR from a cookie header, a cookie map (`get(name)`) or the value; `undefined` when absent.
 * Use: `defaultAsideOpen={asideCookieOpen(cookies) ?? true}`.
 */
export function asideCookieOpen(source: string | { get(name: string): string | undefined } | null | undefined): boolean | undefined {
  if (source == null) return undefined;
  let value: string | undefined;
  if (typeof source === "string") {
    if (source === "true" || source === "false") value = source;
    else
      for (const part of source.split(";")) {
        const [name, ...rest] = part.trim().split("=");
        if (name === ASIDE_COOKIE_NAME) value = rest.join("=");
      }
  } else value = source.get(ASIDE_COOKIE_NAME);
  return value === "true" ? true : value === "false" ? false : undefined;
}

// =================================================================================================
// Resizable panels (WAI-ARIA window splitter)
// =================================================================================================

/** A size as CSS: numbers are percents of the layout width (`cqw`: the layout root is an inline-size container). */
export const cssSize = (size: AppLayoutSize): string => (typeof size === "number" ? `${size}cqw` : size);

/** The clamped CSS width (`clamp(min, size, max)`). */
export const clampedSize = (size: AppLayoutSize, min: AppLayoutSize, max: AppLayoutSize): string => `clamp(${cssSize(min)}, ${cssSize(size)}, ${cssSize(max)})`;

/** Size state of one resizable panel (serializable). */
export interface PanelSizeState {
  /** Current size (`AppLayoutSize`). */
  readonly size: Signal<AppLayoutSize>;
  readonly min: AppLayoutSize;
  readonly max: AppLayoutSize;
  readonly defaultSize: AppLayoutSize;
  readonly pixels: boolean;
  /** Storage key (`resizableAutoSaveId`) or `null`. */
  readonly storageKey: string | null;
}

export function createPanelSizeState(
  defaultSize: AppLayoutSize,
  min: AppLayoutSize,
  max: AppLayoutSize,
  behavior: "preserve-relative-size" | "preserve-pixel-size" | undefined,
  storageKey: string | null,
): PanelSizeState {
  return { size: signal(defaultSize), min, max, defaultSize, pixels: behavior === "preserve-pixel-size", storageKey };
}

/** A length in px (`%` of `total`, `px`, `rem` / `em` at 16 px; else `fallback`). */
export function sizeInPixels(size: AppLayoutSize, total: number, fallback: number): number {
  if (typeof size === "number") return (size / 100) * total;
  const m = /^\s*(-?[\d.]+)\s*(px|%|rem|em|vw)?\s*$/.exec(size);
  if (!m) return fallback;
  const n = parseFloat(m[1]!);
  const unit = m[2] ?? "px";
  return unit === "%" || unit === "vw" ? (n / 100) * total : unit === "px" ? n : n * 16;
}

/** Sets the panel size from a width in px (clamped to min / max) and persists it. `total` = layout width. */
export function setPanelPixels(state: PanelSizeState, px: number, total: number): void {
  if (!(total > 0)) return;
  const lo = sizeInPixels(state.min, total, 0);
  const hi = sizeInPixels(state.max, total, total);
  const clamped = Math.min(hi, Math.max(lo, px));
  const next: AppLayoutSize = state.pixels ? `${Math.round(clamped)}px` : Math.round((clamped / total) * 1000) / 10;
  state.size.set(next);
  savePanelSize(state);
}

/** Percent of `total` the panel takes now (aria-valuenow); `undefined` when unknown (server, string size). */
export function panelPercent(state: PanelSizeState, total?: number): number | undefined {
  const size = state.size();
  if (typeof size === "number") return size;
  if (!total) return undefined;
  return Math.round((sizeInPixels(size, total, 0) / total) * 100);
}

/** Bounds as percents for aria-valuemin / -valuemax (numbers only; strings: `undefined`). */
export const percentBound = (size: AppLayoutSize): number | undefined => (typeof size === "number" ? size : undefined);

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Persists the size under `storageKey` (no-op without one or without storage). */
export function savePanelSize(state: PanelSizeState): void {
  if (!state.storageKey) return;
  try {
    storage()?.setItem(state.storageKey, JSON.stringify(untrack(state.size)));
  } catch {
    // private mode / quota: keep the in-memory size
  }
}

/** Restores a persisted size (browser; `resizableAutoSaveId`). */
export function restorePanelSize(state: PanelSizeState): void {
  if (!state.storageKey) return;
  try {
    const raw = storage()?.getItem(state.storageKey);
    if (raw == null) return;
    const value = JSON.parse(raw) as unknown;
    if (typeof value === "number" || typeof value === "string") state.size.set(value);
  } catch {
    // unreadable entry: keep the default
  }
}

/**
 * Window-splitter keys on a resize handle: Arrow Left / Right (Shift: 10 steps) change the width by 1 % of `total`
 * (mirrored for a panel on the right: `edge` = which edge of the panel the handle sits on), Home / End = min / max,
 * Enter = back to the default size. Returns whether the key was handled.
 */
export function panelKeyDown(state: PanelSizeState, event: KeyboardEvent, current: number, total: number, edge: "start" | "end", rtl: boolean): boolean {
  const step = (event.shiftKey ? 10 : 1) * (total / 100);
  let grow = 0;
  if (event.key === "ArrowRight") grow = 1;
  else if (event.key === "ArrowLeft") grow = -1;
  if (grow) {
    // A handle on the panel's end edge grows it to the right (LTR); on its start edge (aside on the right) to the left.
    if (edge === "start") grow = -grow;
    if (rtl) grow = -grow;
    setPanelPixels(state, current + grow * step, total);
    return true;
  }
  if (event.key === "Home") {
    setPanelPixels(state, 0, total);
    return true;
  }
  if (event.key === "End") {
    setPanelPixels(state, total, total);
    return true;
  }
  if (event.key === "Enter") {
    state.size.set(state.defaultSize);
    savePanelSize(state);
    return true;
  }
  return false;
}
