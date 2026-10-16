// Key managers (APG composite widget navigation) and typeahead. Pure functions over indices: the
// collection is whatever the caller has (DOM items, data rows); disabled items are skipped through
// `isDisabled`. RTL is the caller's `dir` (see ../bidi/index.ts).
import type { Direction } from "../bidi/index.ts";

export type Orientation = "vertical" | "horizontal" | "both";

export interface NavigationOptions {
  /** Arrow keys that move: vertical = Up/Down, horizontal = Left/Right, both = all four (default vertical). */
  orientation?: Orientation;
  /** Wrap from the last item to the first and back (default false). */
  wrap?: boolean;
  /** Home / End move to the first / last item (default true). */
  homeEnd?: boolean;
  /** PageUp / PageDown step (items); 0 = not handled (default 0). */
  pageSize?: number;
  /** Text direction for horizontal arrows (default ltr). */
  dir?: Direction;
  /** Skip items for which this returns true. */
  isDisabled?: (index: number) => boolean;
}

/** Keys `nextIndex` may handle for `options`, as a `data-rk` value (loader holds them while a chunk loads). */
export function navigationKeys(options: NavigationOptions = {}): string {
  const { orientation = "vertical", homeEnd = true, pageSize = 0 } = options;
  const keys: string[] = [];
  if (orientation !== "horizontal") keys.push("ArrowDown", "ArrowUp");
  if (orientation !== "vertical") keys.push("ArrowLeft", "ArrowRight");
  if (homeEnd) keys.push("Home", "End");
  if (pageSize) keys.push("PageUp", "PageDown");
  return keys.join(" ");
}

/**
 * Index the key moves to from `from` (-1: nothing focused yet) among `count` items, or `null` when
 * the key is not a navigation key for these options (let it through). Returns `from` when the key is
 * handled but nothing moves (at the edge without wrap).
 */
export function nextIndex(count: number, from: number, key: string, options: NavigationOptions = {}): number | null {
  const { orientation = "vertical", wrap = false, homeEnd = true, pageSize = 0, dir = "ltr", isDisabled } = options;
  const enabled = (i: number) => !isDisabled?.(i);
  const step = (start: number, delta: number, loop: boolean): number => {
    for (let i = start + delta, n = 0; n < count; i += delta, n++) {
      if (i < 0 || i >= count) {
        if (!loop) return from;
        i = i < 0 ? count - 1 : 0;
      }
      if (enabled(i)) return i;
    }
    return from;
  };
  const first = () => step(-1, 1, false);
  const last = () => step(count, -1, false);
  const vertical = orientation !== "horizontal",
    horizontal = orientation !== "vertical";
  const forward = vertical && key === "ArrowDown" ? 1 : horizontal && key === (dir === "rtl" ? "ArrowLeft" : "ArrowRight") ? 1 : 0;
  const backward = vertical && key === "ArrowUp" ? 1 : horizontal && key === (dir === "rtl" ? "ArrowRight" : "ArrowLeft") ? 1 : 0;
  if (count === 0) return forward || backward || (homeEnd && (key === "Home" || key === "End")) ? from : null;
  if (forward) return from < 0 ? first() : step(from, 1, wrap);
  if (backward) return from < 0 ? last() : step(from, -1, wrap);
  if (homeEnd && key === "Home") return first();
  if (homeEnd && key === "End") return last();
  if (pageSize && (key === "PageDown" || key === "PageUp")) {
    const delta = key === "PageDown" ? 1 : -1;
    let target = Math.min(count - 1, Math.max(0, (from < 0 ? 0 : from) + delta * pageSize));
    // Land on the nearest enabled item in the direction of travel, else back towards `from`.
    while (target >= 0 && target < count && !enabled(target)) target += delta;
    if (target < 0 || target >= count) return delta > 0 ? last() : first();
    return target;
  }
  return null;
}

// Typeahead: per-owner buffer + timestamp (transient, never serialized).
const buffers = new WeakMap<object, { text: string; at: number }>();
let collator: Intl.Collator | undefined;
const TIMEOUT = 750;

/**
 * Typeahead (APG): printable `key` extends the owner's buffer (reset after 750 ms); returns the index
 * of the next item after `from` whose text starts with the buffer (base sensitivity: case and accents
 * ignored, `Intl.Collator`), or -1. Repeating one character cycles through items starting with it.
 * `owner` is any object identifying the widget (its state object).
 */
export function typeahead(
  owner: object,
  texts: readonly string[],
  from: number,
  key: string,
  now = Date.now(),
  isDisabled?: (index: number) => boolean,
): number {
  if (key.length !== 1 || (key === " " && !buffers.get(owner)?.text)) return -1;
  const previous = buffers.get(owner);
  const text = (previous && now - previous.at < TIMEOUT ? previous.text : "") + key;
  buffers.set(owner, { text, at: now });
  collator ??= new Intl.Collator(undefined, { usage: "search", sensitivity: "base" });
  const cmp = collator;
  // Same character repeated: cycle through matches of that single character.
  const search = text.length > 1 && [...text].every((c) => c === text[0]) ? text[0]! : text;
  const starts = (value: string) => value.length >= search.length && cmp.compare(value.slice(0, search.length), search) === 0;
  const begin = search.length === 1 ? from + 1 : Math.max(from, 0);
  for (let n = 0; n < texts.length; n++) {
    const i = (begin + n) % texts.length;
    if (!isDisabled?.(i) && starts(texts[i]!.trim())) return i;
  }
  return -1;
}

/** Test hook: forget an owner's typeahead buffer. */
export function _resetTypeahead(owner: object): void {
  buffers.delete(owner);
}

