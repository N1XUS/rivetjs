// Browser glue over `motion/mini` (WAAPI): animate an element from its current motion state to a target.
//
// - Per-element motion state (last committed / targeted values per key) so a partial target (`x` only) composes the
//   other axes of `translate`; callers seed it from the server-rendered state (`from`) on first use.
// - Interrupts: a running animation of the same CSS property is stopped first (mini commits its current value to the
//   inline style), and the new one starts from that value — no jump.
// - One mini call per timing group (per-value transitions); springs only as Motion's `spring` *value* (D4b): the string
//   `"spring"` is a dev error naming the import (entrances: an error too, css.ts).
// - Reduced motion (`MotionConfig reducedMotion`, Motion's semantics): transform / layout values are set at once and
//   the rest (opacity, colors) still animates — under `prefers-reduced-motion: reduce` (`"user"`) or always (`"always"`).
import { animate } from "motion/mini";
import { DEV } from "#dev";
import type { ReducedPolicy } from "./css.ts";
// The message only (css.ts is not on the engine's graph): kept in sync with css.ts `SPRING`.
const SPRING = `type: "spring" needs Motion's spring value: import { spring } from "@rivetjs/motion" and pass { type: spring }`;
import {
  REDUCED_DROPS,
  cssKeyframes,
  cssProperty,
  finalState,
  hybridReason,
  toStyle,
  transitionOf,
  type MotionState,
  type Primitive,
  type Target,
  type Transition,
} from "./values.ts";

export type { ReducedPolicy };

interface Running {
  stop(): void;
  then(resolve: () => void, reject?: (e: unknown) => void): unknown;
}
interface ElementState {
  values: MotionState;
  /** Running animation per CSS property. */
  running: Map<string, Running>;
}
const elements = new WeakMap<Element, ElementState>();

export interface AnimateResult {
  /** Resolves when every started animation finished (or was stopped / replaced). */
  finished: Promise<void>;
  /** Stop now: values stay where they are (committed inline). */
  stop(): void;
}
export interface AnimateOptions {
  /** Motion state to start from when the element has none yet (default: its current inline / computed style). */
  from?: MotionState;
  reduced?: ReducedPolicy;
  onStart?(): void;
  onComplete?(): void;
}

/** Whether `policy` disables motion now (`prefers-reduced-motion` read at each animation start: live, no listener). */
export function reducedActive(policy: ReducedPolicy = "user"): boolean {
  if (policy === "never") return false;
  if (policy === "always") return true;
  // One MediaQueryList (`matches` is live); creating one per animation was a top cost of 1000-element starts. Re-made
  // when `matchMedia` itself is replaced (tests stub it).
  if (typeof matchMedia !== "function") return false;
  if (reducedFor !== matchMedia) reducedQuery = (reducedFor = matchMedia)("(prefers-reduced-motion: reduce)");
  return reducedQuery!.matches;
}
let reducedQuery: MediaQueryList | undefined;
let reducedFor: typeof matchMedia | undefined;

function stateOf(el: Element, from?: MotionState): ElementState {
  let s = elements.get(el);
  if (!s) elements.set(el, (s = { values: { ...from }, running: new Map() }));
  return s;
}

// Keys the state does not know yet start from the element's current value: inline style (the server's final state,
// committed animations), else computed style. Transform groups split back into their motion keys.
function seed(el: Element, s: ElementState, target: Target): void {
  let computed: CSSStyleDeclaration | undefined;
  const read = (property: string) => (el as HTMLElement).style.getPropertyValue(property) || (computed ??= getComputedStyle(el)).getPropertyValue(property);
  for (const key in target) {
    if (key === "transition" || key === "transitionEnd" || key in s.values) continue;
    const property = cssProperty(key);
    const value = read(property).trim();
    if (property === "translate" || property === "scale") {
      const parts = value && value !== "none" ? value.split(/\s+/) : [];
      const keys = property === "translate" ? ["x", "y", "z"] : parts.length > 1 ? ["scaleX", "scaleY"] : ["scale"];
      keys.forEach((k, i) => {
        if (parts[i] !== undefined && !(k in s.values)) s.values[k] = num(parts[i]!);
      });
      // `none`: the identity (a gesture that started from it returns there).
      if (!(key in s.values)) s.values[key] = key.startsWith("scale") ? 1 : 0;
    } else if (value && value !== "none") s.values[key] = num(value);
    else if (property === "rotate") s.values[key] = 0;
  }
}
const num = (text: string): Primitive => (/^-?[\d.]+(e-?\d+)?$/.test(text) ? Number(text) : text);

/** The element's current motion values for `keys` (unknown keys read from its inline / computed style first). */
export function currentValues(el: Element, keys: Iterable<string>): MotionState {
  const s = stateOf(el);
  const probe: Target = {};
  for (const key of keys) probe[key] = 0;
  seed(el, s, probe);
  const out: MotionState = {};
  for (const key of keys) if (key in s.values) out[key] = s.values[key]!;
  return out;
}

/** The element's motion state (a copy). */
export const motionState = (el: Element): MotionState => ({ ...elements.get(el)?.values });

const camels = new Map<string, string>();
const camel = (property: string) => {
  let name = camels.get(property);
  if (name === undefined)
    camels.set(property, (name = property.startsWith("--") ? property : property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())));
  return name;
};
const DONE: AnimateResult = { finished: Promise.resolve(), stop() {} };

