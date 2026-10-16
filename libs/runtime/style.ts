// `class:` / `style:` directives, class objects / arrays and style objects (G10): one normalization
// and one CSS value rule for the server encoder, DOM bindings and resumed symbols. Compiled modules
// and symbol chunks import the helpers they use from `@rivetjs/runtime/style` (pay-per-use: the
// server, DOM and resume entries carry none of it); the compiler applies the same rules to
// literals (libs/compiler/rust/src/styling.rs).
import { effect } from "@rivetjs/reactivity";
import { DEV } from "#dev";
import type { AttributeRecord } from "./template.ts";

/** A class value: a name list, a skipped falsy value, an array of class values, or `{ name: condition }`. */
export type ClassValue = string | number | bigint | boolean | null | undefined | readonly ClassValue[] | { readonly [name: string]: unknown };
/** A style object: CSS property (kebab-case, camelCase or `--custom`) → value; null / undefined / false / "" skip it. */
export type StyleObject = { readonly [property: string]: string | number | null | undefined | false };

function names(out: string[], value: unknown): void {
  if (!value || value === true) return;
  if (Array.isArray(value)) for (const item of value) names(out, item);
  else if (typeof value === "object") {
    for (const key in value) if ((value as Record<string, unknown>)[key]) out.push(key);
  } else out.push(String(value));
}

/** Space-joined class names of a class value (`cx` semantics: falsy parts skipped, no dedupe). */
export function classNames(value: unknown): string {
  const out: string[] = [];
  names(out, value);
  return out.join(" ");
}

/**
 * Compiler ABI: the `class` attribute of `base` (a class value) with `toggles` applied — a truthy
 * toggle adds its name once, a falsy one removes every occurrence (like `classList.toggle`).
 * Null when empty (no attribute).
 */
export function _class(base: unknown, toggles?: Record<string, unknown>): string | null {
  let text = classNames(base);
  if (toggles) {
    // One array per call (per row with `class:` directives): only the ends of the split can be empty; a falsy toggle
    // compacts in place instead of a `filter` copy per toggle.
    const tokens = text.split(SPACE);
    if (tokens[0] === "") tokens.shift();
    if (tokens.length && tokens[tokens.length - 1] === "") tokens.pop();
    for (const name in toggles)
      if (toggles[name]) {
        if (!tokens.includes(name)) tokens.push(name);
      } else {
        let n = 0;
        for (let i = 0; i < tokens.length; i++) if (tokens[i] !== name) tokens[n++] = tokens[i]!;
        if (n !== tokens.length) tokens.length = n;
      }
    text = tokens.join(" ");
  }
  return text || null;
}
const SPACE = /[\t\n\f\r ]+/;

const PROPERTY = /^(?:--[\w-]+|-?[a-z][a-z\d-]*)$/;
/** CSS property of a style key: custom properties as written, camelCase → kebab-case; anything else throws. */
export function _styleProp(key: string): string {
  let name = styleNames.get(key);
  if (name === undefined) {
    name = key.startsWith("--") ? key : key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    if (!PROPERTY.test(name)) throw new TypeError("Unsafe style property: " + key);
    // Style keys repeat per element (the regex pair was ~5% of a styled row's SSR): cached, bounded.
    if (styleNames.size >= 1024) styleNames.clear();
    styleNames.set(key, name);
  }
  return name;
}
const styleNames = new Map<string, string>();

