// Gesture layers (spec D10, Motion React semantics): `whileHover` / `whilePress` / `whileFocus` (and `whileInView`,
// `exit` later) stack over `animate` by priority (variants.ts `LAYERS`); the element animates to the highest active
// layer per key. Keys a gesture sets that no lower layer has return to the value the element had before (captured at
// the gesture's start). Pure DOM glue (no `@rivetjs/runtime/dom`): `element.tsx` hands one handler (a local arrow over
// the element's own props, `_rFn`) to the tag's gesture events, so resumed pages run it from its recipe.
import { animateTo, currentValues, type AnimateResult } from "./engine.ts";
import type { ReducedPolicy } from "./css.ts";
import type { MotionState, Target, Transition } from "./values.ts";
import { LAYERS, activeTarget, mergeTransition, resolveTarget, type Definition, type Layer, type Variants } from "./variants.ts";

type Handler<E> = ((event: E) => void) | undefined;
/** The props gestures read (live: the element's own props object). */
export interface LayerProps {
  initial?: Definition | false;
  animate?: Definition;
  whileHover?: Definition;
  whilePress?: Definition;
  whileFocus?: Definition;
  whileInView?: Definition;
  exit?: Definition;
  variants?: Variants;
  custom?: unknown;
  transition?: Transition;
  reducedMotion?: ReducedPolicy;
  inherit?: boolean;
  onAnimationStart?(definition: Definition): void;
  onAnimationComplete?(definition: Definition): void;
  onHoverStart?(event: PointerEvent): void;
  onHoverEnd?(event: PointerEvent): void;
  onPressStart?(event: PointerEvent | KeyboardEvent): void;
  onPressEnd?(event: PointerEvent | KeyboardEvent | FocusEvent, info: { success: boolean }): void;
  onPress?(event: PointerEvent | KeyboardEvent): void;
  onPointerEnter?: Handler<PointerEvent>;
  onPointerLeave?: Handler<PointerEvent>;
  onPointerDown?: Handler<PointerEvent>;
  onPointerUp?: Handler<PointerEvent>;
  onKeyDown?: Handler<KeyboardEvent>;
  onKeyUp?: Handler<KeyboardEvent>;
  onFocusIn?: Handler<FocusEvent>;
  onFocusOut?: Handler<FocusEvent>;
}

interface Active {
  on: Partial<Record<Layer, boolean>>;
  /** Pre-gesture values of keys only gesture layers set. */
  base: MotionState;
  /** Keyboard press in progress (`Enter` / `" "`), or the pointer-up listener of a pointer press. */
  key?: string;
  release?: (event: PointerEvent) => void;
}
const actives = new WeakMap<Element, Active>();
const activeOf = (el: Element): Active => {
  let a = actives.get(el);
  if (!a) actives.set(el, (a = { on: {}, base: {} }));
  return a;
};

/** Options of one layered animation (element.tsx: the element's merged transition, policy, delay). */
export interface LayerOptions {
  /** The `animate` layer's definition (default `p.animate`; inherited labels for variant children). */
  definition?: Definition;
  /** Report `definition` to `onAnimationStart` / `onAnimationComplete` (an `animate` change; gestures do not). */
  report?: boolean;
  transition?: Transition;
  /** Under the element's own transitions when `transition` is unset: `MotionConfig`'s. */
  base?: Transition;
  reduced?: ReducedPolicy;
  /** Extra delay (ms): a variant parent's orchestration. */
  delay?: number;
}
/** `MotionConfig`'s values (element.tsx `Config`: accessors). */
export interface LayerConfig {
  transition(): Transition | undefined;
  reducedMotion(): ReducedPolicy | undefined;
}
/** A variant parent's current labels (element.tsx `Scope`). */
export interface LayerParent {
  animate(): Definition | undefined;
}
/** Gesture / in-view options under MotionConfig (transition under the element's own, policy) and inherited labels. */
const optionsOf = (p: LayerProps, config: LayerConfig | null | undefined, parent: LayerParent | null | undefined): LayerOptions | undefined =>
  config || parent
    ? {
        base: config?.transition(),
        reduced: p.reducedMotion ?? config?.reducedMotion() ?? "user",
        definition: p.animate === undefined && parent && p.inherit !== false ? parent.animate() : undefined,
      }
    : undefined;

/** Animate `el` to its layers' target (`animate` + active gestures). */
export function animateLayers(el: Element, p: LayerProps, options: LayerOptions = {}): AnimateResult | undefined {
  const a = activeOf(el);
  const layers: Partial<Record<Layer, Target | undefined>> = {};
  for (const layer of LAYERS)
    if (layer === "animate" || a.on[layer])
      layers[layer] = resolveTarget(layer === "animate" ? (options.definition ?? p.animate) : p[layer], p.variants, p.custom);
  const target = activeTarget(layers);
  const own = layers.animate ?? {};
  const fresh: string[] = [];
  for (const key in target) if (key !== "transition" && !(key in own) && !(key in a.base)) fresh.push(key);
  if (fresh.length) Object.assign(a.base, currentValues(el, fresh));
  for (const key in a.base) if (!(key in target)) target[key] = a.base[key]!;
  for (const key in a.base) if (key in own) delete a.base[key];
  if (!Object.keys(target).some((k) => k !== "transition")) return undefined;
  let transition = options.transition ?? mergeTransition(options.base, p.transition, target.transition as Transition | undefined);
  // The highest gesture layer's own transition wins over the element's (Motion: target transition first).
  if (target.transition && target.transition !== own.transition) transition = { ...transition, ...(target.transition as Transition) };
  if (options.delay) transition = { ...transition, delay: (transition?.delay ?? 0) + options.delay / 1000 };
  const definition = options.definition;
  return animateTo(el, target, transition, {
    reduced: options.reduced ?? p.reducedMotion ?? "user",
    ...(definition !== undefined && options.report
      ? { onStart: () => p.onAnimationStart?.(definition), onComplete: () => p.onAnimationComplete?.(definition) }
      : {}),
  });
}