/**
 * Hand an element's CSS entrance (`data-mve` / `data-mvv`) over to JS: a still-running entrance commits its current
 * values inline and stops, so the next animation starts where the element is (no jump to the final state).
 */
export function takeOver(el: Element): void {
  const attribute = el.hasAttribute("data-mve") ? "data-mve" : el.hasAttribute("data-mvv") ? "data-mvv" : undefined;
  if (!attribute) return;
  const style = (el as HTMLElement).style;
  let computed: CSSStyleDeclaration | undefined;
  for (const animation of el.getAnimations())
    // Motion's entrance animations only (`rv-mve-*`): the user's own CSS animations keep running.
    if (animation.playState === "running" && String((animation as CSSAnimation).animationName).startsWith("rv-mve-"))
      for (const frame of (animation.effect as KeyframeEffect).getKeyframes())
        for (const key in frame)
          if (key !== "offset" && key !== "easing" && key !== "composite" && key !== "computedOffset") {
            const property = key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
            style.setProperty(property, (computed ??= getComputedStyle(el)).getPropertyValue(property));
          }
  el.removeAttribute(attribute);
}

/** Set `target`'s final values now (no animation); running animations of those properties stop. */
export function setNow(el: Element, target: Target, from?: MotionState): void {
  takeOver(el);
  const s = stateOf(el, from);
  seed(el, s, target);
  s.values = finalState(target, s.values);
  const style = toStyle(s.values);
  const touched = new Set(Object.keys(cssKeyframes(target, s.values)));
  for (const property of touched) {
    s.running.get(property)?.stop();
    s.running.delete(property);
    const value = style[property];
    if (value !== undefined) (el as HTMLElement).style.setProperty(property, value);
  }
}

/** Animate `el` to `target` with `transition` (Motion options, seconds). */
export function animateTo(el: Element, target: Target, transition: Transition | undefined, options: AnimateOptions = {}): AnimateResult {
  const t = transition ?? (target.transition as Transition | undefined);
  const reason = hybridReason(target, t) ?? ((t?.type as unknown) === "spring" ? SPRING : undefined);
  if (reason) {
    if (DEV) throw new Error("@rivetjs/motion: " + reason);
    setNow(el, target, options.from);
    return DONE;
  }
  takeOver(el);
  const s = stateOf(el, options.from);
  seed(el, s, target);
  const policy = options.reduced ?? "user";
  const reduce = reducedActive(policy);
  const frames = cssKeyframes(target, s.values);
  const style = el as HTMLElement;
  s.values = finalState(target, s.values);
  const groups = new Map<unknown, { options: Transition; keyframes: Record<string, string[]>; properties: string[] }>();
  // Per-value overrides (`{ opacity: { duration } }`) split timing groups; without any, one group, one options object.
  let single: Transition | undefined;
  if (!t || !Object.keys(t).some((key) => key in target)) single = transitionOf(t, target, "");
  for (const property in frames) {
    const list = frames[property]!;
    const previous = s.running.get(property);
    if (previous) {
      // Interrupted: mini commits the current value inline; start from it (multi-keyframe targets keep their own start).
      previous.stop();
      s.running.delete(property);
      const now = style.style.getPropertyValue(property);
      if (now && list.length === 2) list[0] = now;
    }
    if (reduce && REDUCED_DROPS.has(property)) {
      style.style.setProperty(property, list.at(-1)!);
      continue;
    }
    if (list.every((v) => v === list[0])) {
      style.style.setProperty(property, list[0]!);
      continue;
    }
    const own = single ?? transitionOf(t, target, property);
    const key = single ?? JSON.stringify(own, (_k, v) => (typeof v === "function" ? fnKey(v) : v));
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { options: own, keyframes: {}, properties: [] }));
    group.keyframes[camel(property)] = list;
    group.properties.push(property);
  }
  if (!groups.size) return DONE;
  options.onStart?.();
  const started: Running[] = [];
  for (const group of groups.values()) {
    const { delayChildren: _d, staggerChildren: _s, ...rest } = group.options;
    const controls = animate(el, group.keyframes as never, rest as never) as unknown as Running;
    started.push(controls);
    for (const property of group.properties) s.running.set(property, controls);
  }
  // `finished` is built on first read (or for `onComplete`): 1000-element starts allocate no promises.
  let finished: Promise<void> | undefined;
  const result: AnimateResult = {
    get finished() {
      return (finished ??= Promise.all(started.map((c) => new Promise<void>((resolve) => void c.then(resolve, () => resolve())))).then(() => {
        for (const [property, controls] of s.running) if (started.includes(controls)) s.running.delete(property);
        options.onComplete?.();
      }));
    },
    stop: () => started.forEach((c) => c.stop()),
  };
  if (options.onComplete) void result.finished;
  return result;
}
const fnIds = new WeakMap<object, number>();
let fnCount = 0;
const fnKey = (fn: object) => "\0f" + (fnIds.get(fn) ?? (fnIds.set(fn, ++fnCount), fnCount));

const sheetRules = new Set<string>();
let sheet: CSSStyleSheet | undefined;

/** Client-rendered entrances (element.tsx): one constructable stylesheet, one rule list per entrance hash. */
export function clientRule(hash: string, css: string): void {
  if (sheetRules.has(hash)) return;
  sheetRules.add(hash);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
  // A rule list per entrance (keyframes + element rule + media block): appended as one parse.
  const parsed = new CSSStyleSheet();
  parsed.replaceSync(css);
  for (const rule of parsed.cssRules) sheet.insertRule(rule.cssText, sheet.cssRules.length);
}