// Ignoring case and whitespace: URL-loading or script functions, `javascript:`, and the characters that
// could end the declaration or open an escape / comment.
const UNSAFE = /[\\;{}]|\/\*|(?:url|src|image-set|expression)\(|javascript:/;
// The same rule on an ASCII value as written (STYLE-FAST): any run of characters <= U+0020 (the whitespace / controls
// the rule removes) may sit between two characters of a token, letters match either case — no lowercase / replace
// copies per value (they were ~14% of a justified masonry relayout's script). Non-ASCII values (Unicode whitespace,
// case mapping) take the rule itself. Fuzzed against it: tests/style.test.ts.
const W = String.raw`[\x00-\x20]*`;
const spaced = (word: string) => word.split("").join(W);
const UNSAFE_ASCII = new RegExp(
  String.raw`[\\;{}]|\/${W}\*|(?:${["url", "src", "image-set", "expression"].map(spaced).join("|")})${W}\(|${spaced("javascript")}${W}:`,
  "i",
);
const NON_ASCII = /[^\x00-\x7f]/;
/** Whether a CSS value is refused (url(), src(), image-set(), expression(), javascript:, `\ ; { } /*`). */
export const unsafeStyle = (value: string): boolean =>
  NON_ASCII.test(value) ? UNSAFE.test(value.toLowerCase().replace(/[\s\u0000-\u001f]+/g, "")) : UNSAFE_ASCII.test(value);

// Properties whose plain numbers stay unitless (React's `isUnitlessNumber`, kebab-case; vendor prefixes
// are stripped before the lookup). Twin: libs/compiler/rust/src/styling.rs `UNITLESS`.
const UNITLESS =
  /^(?:-(?:webkit|moz|ms|o)-)?(?:animation-iteration-count|aspect-ratio|border-image-(?:outset|slice|width)|box-(?:flex|flex-group|ordinal-group)|column-count|columns|flex|flex-(?:grow|positive|shrink|negative|order)|grid-(?:area|row|row-end|row-span|row-start|column|column-end|column-span|column-start)|font-weight|line-clamp|line-height|opacity|order|orphans|scale|tab-size|widows|z-index|zoom|fill-opacity|flood-opacity|stop-opacity|stroke-(?:dasharray|dashoffset|miterlimit|opacity|width))$/;
/**
 * A style value as written to CSS, or null to leave the property unset: null / undefined / booleans /
 * "" skip; a number gets `px` unless it is 0, the property is unitless (`UNITLESS`) or custom (`--x`),
 * like React (C14); an unsafe string is dropped (dev: warning).
 */
export function _styleValue(property: string, value: unknown): string | null {
  if (value == null || typeof value === "boolean" || value === "") return null;
  if (typeof value === "number") return value !== 0 && !property.startsWith("--") && !UNITLESS.test(property) ? value + "px" : String(value);
  const text = String(value);
  if (unsafeStyle(text)) {
    if (DEV) DEV.unsafeStyle(property, text);
    return null;
  }
  return text;
}

/**
 * Compiler ABI (server): the `style` attribute value of style objects, later properties win per
 * object and in order; null when no property is set. Non-object parts (a style string) are refused.
 */
export function _style(...parts: unknown[]): string | null {
  const seen = new Map<string, string>();
  for (const part of parts) {
    if (part == null || part === false) continue;
    if (typeof part !== "object") throw new TypeError("Unsupported style value: use a style object");
    for (const key in part) {
      const name = _styleProp(key),
        value = _styleValue(name, (part as Record<string, unknown>)[key]);
      seen.delete(name);
      if (value !== null) seen.set(name, value);
    }
  }
  let out = "";
  for (const [name, value] of seen) out += (out ? ";" : "") + name + ":" + value;
  return out || null;
}

/**
 * Compiler ABI: a spread element's merged attribute object with its `class:` toggles applied to the
 * spread `class` (or `className`, a function value read as an accessor).
 */
export function _spreadClass(object: object | null | undefined, toggles: Record<string, unknown>): Record<string, unknown> {
  const out = { ...object } as Record<string, unknown>;
  let base = "class" in out ? out.class : out.className;
  if (typeof base === "function") base = (base as () => unknown)();
  delete out.className;
  out.class = _class(base, toggles);
  return out;
}

/**
 * Compiler ABI (server): the `style` attribute (never accepted by `attribute`): `value` is the
 * declaration list built by `_style`, whose names and values are already checked.
 */
export function _styleAttr(_name: "style", value: string | null): AttributeRecord {
  return { [Symbol.for("rivet.attribute") as never]: true, name: "style", value, namespace: "html" } as unknown as AttributeRecord;
}

/** Compiler ABI (DOM): `class:name={on}` (and static-key class objects) toggle one class with `classList`. */
export function _bindClass(target: Element, name: string, read: () => unknown): void {
  effect(() => void target.classList.toggle(name, !!read()));
}

/**
 * Compiler ABI (DOM): `style:prop={value}` / static style object keys set one property through CSSOM
 * (`read` a function: tracked; else a constant), so a strict `style-src` CSP does not block them;
 * `property` null: `read` returns a style object whose keys are diffed per run. Unsafe values are
 * dropped like on the server.
 */
export function _bindStyle(target: Element, property: string | null, read: unknown): void {
  const style = (target as HTMLElement).style,
    set = (name: string, value: unknown) => {
      const text = _styleValue(name, value);
      if (text === null) style.removeProperty(name);
      else style.setProperty(name, text);
    };
  if (property !== null) {
    if (typeof read === "function") effect(() => set(property, (read as () => unknown)()));
    else set(property, read);
    return;
  }
  let last = new Set<string>();
  effect(() => void (last = _applyStyle(target, (read as () => unknown)(), last)));
}

interface FrozenPlan {
  text: string;
  /** Never mutated (callers only read the returned names). */
  names: ReadonlySet<string>;
}
const FROZEN = new WeakMap<object, FrozenPlan | null>();
/** The `cssText` of a frozen style object, or null when a value needs the per-property path (unset / `!` / unsafe). */
function frozenPlan(value: Record<string, unknown>): FrozenPlan | null {
  let text = "";
  const names = new Set<string>();
  for (const key in value) {
    const name = _styleProp(key),
      css = _styleValue(name, value[key]);
    // An unset value removes, a dropped (unsafe) one warns, `!important` is refused by setProperty but not by cssText.
    if (css === null || css.includes("!")) return null;
    text += name + ":" + css + ";";
    names.add(name);
  }
  return { text, names };
}

/**
 * One run of a style-object binding: the object's properties are set through CSSOM, properties of
 * `last` (the previous run's names) missing from it are removed; returns the names now set. Shared by
 * `_bindStyle` and the spread `style` key (DOM `_spread`, which diffs the
 * object per spread run). A non-object value (a style string) throws like `_style`.
 */
export function _applyStyle(target: Element, value: unknown, last: ReadonlySet<string>): Set<string> {
  const style = (target as HTMLElement).style;
  if (value != null && value !== false && typeof value !== "object") throw new TypeError("Unsupported style value: use a style object");
  // A frozen style object (a shared constant: cdk `visuallyHidden`) on an element without inline style: its
  // declarations are validated once (per object) and written as one CSSOM `cssText` (CSP-safe like setProperty).
  if (last.size === 0 && value && Object.isFrozen(value) && style && style.length === 0) {
    let plan = FROZEN.get(value as object);
    if (plan === undefined) FROZEN.set(value as object, (plan = frozenPlan(value as Record<string, unknown>)));
    if (plan) {
      style.cssText = plan.text;
      return plan.names as Set<string>;
    }
  }
  const next = new Set<string>();
  for (const key in value as object) {
    const name = _styleProp(key),
      text = _styleValue(name, (value as Record<string, unknown>)[key]);
    next.add(name);
    if (text === null) style.removeProperty(name);
    else style.setProperty(name, text);
  }
  for (const name of last) if (!next.has(name)) style.removeProperty(name);
  return next;
}