// --- Keyboard shortcuts ----------------------------------------------------------------------------
// Ported from @react-aria/interactions createKeyboardShortcutHandler (react-spectrum), Apache-2.0, © Adobe.

/** A shortcut action: `undefined` / `true` = handled (preventDefault, stop); `false` = not handled. */
export type KeyboardShortcutAction = (
  e: KeyboardEvent & { continuePropagation?: () => void },
) => void | boolean | Partial<{ shouldContinuePropagation?: boolean; shouldPreventDefault?: boolean }>;

/** Shortcut strings (`"Mod+s"`, `"Control+Shift+a"`, `"Escape"`) → actions. */
export type KeyboardShortcutBindings = Record<string, KeyboardShortcutAction>;

export interface ParsedKeyboardShortcut {
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  /** Platform primary: Cmd on Mac, Control elsewhere. */
  mod: boolean;
  key: string;
}

const MODIFIER_NAMES = new Set(["shift", "alt", "control", "meta", "mod"]);
const CANONICAL_MODIFIER_ORDER = ["Alt", "Control", "Meta", "Shift"] as const;
const KEY_ALIASES: Record<string, string> = {
  space: " ",
  esc: "escape",
  del: "delete",
  ins: "insert",
  left: "arrowleft",
  right: "arrowright",
  up: "arrowup",
  down: "arrowdown",
  pageup: "pageup",
  pagedown: "pagedown",
};
const appleShortcuts = (): boolean =>
  typeof navigator !== "undefined" &&
  /^Mac/i.test((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform);

/** Canonical modifier tokens of a binding (`Mod` → Meta on Mac, Control elsewhere). */
export function modifierSetFromParsed(parsed: ParsedKeyboardShortcut): Set<string> {
  const set = new Set<string>();
  if (parsed.alt) set.add("Alt");
  if (parsed.shift) set.add("Shift");
  if (parsed.ctrl) set.add("Control");
  if (parsed.meta) set.add("Meta");
  if (parsed.mod) set.add(appleShortcuts() ? "Meta" : "Control");
  return set;
}

/** Modifier tokens of a keydown event. */
export function modifierSetFromEvent(e: KeyboardEvent): Set<string> {
  const set = new Set<string>();
  if (e.altKey) set.add("Alt");
  if (e.ctrlKey) set.add("Control");
  if (e.metaKey) set.add("Meta");
  if (e.shiftKey) set.add("Shift");
  return set;
}

const sortedModifierTokens = (set: Set<string>): string[] => CANONICAL_MODIFIER_ORDER.filter((name) => set.has(name));

/** Parse `"Mod+Shift+z"`, `"Ctrl+Alt+Enter"`, `"Escape"` (modifiers case-insensitive, any order). */
export function parseKeyboardShortcut(spec: string): ParsedKeyboardShortcut {
  const parts = spec.split("+").reduce<ParsedKeyboardShortcut>(
    (prev, part) => {
      const lower = part.toLowerCase();
      if (MODIFIER_NAMES.has(lower)) {
        if (lower === "shift") prev.shift = true;
        else if (lower === "alt") prev.alt = true;
        else if (lower === "control") prev.ctrl = true;
        else if (lower === "meta") prev.meta = true;
        else if (lower === "mod") prev.mod = true;
      } else prev.key = part;
      return prev;
    },
    { shift: false, alt: false, ctrl: false, meta: false, mod: false, key: "" },
  );
  if (parts.key === "")
    throw new Error(
      `Invalid keyboard shortcut: "${spec}". Must include exactly one non-modifier key (e.g. "a", "Enter", "ArrowDown"). Combine any of Shift, Alt, Ctrl, Meta, and Mod.`,
    );
  return parts;
}

const canonicalKeyFromSpecKey = (specKey: string): string => {
  const k = specKey.toLowerCase();
  return KEY_ALIASES[k] ?? k;
};

/** Canonical form of a binding: modifiers sorted (Alt, Control, Meta, Shift), then the key. */
export function canonicalKeyboardShortcut(parsed: ParsedKeyboardShortcut): string {
  const mods = sortedModifierTokens(modifierSetFromParsed(parsed));
  const key = canonicalKeyFromSpecKey(parsed.key);
  return mods.length > 0 ? `${mods.join("+")}+${key}` : key;
}

/** Canonical form of a keydown event. */
export function keyboardEventToCanonicalShortcut(e: KeyboardEvent): string {
  const mods = sortedModifierTokens(modifierSetFromEvent(e));
  return (mods.length > 0 ? `${mods.join("+")}+` : "") + e.key.toLowerCase();
}

/**
 * A keydown handler running the action of the exact modifier + key match (later duplicate bindings
 * win). Handled: preventDefault + stop; unhandled keys `continuePropagation()` when available.
 */
export function createKeyboardShortcutHandler(bindings: KeyboardShortcutBindings): (e: KeyboardEvent & { continuePropagation?: () => void }) => void {
  const map = new Map<string, KeyboardShortcutAction>();
  for (const [spec, action] of Object.entries(bindings)) map.set(canonicalKeyboardShortcut(parseKeyboardShortcut(spec)), action);
  return (e) => {
    const action = map.get(keyboardEventToCanonicalShortcut(e));
    let result = action?.(e);
    if (result === undefined && action !== undefined) result = { shouldContinuePropagation: false, shouldPreventDefault: true };
    else if (typeof result === "boolean") result = { shouldContinuePropagation: !result, shouldPreventDefault: result };
    if (result?.shouldPreventDefault) e.preventDefault();
    if (!action || result?.shouldContinuePropagation) e.continuePropagation?.();
  };
}
