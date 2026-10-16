// Text direction.
// Ported from angular/components src/cdk/bidi (MIT, © Google LLC): `Directionality`, the `[dir]`
// directive (`Dir`), `_resolveDirectionality`. Markup uses the `dir` attribute and CSS logical
// properties (RTL needs no JS); handlers ask `direction(element)` when a key maps to a visual side.
//
// Rivet shape: `Directionality` is plain state (`valueSignal` + raw value accessors) so it resumes;
// Angular's DI lookup ("closest `[dir]` directive, else the document") is `injectDirectionality()`
// reading `DirectionalityContext` (provided by `<Dir>` from `@rivetjs/cdk/bidi-dir`) and falling back
// to the document. The `change` EventEmitter is the signal: read `valueSignal()` in a binding /
// effect, or pass `onDirChange` to `<Dir>`.
import { computed, createContext, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { resumableContext } from "@rivetjs/runtime/resume-format";

export type { Direction } from "../collections/types.ts";
import type { Direction } from "../collections/types.ts";

/** Regex that matches locales with an RTL script. Taken from `goog.i18n.bidi.isRtlLanguage`. */
const RTL_LOCALE_PATTERN = /^(ar|ckb|dv|he|iw|fa|nqo|ps|sd|ug|ur|yi|.*[-_](Adlm|Arab|Hebr|Nkoo|Rohg|Thaa))(?!.*[-_](Latn|Cyrl)($|-|_))($|-|_)/i;

/** Whether `locale` is written right-to-left (by script / language subtag). */
export const isRtlLocale = (locale: string): boolean => RTL_LOCALE_PATTERN.test(locale);

/**
 * Resolves a raw `dir` value to a direction: case-insensitive `"rtl"` → rtl; `"auto"` → from
 * `navigator.language` (browser) ; anything else → ltr.
 */
export function _resolveDirectionality(rawValue: string | null | undefined): Direction {
  const value = rawValue?.toLowerCase() || "";
  if (value === "auto" && typeof navigator !== "undefined" && navigator?.language) return isRtlLocale(navigator.language) ? "rtl" : "ltr";
  return value === "rtl" ? "rtl" : "ltr";
}

/** Angular `Directionality`: the direction of the application or of a `<Dir>` subtree. */
export interface Directionality {
  /** The current direction (reactive). */
  readonly valueSignal: () => Direction;
  /** The `dir` value as given by the consumer (`"auto"`, `"RTL"`, …); rendered as the `dir` attribute. */
  readonly rawDir: () => string;
}

/** A writable `Directionality` (`createDir`, `documentDirectionality`): `setDir` changes it. */
export interface DirState extends Directionality {
  readonly valueSignal: Signal<Direction>;
  readonly rawDir: Signal<string>;
}

/** The current 'ltr' / 'rtl' value of a directionality (Angular `dir.value`). Reads the signal. */
export const directionValue = (dir: Directionality): Direction => dir.valueSignal();

/** Minimal document shape read by `documentDirectionality` (tests pass fakes, like Angular's `DIR_DOCUMENT`). */
export interface DirDocument {
  body?: { dir?: string } | null;
  documentElement?: { dir?: string } | null;
}

/**
 * The root `Directionality`: `<body dir>`, else `<html dir>`, else ltr (Angular's root service).
 * Server (no document): ltr.
 */
export function documentDirectionality(doc: DirDocument | null | undefined = typeof document === "undefined" ? undefined : document): DirState {
  let raw = "ltr";
  if (doc) raw = (doc.body ? doc.body.dir : null) || (doc.documentElement ? doc.documentElement.dir : null) || "ltr";
  return { valueSignal: signal(_resolveDirectionality(raw)), rawDir: signal(raw) };
}

/**
 * State of a `[dir]` element (Angular `Dir` directive): `rawDir` keeps the consumer value (rendered
 * as-is, so `dir="auto"` stays `auto`), `valueSignal` is the normalized direction.
 */
export function createDir(dir: Direction | "auto" | string = ""): DirState {
  return { valueSignal: signal(_resolveDirectionality(dir)), rawDir: signal(dir) };
}

/**
 * Set the `dir` input of a `Dir` state (Angular `dir.dir = value`). Returns true when the
 * normalized direction changed (Angular emits `dirChange` then, once initialized).
 */
export function setDir(state: DirState, value: Direction | "auto" | string): boolean {
  const previous = untrack(state.valueSignal);
  const next = _resolveDirectionality(value);
  state.rawDir.set(value);
  state.valueSignal.set(next);
  return previous !== next;
}

/** Context through which `<Dir>` provides itself as the `Directionality` of its subtree. */
export const DirectionalityContext = resumableContext(createContext<Directionality | null>(null, { id: "rv-directionality" }));

/** Angular `inject(Directionality)`: the closest `<Dir>`, else the document's direction. */
export function injectDirectionality(): Directionality {
  return useContext(DirectionalityContext) ?? documentDirectionality();
}

/** Reactive direction accessor for components: closest `<Dir>` value, else the document's. */
export function useDirection(): () => Direction {
  const dir = injectDirectionality();
  return computed(() => dir.valueSignal());
}

/** Direction at `element`: nearest `dir` attribute, else computed `direction`, else `<html dir>`. Server: "ltr". */
export function direction(element?: Element | null): Direction {
  if (typeof document === "undefined") return "ltr";
  const owner = element?.closest("[dir]")?.getAttribute("dir")?.toLowerCase();
  if (owner === "rtl" || owner === "ltr") return owner;
  if (element && typeof getComputedStyle === "function") return getComputedStyle(element).direction === "rtl" ? "rtl" : "ltr";
  return document.documentElement.dir.toLowerCase() === "rtl" ? "rtl" : "ltr";
}

/** Swap ArrowLeft / ArrowRight in right-to-left text, so handlers can reason in "start" / "end". */
export function logicalKey(key: string, dir: Direction): string {
  if (dir !== "rtl") return key;
  return key === "ArrowLeft" ? "ArrowRight" : key === "ArrowRight" ? "ArrowLeft" : key;
}
