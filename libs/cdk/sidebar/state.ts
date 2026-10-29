// Ported from shadcn/ui Sidebar (apps/v4/registry/new-york-v4/ui/sidebar.tsx `SidebarProvider` state +
// apps/v4/registry/new-york-v4/hooks/use-mobile.ts; React Aria base apps/v4/registry/bases/aria/ui/sidebar.tsx),
// shadcn/ui 4.21.4, MIT, © 2023 shadcn.
// Rivet:
// - React state → serializable state (signals + plain data, `controllable` for `open`): the free functions
//   (`setSidebarOpen`, `toggleSidebar`, …) take the state first, so handlers / shortcuts resume.
// - `open` accepts a plain value, a two-way Signal, or an accessor (cdk `controllable`); `onOpenChange` fires on
//   every change, the cookie is written on every `setSidebarOpen` (upstream `setOpen`).
// - `useIsMobile` → `isMobile` signal, `false` on the server; nothing runs at load (resumed pages stay cold):
//   it is re-read on every toggle and by the media listener once the runtime runs (`MOBILE_BREAKPOINT` 768, as
//   upstream). The mobile / desktop split before that is CSS (desktop root hidden below 768 px).
// - `sidebarCookieOpen` (Rivet): reads the persisted `sidebar_state` cookie for SSR (`defaultOpen`), the hook
//   point upstream documents for server components (`cookies().get("sidebar_state")`).
// - Rivet extensions (feature set scoped from public docs of commercial UI kits; independent implementation):
//   `toggleShortcut` (a `mod+b`-style string, `false` / `null` off; parsed at event time), `reduceMotion`,
//   `closeMobileOnAction` — plain data in the state.
import { createContext, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { controllable, controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";

export const SIDEBAR_COOKIE_NAME = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const SIDEBAR_WIDTH = "16rem";
export const SIDEBAR_WIDTH_MOBILE = "18rem";
export const SIDEBAR_WIDTH_ICON = "3rem";
export const SIDEBAR_KEYBOARD_SHORTCUT = "b";
/** Default `toggleShortcut`: Cmd+B / Ctrl+B (upstream's shortcut; `mod` = Cmd or Ctrl). */
export const SIDEBAR_TOGGLE_SHORTCUT = "mod+b";
/** `use-mobile.ts`: viewports narrower than this are mobile (the sidebar becomes a sheet). */
export const MOBILE_BREAKPOINT = 768;
/** The media query behind `isMobile` (`(max-width: 767px)`). */
export const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

export interface SidebarStateProps {
  /** Default open state of the sidebar (uncontrolled). @default true */
  defaultOpen?: boolean;
  /** Open state of the sidebar (controlled): a plain value, a two-way Signal, or an accessor. */
  open?: boolean | Signal<boolean> | (() => boolean);
  /** Called when the open state changes (resumed pages: an inline arrow or a local function). */
  onOpenChange?: (open: boolean) => void;
  /**
   * Rivet: the toggle shortcut — modifiers `mod` (Cmd or Ctrl), `cmd` / `meta`, `ctrl`, `shift`, `alt` and one key,
   * joined with `+` (`"mod+b"`, `"mod+shift+s"`, `"alt+\\"`); `false` / `null` disables it. @default "mod+b"
   */
  toggleShortcut?: string | false | null;
  /** Rivet: turns off the sidebar's animations (sheet swipe, sub menus, pages), on top of `prefers-reduced-motion`. @default false */
  reduceMotion?: boolean;
  /**
   * Rivet: close the mobile sheet when a menu button / sub button is pressed (groups, menus and items override it).
   * Off by default: upstream keeps the sheet open on a link press (`@rivetjs/ui` turns it on). @default false
   */
  closeMobileOnAction?: boolean;
  /** Rivet: default `side` of the `Sidebar`s inside (their own prop wins). @default "left" */
  side?: "left" | "right";
  /** Rivet: default `variant` of the `Sidebar`s inside (their own prop wins). @default "sidebar" */
  variant?: "sidebar" | "floating" | "inset";
  /** Rivet: default `collapsible` of the `Sidebar`s inside (their own prop wins; shadcn default kept). @default "offcanvas" */
  collapsible?: "offcanvas" | "icon" | "none";
}

/** Sidebar state (serializable). Read the signals in bindings; change them through the functions below. */
export interface SidebarState {
  /** The shown open state (desktop). */
  readonly open: Signal<boolean>;
  /** @internal controlled-state record behind `open`. */
  readonly control: ControlledState<boolean>;
  /** Whether the mobile sheet is open. */
  readonly openMobile: Signal<boolean>;
  /** Whether the viewport is mobile (`< MOBILE_BREAKPOINT`); `false` on the server and before the first client check. */
  readonly isMobile: Signal<boolean>;
  /** The toggle shortcut (`toggleShortcut`), `null` when disabled. */
  readonly shortcut: string | null;
  /** `reduceMotion`. */
  readonly reduceMotion: boolean;
  /** `closeMobileOnAction` of the provider. */
  readonly closeMobileOnAction: boolean;
  /** Provider defaults for `Sidebar` (`undefined`: the Sidebar default). */
  readonly side: "left" | "right" | undefined;
  readonly variant: "sidebar" | "floating" | "inset" | undefined;
  readonly collapsible: "offcanvas" | "icon" | "none" | undefined;
}

/** Creates the sidebar state. */
export function createSidebarState(props: SidebarStateProps = {}): SidebarState {
  const control = controllable<boolean>(props.open, props.defaultOpen ?? true, props.onOpenChange);
  const shortcut = props.toggleShortcut === undefined ? SIDEBAR_TOGGLE_SHORTCUT : props.toggleShortcut || null;
  return {
    open: control.value,
    control,
    openMobile: signal(false),
    isMobile: signal(false),
    shortcut,
    reduceMotion: !!props.reduceMotion,
    closeMobileOnAction: props.closeMobileOnAction ?? false,
    side: props.side,
    variant: props.variant,
    collapsible: props.collapsible,
  };
}

/** `"expanded"` / `"collapsed"` (upstream `state`; `data-state`). */
export const sidebarStateName = (state: SidebarState): "expanded" | "collapsed" => (state.open() ? "expanded" : "collapsed");

/** Writes the persisted state cookie (upstream: in `setOpen`). */
export function writeSidebarCookie(open: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
}

/** Upstream `setOpen`: a value or an updater; calls `onOpenChange` (controlled) or sets the state, then writes the cookie. */
export function setSidebarOpen(state: SidebarState, value: boolean | ((open: boolean) => boolean)): void {
  untrack(() => {
    const openState = typeof value === "function" ? value(controlledValue(state.control)) : value;
    setControlledValue(state.control, openState);
    writeSidebarCookie(openState);
  });
}

/** Upstream `setOpenMobile`. */
export function setSidebarOpenMobile(state: SidebarState, value: boolean | ((open: boolean) => boolean)): void {
  untrack(() => state.openMobile.set(typeof value === "function" ? value(state.openMobile()) : value));
}

/** Upstream `toggleSidebar`: the mobile sheet on mobile, else the desktop sidebar (re-reads the viewport first). */
export function toggleSidebar(state: SidebarState): void {
  updateSidebarIsMobile(state);
  if (untrack(state.isMobile)) setSidebarOpenMobile(state, (open) => !open);
  else setSidebarOpen(state, (open) => !open);
}

// Shortcut events already handled (the provider's delegated `keydown` + the window listener see the same event).
const handledShortcuts = new WeakSet<Event>();

/** A parsed toggle shortcut (`parseSidebarShortcut`). */
export interface SidebarShortcut {
  /** The key, lower case (`"b"`, `"\\"`, `"enter"`). */
  key: string;
  /** `mod`: Cmd or Ctrl (either one, as upstream's Cmd+B / Ctrl+B). */
  mod: boolean;
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

const SHORTCUT_MODIFIERS = new Set(["mod", "cmd", "command", "meta", "ctrl", "control", "shift", "alt", "option"]);

/**
 * Rivet: parses a shortcut string (`"mod+b"`, `"mod+shift+s"`, `"ctrl+alt+k"`; case-insensitive, `+` separated, the
 * last part is the key; a lone `+` key is written `"mod++"`). `null` for an empty / modifier-only string.
 */
export function parseSidebarShortcut(shortcut: string): SidebarShortcut | null {
  const parts = shortcut.toLowerCase().trim().split("+");
  // "mod++" → ["mod", "", ""]: the key is "+".
  if (parts.length > 1 && parts[parts.length - 1] === "" && parts[parts.length - 2] === "") parts.splice(-2, 2, "+");
  const key = parts.pop()?.trim() ?? "";
  if (!key || SHORTCUT_MODIFIERS.has(key)) return null;
  const spec: SidebarShortcut = { key, mod: false, meta: false, ctrl: false, shift: false, alt: false };
  for (const raw of parts) {
    const part = raw.trim();
    if (part === "mod") spec.mod = true;
    else if (part === "cmd" || part === "command" || part === "meta") spec.meta = true;
    else if (part === "ctrl" || part === "control") spec.ctrl = true;
    else if (part === "shift") spec.shift = true;
    else if (part === "alt" || part === "option") spec.alt = true;
    else return null;
  }
  return spec;
}

/**
 * Rivet: whether `event` is the shortcut. Shift / Alt must match exactly; `mod` takes Cmd or Ctrl, explicit `cmd` /
 * `ctrl` require that key (and no other Cmd / Ctrl than the ones listed). The key compares case-insensitively with
 * `event.key`, or with the physical `event.code` for letters / digits (Alt and Shift change `key` on some layouts).
 */
export function matchesSidebarShortcut(event: KeyboardEvent, spec: SidebarShortcut): boolean {
  if (event.shiftKey !== spec.shift || event.altKey !== spec.alt) return false;
  if (spec.mod) {
    if (!event.metaKey && !event.ctrlKey) return false;
    if (spec.meta && !event.metaKey) return false;
    if (spec.ctrl && !event.ctrlKey) return false;
  } else if (event.metaKey !== spec.meta || event.ctrlKey !== spec.ctrl) return false;
  const key = (event.key ?? "").toLowerCase();
  if (key === spec.key) return true;
  const code = event.code ?? "";
  return spec.key.length === 1 && (code === "Key" + spec.key.toUpperCase() || code === "Digit" + spec.key);
}

/**
 * Upstream window `keydown` listener: the toggle shortcut (default Cmd+B / Ctrl+B) toggles the sidebar. Called by the
 * provider's delegated `keydown` (works on a cold resumed page) and by its window listener (attached once the runtime
 * runs); an event is handled once. `toggleShortcut={false}` turns it off.
 */
export function sidebarShortcutKeyDown(event: KeyboardEvent, state: SidebarState): void {
  if (handledShortcuts.has(event) || !state.shortcut) return;
  const spec = parseSidebarShortcut(state.shortcut);
  if (spec && matchesSidebarShortcut(event, spec)) {
    handledShortcuts.add(event);
    event.preventDefault();
    toggleSidebar(state);
  }
}

/** Rivet: whether sidebar animations should be skipped (`reduceMotion`, or the user's `prefers-reduced-motion`). */
export function sidebarReducedMotion(reduceMotion: boolean | undefined): boolean {
  if (reduceMotion) return true;
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Rivet `closeMobileOnAction`: closes the mobile sheet after a menu action when it is open. */
export function closeSidebarMobileOnAction(state: SidebarState, close: boolean | undefined): void {
  if ((close ?? state.closeMobileOnAction) && untrack(state.openMobile)) setSidebarOpenMobile(state, false);
}

/** Whether the viewport is mobile right now (`< MOBILE_BREAKPOINT`); `false` on the server. */
export function sidebarViewportIsMobile(): boolean {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
}

/** `use-mobile.ts` `onChange`: re-reads the viewport width (no write when unchanged). */
export function updateSidebarIsMobile(state: SidebarState): void {
  if (typeof window === "undefined") return;
  const mobile = sidebarViewportIsMobile();
  if (untrack(state.isMobile) !== mobile) state.isMobile.set(mobile);
}

/**
 * Rivet: the persisted open state for SSR. Pass a cookie header (`request.headers.get("cookie")`), a cookie map
 * (`RequestEvent.cookies` of `@rivetjs/router`) or the cookie value; `undefined` when absent / unparsable.
 * Use: `defaultOpen={sidebarCookieOpen(cookies) ?? true}`.
 */
export function sidebarCookieOpen(source: string | { get(name: string): string | undefined } | null | undefined): boolean | undefined {
  if (source == null) return undefined;
  let value: string | undefined;
  if (typeof source === "string") {
    if (source === "true" || source === "false") value = source;
    else
      for (const part of source.split(";")) {
        const at = part.indexOf("=");
        if (at > 0 && part.slice(0, at).trim() === SIDEBAR_COOKIE_NAME) {
          value = part.slice(at + 1).trim();
          break;
        }
      }
  } else value = source.get(SIDEBAR_COOKIE_NAME);
  return value === "true" ? true : value === "false" ? false : undefined;
}

// Contexts (here, not in index.tsx: ./pages.tsx reads them without index.tsx importing the pages code — a page without
// SidebarPages fetches no pages chunk, and no extra chunk either).
/** The sidebar state of the nearest SidebarProvider (serializable). */
export const SidebarContext = createContext<SidebarState | null>(null);

/** Rivet: options a SidebarGroup / SidebarMenu passes down (`closeMobileOnAction`, `reduceMotion`; plain data). */
export interface SidebarMenuOptions {
  closeMobileOnAction?: boolean;
  reduceMotion?: boolean;
}

/** Rivet: the nearest group / menu options. */
export const SidebarMenuOptionsContext = createContext<SidebarMenuOptions | null>(null);
