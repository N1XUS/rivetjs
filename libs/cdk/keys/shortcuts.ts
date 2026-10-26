// Keyboard shortcuts (re-exported by `./index.ts`, the `@rivetjs/cdk/keys` entry).
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