/** The `exit` layer on / off (presence scope leaving / back): the started animation, for the scope to hold its unmount. */
export function setExit(el: Element, p: LayerProps, on: boolean, options: LayerOptions): AnimateResult | undefined {
  const a = activeOf(el);
  if (!!a.on.exit === on) return undefined;
  a.on.exit = on;
  return p.exit !== undefined ? animateLayers(el, p, options) : undefined;
}

/** Turn a gesture layer on / off (true: it changed); animates when the element defines that layer. */
export function setLayer(el: Element, p: LayerProps, layer: Layer, on: boolean, config?: LayerConfig | null, parent?: LayerParent | null): boolean {
  const a = activeOf(el);
  if (!!a.on[layer] === on) return false;
  a.on[layer] = on;
  if (p[layer] !== undefined) animateLayers(el, p, optionsOf(p, config, parent));
  return true;
}

function pressEnd(
  el: Element,
  p: LayerProps,
  event: PointerEvent | KeyboardEvent | FocusEvent,
  success: boolean,
  config?: LayerConfig | null,
  parent?: LayerParent | null,
): void {
  const a = activeOf(el);
  if (a.release) {
    removeEventListener("pointerup", a.release);
    removeEventListener("pointercancel", a.release);
    a.release = undefined;
  }
  a.key = undefined;
  setLayer(el, p, "whilePress", false, config, parent);
  p.onPressEnd?.(event, { success });
  if (success) p.onPress?.(event as PointerEvent | KeyboardEvent);
}

// The user's handler per event type (composed: it runs first).
const USER: Record<string, keyof LayerProps> = {
  pointerenter: "onPointerEnter",
  pointerleave: "onPointerLeave",
  pointerdown: "onPointerDown",
  pointerup: "onPointerUp",
  keydown: "onKeyDown",
  keyup: "onKeyUp",
  focusin: "onFocusIn",
  focusout: "onFocusOut",
};

/**
 * The gesture handler of every gesture event (`onPointerEnter` / `Leave` / `Down` / `Up`, `onKeyDown` / `Up`, `onFocusIn` /
 * `Out`): hover (mouse / pen; touch ignored, as Motion), press (primary pointer down until release — inside = success —
 * or Enter / Space held on the element itself; cancel / release outside / blur = no success), focus (`:focus-visible`).
 */
export function gesture(event: Event, p: LayerProps, config?: LayerConfig | null, parent?: LayerParent | null): void {
  const type = event.type;
  (p[USER[type]!] as ((e: Event) => void) | undefined)?.(event);
  const el = event.currentTarget as Element;
  const a = activeOf(el);
  if (type === "pointerenter" || type === "pointerleave") {
    if ((event as PointerEvent).pointerType === "touch") return;
    const on = type === "pointerenter";
    if (setLayer(el, p, "whileHover", on, config, parent)) (on ? p.onHoverStart : p.onHoverEnd)?.(event as PointerEvent);
  } else if (type === "pointerdown" || type === "keydown") {
    const key = (event as KeyboardEvent).key;
    if (a.on.whilePress) return;
    if (type === "keydown") {
      if ((key !== "Enter" && key !== " ") || (event as KeyboardEvent).repeat || event.target !== el) return;
      a.key = key;
    } else {
      if (!(event as PointerEvent).isPrimary || (event as PointerEvent).button !== 0) return;
      a.release = (up: PointerEvent) => pressEnd(el, p, up, up.type === "pointerup" && el.contains(up.target as Node), config, parent);
      addEventListener("pointerup", a.release);
      addEventListener("pointercancel", a.release);
    }
    setLayer(el, p, "whilePress", true, config, parent);
    p.onPressStart?.(event as PointerEvent | KeyboardEvent);
  } else if (type === "pointerup") {
    // Released on the element (also a resumed page replaying a cold pointerdown after the real release: the window
    // listener came too late for it); the window listener covers releases outside.
    if (a.release) a.release(event as PointerEvent);
  } else if (type === "keyup") {
    if (a.key === (event as KeyboardEvent).key) pressEnd(el, p, event as KeyboardEvent, true, config, parent);
  } else if (event.target === el) {
    if (type === "focusin") {
      if (el.matches(":focus-visible")) setLayer(el, p, "whileFocus", true, config, parent);
    } else {
      if (a.key) pressEnd(el, p, event as FocusEvent, false, config, parent);
      setLayer(el, p, "whileFocus", false, config, parent);
    }
  }
}
