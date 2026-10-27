// Rivet-authored (no upstream; no React Aria / Angular CDK wheel picker): iOS-style scroll wheel ("drum") behaviour —
// one column of options that spins under a fixed selection band. Motion = the house motion `@rivetjs/cdk/motion`
// (embla-carousel 8.6.0 physics, MIT, © David Jerleke; user decision 2026-10-08: no CSS transitions / hand-rolled
// easing in components that adopt it).
// - Units: the drum position is in items (float; looped drums are unbounded: option = position mod count). Item `i`
//   renders at `wheelOffset(i, position)` items from the centre: an inline `transform: translateY(calc((d - 0.5) *
//   100%))` (items are absolutely positioned at `top: 50%`, so no measurement is needed to render, also on the server)
//   + `--rv-wheel-offset` (signed) / `--rv-wheel-distance` (absolute) for the stylesheet (fade, scale, colour).
// - State = plain signals + JSON (resumable): `selected` (`controllable`: plain / Signal / accessor value), `position`
//   (items while the drum moves, `null` at rest = the selected index). The motion runtime (Motion1D, pointer, wheel
//   timer) lives in a module WeakMap keyed by the state, created by the first interaction: nothing runs before it.
// - Drag (pointer): follows 1:1 after 4 px; release = `VelocityTracker` flick force × `DragRelease` free boost (500 mouse /
//   600 touch: iOS deceleration throws ~0.5 s of velocity) projected, rounded to the nearest enabled item, settled with
//   `DragRelease.settle` (duration / friction from how far the snap falls short of the throw). Non-looped drums rubber
//   band past the ends (0.2). A press without drag on an item spins to it.
// - Wheel: line / page deltas and large pixel notches (>= 50 px, a mouse wheel) step one item; small pixel deltas
//   (trackpad) move the drum continuously and snap 120 ms after the last event.
// - Keyboard (spinbutton): ArrowUp / ArrowDown ±1, PageUp / PageDown ± `pageStep`, Home / End first / last enabled option,
//   printable keys = type-ahead (1 s buffer; digits match numeric values, other text the label prefix). Steps skip
//   disabled options; looped drums wrap (59 → 00), others stop at the ends.
// - `prefers-reduced-motion: reduce` → every settle / step jumps (a drag still follows the pointer).
// - The value is committed when the target is decided (release, step, wheel snap, tap), not per frame.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { controllable, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { DragRelease, Motion1D, VelocityTracker, type Motion1DType, type VelocityTrackerType } from "../motion/index.ts";

export type WheelValue = string | number;

/** One option of a drum. */
export interface WheelOption<V extends WheelValue = WheelValue> {
  value: V;
  /** Text shown on the drum and announced as `aria-valuetext`. */
  label: string;
}

export interface WheelStateOptions<V extends WheelValue = WheelValue> {
  /** The options, in drum order (read once). */
  options: readonly WheelOption<V>[];
  /** Selected value (controlled): a plain value, a two-way Signal or an accessor. */
  value?: V | null | Signal<V | null> | (() => V | null);
  /** Initial selected value (uncontrolled). */
  defaultValue?: V | null;
  /** Called with the new value once a spin / step / tap decides it. */
  onChange?: (value: V) => void;
  /** Whether the drum wraps around (infinite). Needs `visibleItems + 2` options or more, else it stops at the ends. @default false */
  loop?: boolean;
  /** Options that cannot be selected (skipped by steps, spins and type-ahead); may read signals. */
  isOptionDisabled?: (value: V) => boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  /** Items visible in the drum (odd; the stylesheet sizes the drum to it via `--rv-wheel-visible`). @default 5 */
  visibleItems?: number;
  /** Items PageUp / PageDown move. @default 5 */
  pageStep?: number;
}

export interface WheelState<V extends WheelValue = WheelValue> {
  readonly options: readonly WheelOption<V>[];
  readonly selected: ControlledState<V | null>;
  /** Whether the drum wraps (`loop` and enough options). */
  readonly loop: boolean;
  readonly visibleItems: number;
  readonly pageStep: number;
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly isOptionDisabled: ((value: V) => boolean) | undefined;
  /** Position in items while the drum moves; `null` at rest (the selected index). */
  readonly position: Signal<number | null>;
  /** Type-ahead buffer. */
  readonly search: { text: string; time: number };
}

/** Pixels a pointer moves before a press becomes a drag. */
export const WHEEL_DRAG_THRESHOLD = 4;
/** Drum-to-pointer ratio past the ends of a non-looped drum. */
export const WHEEL_RUBBER_BAND = 0.2;
/** Idle time (ms) after the last trackpad wheel event before the drum snaps. */
export const WHEEL_SNAP_DELAY = 120;
const BASE_FRICTION = 0.68;

/** Whether a drum of `count` options showing `visibleItems` wraps when `loop` is asked for. */
export const wheelLoops = (count: number, loop: boolean, visibleItems: number): boolean => loop && count >= visibleItems + 2;

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Distance (items) of item `index` from the centre at `position`; looped: the shortest way round, in [-count/2, count/2). */
export function wheelOffset(index: number, position: number, count: number, loop: boolean): number {
  const d = index - position;
  return loop ? mod(d + count / 2, count) - count / 2 : d;
}

/** Wheel state (`createWheelState`): the selected value + the motion position. */
export function createWheelState<V extends WheelValue = WheelValue>(options: WheelStateOptions<V>): WheelState<V> {
  const visibleItems = Math.max(1, Math.floor(options.visibleItems ?? 5) | 1);
  return {
    options: options.options,
    selected: controllable<V | null>(options.value, options.defaultValue ?? null, options.onChange as ((value: V | null) => void) | undefined),
    loop: wheelLoops(options.options.length, !!options.loop, visibleItems),
    visibleItems,
    pageStep: Math.max(1, Math.floor(options.pageStep ?? 5)),
    isDisabled: !!options.isDisabled,
    isReadOnly: !!options.isReadOnly,
    isOptionDisabled: options.isOptionDisabled,
    position: signal<number | null>(null),
    search: { text: "", time: 0 },
  };
}

/** Index of the selected option (-1: none). Reads. */
export function wheelSelectedIndex<V extends WheelValue>(state: WheelState<V>): number {
  const value = state.selected.value();
  if (value == null) return -1;
  return state.options.findIndex((option) => option.value === value);
}

/** The rendered position (items): the moving position, else the selected index (0 when nothing is selected). Reads. */
export function wheelPosition<V extends WheelValue>(state: WheelState<V>): number {
  const moving = state.position();
  return moving ?? Math.max(0, wheelSelectedIndex(state));
}

/** The option index at the centre (rounded position). Reads. */
export function wheelCenterIndex<V extends WheelValue>(state: WheelState<V>): number {
  const count = state.options.length;
  if (!count) return -1;
  const index = Math.round(wheelPosition(state));
  return state.loop ? mod(index, count) : Math.max(0, Math.min(count - 1, index));
}

/** Whether option `index` is disabled. Reads (the caller's `isOptionDisabled` may track signals). */
export function isWheelOptionDisabled<V extends WheelValue>(state: WheelState<V>, index: number): boolean {
  const option = state.options[index];
  return !option || !!state.isOptionDisabled?.(option.value);
}

/** Inline style of item `index` (behaviour-critical position + the offset variables). Reads the position. */
export function wheelItemStyle<V extends WheelValue>(state: WheelState<V>, index: number): Record<string, string | number | undefined> {
  const d = wheelOffset(index, wheelPosition(state), state.options.length, state.loop);
  const r = +d.toFixed(4);
  return {
    position: "absolute",
    top: "50%",
    left: "0",
    right: "0",
    transform: `translateY(calc(${+(r - 0.5).toFixed(4)} * 100%))`,
    visibility: Math.abs(d) > state.visibleItems / 2 + 1 ? "hidden" : undefined,
    "--rv-wheel-offset": r,
    "--rv-wheel-distance": Math.abs(r),
  };
}

/** Inline style of the drum element (behaviour-critical: clipping, gestures, no text selection). */
export function wheelStyle(visibleItems: number): Record<string, string | number> {
  return {
    position: "relative",
    overflow: "hidden",
    "touch-action": "none",
    "user-select": "none",
    "-webkit-user-select": "none",
    "--rv-wheel-visible": visibleItems,
  };
}

// Runtime -----------------------------------------------------------------------------------------

interface WheelRuntime {
  el: HTMLElement;
  /** Value = drum position (items). */
  motion: Motion1DType;
  tracker: VelocityTrackerType;
  /** Item height (px), measured when an interaction starts. */
  h: number;
  pointer: { id: number; y: number; start: number; mouse: boolean; dragging: boolean; target: EventTarget | null } | null;
  wheeling: boolean;
  wheelTimer: ReturnType<typeof setTimeout> | undefined;
  detach: (() => void) | undefined;
}

const runtimes = new WeakMap<object, WheelRuntime>();
const release = DragRelease(true, BASE_FRICTION);

function measure(rt: WheelRuntime): void {
  const item = rt.el.querySelector<HTMLElement>("[data-rv-wheel-item]");
  rt.h = item?.offsetHeight || rt.h || 32;
}

function runtimeOf<V extends WheelValue>(state: WheelState<V>, el: HTMLElement): WheelRuntime {
  let rt = runtimes.get(state);
  if (rt && rt.el === el) {
    // At rest the value may have moved without the drum (reduced motion, a value set before the drum was touched).
    if (untrack(state.position) === null && !rt.pointer && !rt.wheeling)
      rest(
        rt,
        untrack(() => wheelPosition(state)),
      );
    return rt;
  }
  const start = untrack(() => wheelPosition(state));
  const motion = Motion1D({
    value: start,
    friction: BASE_FRICTION,
    render: (value) => state.position.set(value),
    onSettle: () => {
      el.removeAttribute("data-moving");
      // At rest the selected index renders the drum; the motion restarts from there (looped: no unbounded drift).
      if (rt!.pointer || rt!.wheeling) return;
      state.position.set(null);
      rest(
        rt!,
        untrack(() => wheelPosition(state)),
      );
    },
  });
  rt = { el, motion, tracker: VelocityTracker(), h: 0, pointer: null, wheeling: false, wheelTimer: undefined, detach: undefined };
  runtimes.set(state, rt);
  return rt;
}

function rest(rt: WheelRuntime, position: number): void {
  const { motion } = rt;
  motion.location.set(position);
  motion.previousLocation.set(position);
  motion.offsetLocation.set(position);
  motion.target.set(position);
}

const reducedMotion = (el: Element): boolean => {
  const view = el.ownerDocument.defaultView;
  return !!view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
};

/** The enabled target nearest to `target` (unbounded on looped drums), searching `dir` first; `null`: none. */
export function wheelNearestEnabled<V extends WheelValue>(state: WheelState<V>, target: number, dir: 1 | -1 = 1): number | null {
  const count = state.options.length;
  if (!count) return null;
  let t = Math.round(target);
  if (!state.loop) t = Math.max(0, Math.min(count - 1, t));
  const ok = (n: number): boolean => (state.loop || (n >= 0 && n < count)) && !untrack(() => isWheelOptionDisabled(state, mod(n, count)));
  if (ok(t)) return t;
  for (let k = 1; k < count; k++) {
    if (ok(t + dir * k)) return t + dir * k;
    if (ok(t - dir * k)) return t - dir * k;
  }
  return null;
}

/** The first enabled target stepping from `from` by `step` (wrapping on looped drums); `null` at the end of a non-looped drum. */
function stepTarget<V extends WheelValue>(state: WheelState<V>, from: number, step: number): number | null {
  const count = state.options.length;
  const dir = step > 0 ? 1 : -1;
  let t = Math.round(from) + step;
  if (!state.loop) {
    t = Math.max(0, Math.min(count - 1, t));
    for (; t >= 0 && t < count; t += dir) if (!untrack(() => isWheelOptionDisabled(state, t))) return t === Math.round(from) ? null : t;
    return null;
  }
  for (let k = 0; k < count; k++, t += dir) if (!untrack(() => isWheelOptionDisabled(state, mod(t, count)))) return t;
  return null;
}

function commit<V extends WheelValue>(state: WheelState<V>, target: number): void {
  const option = state.options[mod(target, state.options.length)];
  if (option) setControlledValue(state.selected, option.value);
}

/** Animates the drum to `target` (items; `force` = the throw that got there, for the settle physics); jumps on reduced motion / `jump`. */
function spin<V extends WheelValue>(state: WheelState<V>, rt: WheelRuntime, target: number, force = 0, jump = false): void {
  const { motion, el } = rt;
  if (jump || reducedMotion(el)) {
    motion.to(target, true);
    if (untrack(state.position) !== null && motion.settled()) {
      el.removeAttribute("data-moving");
      state.position.set(null);
      rest(
        rt,
        untrack(() => wheelPosition(state)),
      );
    }
    return;
  }
  const current = motion.target.get();
  if (!force && Math.abs(target - current) < 0.0005 && motion.settled()) return;
  const { duration, friction } = release.settle(force || target - current, target - current);
  el.setAttribute("data-moving", "true");
  state.position.set(motion.get());
  motion.scrollBody.useDuration(force ? duration : 25).useFriction(force ? friction : BASE_FRICTION);
  motion.target.set(target);
  motion.animation.start();
}

/** Spins to `target` and selects it. */
function select<V extends WheelValue>(state: WheelState<V>, el: HTMLElement, target: number | null, force = 0): void {
  if (target == null) return;
  const rt = runtimeOf(state, el);
  measure(rt);
  commit(state, target);
  spin(state, rt, target, force);
}

/** The target equivalent to option `index` nearest to `from` (looped: the shortest way round). */
const nearestCopy = (index: number, from: number, count: number, loop: boolean): number =>
  loop ? Math.round(from) + Math.round(wheelOffset(index, Math.round(from), count, true)) : index;

const blocked = <V extends WheelValue>(state: WheelState<V>): boolean => state.isDisabled || state.isReadOnly || !state.options.length;

/** Spins the drum to option `index` (programmatic; the value is set). */
export function wheelSelectIndex<V extends WheelValue>(state: WheelState<V>, el: HTMLElement, index: number, jump = false): void {
  const rt = runtimeOf(state, el);
  measure(rt);
  const target = nearestCopy(index, rt.motion.target.get(), state.options.length, state.loop);
  commit(state, target);
  spin(state, rt, target, 0, jump);
}

/**
 * Follows a selected value changed from outside (e.g. a typed field segment): spins from where the drum shows to the new
 * index. Call from a client effect with the new index; no-op while the drum already heads there.
 */
export function wheelFollow<V extends WheelValue>(state: WheelState<V>, el: HTMLElement, index: number, previous: number): void {
  if (index < 0 || previous < 0 || index === previous) return;
  const count = state.options.length;
  const rt = runtimes.get(state);
  if (rt && rt.el === el) {
    if (rt.pointer || rt.wheeling) return;
    if (mod(Math.round(rt.motion.target.get()), count) === index) return;
  }
  if (reducedMotion(el)) return;
  const runtime = runtimeOf(state, el);
  if (!rt) rest(runtime, previous);
  measure(runtime);
  spin(state, runtime, nearestCopy(index, runtime.motion.target.get(), count, state.loop));
}

// Handlers ------------------------------------------------------------------------------------------

/** `pointerdown` on the drum: grab (stops a spin), then drag / flick, or tap an item. */
export function wheelPointerDown<V extends WheelValue>(event: PointerEvent, state: WheelState<V>): void {
  if (blocked(state) || (event.pointerType === "mouse" && event.button !== 0)) return;
  const el = event.currentTarget as HTMLElement;
  wheelArm(state, el);
  const rt = runtimeOf(state, el);
  if (rt.pointer) return;
  measure(rt);
  const view = el.ownerDocument.defaultView!;
  event.preventDefault();
  if (el.ownerDocument.activeElement !== el) el.focus({ preventScroll: true });
  if (rt.wheeling) endWheel(rt);
  rt.motion.hold(true);
  rt.pointer = {
    id: event.pointerId,
    y: event.clientY,
    start: rt.motion.target.get(),
    mouse: event.pointerType === "mouse",
    dragging: false,
    target: event.target,
  };
  rt.tracker.pointerDown(-event.clientY, event.timeStamp);
  const count = state.options.length;
  const move = (e: PointerEvent): void => {
    const p = rt.pointer;
    if (!p || e.pointerId !== p.id) return;
    const dy = e.clientY - p.y;
    if (!p.dragging) {
      if (Math.abs(dy) < WHEEL_DRAG_THRESHOLD) return;
      p.dragging = true;
      el.setAttribute("data-dragging", "true");
      el.setAttribute("data-moving", "true");
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic pointers have no capture.
      }
    }
    e.preventDefault();
    rt.tracker.pointerMove(-e.clientY, e.timeStamp);
    let next = p.start - dy / rt.h;
    if (!state.loop) {
      const max = count - 1;
      if (next < 0) next *= WHEEL_RUBBER_BAND;
      else if (next > max) next = max + (next - max) * WHEEL_RUBBER_BAND;
    }
    rt.motion.drag(next - rt.motion.target.get());
  };
  const up = (e: PointerEvent): void => {
    const p = rt.pointer;
    if (!p || e.pointerId !== p.id) return;
    rt.pointer = null;
    rt.detach?.();
    el.removeAttribute("data-dragging");
    rt.motion.hold(false);
    const current = rt.motion.target.get();
    if (!p.dragging) {
      // Tap: spin to the pressed item (or settle where the grab stopped the drum).
      const item = (p.target as Element | null)?.closest?.("[data-rv-wheel-item]");
      const index = item ? Number(item.getAttribute("data-index")) : NaN;
      const goal = Number.isFinite(index) ? current + wheelOffset(index, current, count, state.loop) : current;
      if (e.type === "pointercancel") return select(state, el, wheelNearestEnabled(state, current));
      return select(state, el, wheelNearestEnabled(state, goal));
    }
    const forcePx = e.type === "pointercancel" ? 0 : rt.tracker.pointerUp(e.timeStamp) * release.forceBoost(p.mouse);
    const force = forcePx / rt.h;
    const projected = current + force;
    const target = wheelNearestEnabled(state, projected, force >= 0 ? 1 : -1);
    select(state, el, target, force);
  };
  view.addEventListener("pointermove", move, { passive: false });
  view.addEventListener("pointerup", up);
  view.addEventListener("pointercancel", up);
  rt.detach = () => {
    view.removeEventListener("pointermove", move);
    view.removeEventListener("pointerup", up);
    view.removeEventListener("pointercancel", up);
    rt.detach = undefined;
  };
}

function endWheel(rt: WheelRuntime): void {
  clearTimeout(rt.wheelTimer);
  rt.wheelTimer = undefined;
  rt.wheeling = false;
  rt.motion.hold(false);
}

const armed = new WeakSet<Element>();

/**
 * Installs the drum's non-passive `wheel` listener (once per element). Delegated / resumed listeners for `wheel` are
 * passive (they cannot keep the page from scrolling), so the drum adds its own: from a client render's effect, and on a
 * resumed page from the first pointer over / press / key on the drum (the mouse is over it before a wheel turns).
 */
export function wheelArm<V extends WheelValue>(state: WheelState<V>, el: Element): void {
  if (armed.has(el)) return;
  armed.add(el);
  el.addEventListener("wheel", (event) => wheelWheel(event as WheelEvent, state), { passive: false });
}

/** `wheel` on the drum: notches step one item; trackpad deltas spin continuously and snap when they stop. */
export function wheelWheel<V extends WheelValue>(event: WheelEvent, state: WheelState<V>): void {
  if (blocked(state)) return;
  const el = event.currentTarget as HTMLElement;
  const rt = runtimeOf(state, el);
  if (rt.pointer) return;
  const delta = event.deltaY || (event.shiftKey ? event.deltaX : 0);
  if (!delta) return;
  event.preventDefault();
  measure(rt);
  const notch = event.deltaMode !== 0 || (Math.abs(delta) >= 50 && !rt.wheeling);
  if (notch) {
    const steps = event.deltaMode === 2 ? state.pageStep : 1;
    return select(state, el, stepTarget(state, rt.motion.target.get(), delta > 0 ? steps : -steps));
  }
  if (!rt.wheeling) {
    rt.wheeling = true;
    rt.motion.hold(true);
    el.setAttribute("data-moving", "true");
  }
  let next = rt.motion.target.get() + delta / rt.h;
  if (!state.loop) next = Math.max(-0.4, Math.min(state.options.length - 0.6, next));
  rt.motion.drag(next - rt.motion.target.get());
  clearTimeout(rt.wheelTimer);
  rt.wheelTimer = setTimeout(() => {
    endWheel(rt);
    const current = rt.motion.target.get();
    select(state, el, wheelNearestEnabled(state, current, delta > 0 ? 1 : -1));
  }, WHEEL_SNAP_DELAY);
}

/** Type-ahead match for `text` (lower case): an option whose numeric value equals the digits, else the first label prefix. */
function searchIndex<V extends WheelValue>(state: WheelState<V>, text: string): number {
  const numeric = /^\d+$/.test(text) ? Number(text) : NaN;
  const enabled = (i: number): boolean => !untrack(() => isWheelOptionDisabled(state, i));
  const options = state.options;
  if (!isNaN(numeric)) {
    const exact = options.findIndex((o, i) => typeof o.value === "number" && o.value === numeric && enabled(i));
    if (exact >= 0) return exact;
  }
  return options.findIndex(
    (o, i) => enabled(i) && (o.label.toLowerCase().startsWith(text) || (typeof o.value === "number" && !isNaN(numeric) && String(o.value).startsWith(text))),
  );
}

/** Keys `wheelKeyDown` steps with (drum `data-rk`: held while a cold chunk loads, so they never scroll the page). */
export const WHEEL_KEYS = "ArrowUp ArrowDown PageUp PageDown Home End";

/** `keydown` on the drum (spinbutton keys + type-ahead). */
export function wheelKeyDown<V extends WheelValue>(event: KeyboardEvent, state: WheelState<V>): void {
  if (blocked(state) || event.altKey || event.ctrlKey || event.metaKey) return;
  const el = event.currentTarget as HTMLElement;
  wheelArm(state, el);
  const count = state.options.length;
  const from = (): number => {
    const rt = runtimes.get(state);
    return rt && rt.el === el ? rt.motion.target.get() : untrack(() => wheelPosition(state));
  };
  let target: number | null | undefined;
  switch (event.key) {
    case "ArrowUp":
      target = stepTarget(state, from(), 1);
      break;
    case "ArrowDown":
      target = stepTarget(state, from(), -1);
      break;
    case "PageUp":
      target = stepTarget(state, from(), state.pageStep);
      break;
    case "PageDown":
      target = stepTarget(state, from(), -state.pageStep);
      break;
    case "Home":
    case "End": {
      const home = event.key === "Home";
      let index = home ? 0 : count - 1;
      while (index >= 0 && index < count && untrack(() => isWheelOptionDisabled(state, index))) index += home ? 1 : -1;
      if (index >= 0 && index < count) target = nearestCopy(index, from(), count, state.loop);
      break;
    }
    default: {
      if (event.key.length !== 1 || event.key === " ") return;
      const now = Date.now();
      const search = state.search;
      if (now - search.time > 1000) search.text = "";
      search.time = now;
      search.text += event.key.toLowerCase();
      let index = searchIndex(state, search.text);
      if (index < 0) {
        search.text = event.key.toLowerCase();
        index = searchIndex(state, search.text);
      }
      if (index >= 0) target = nearestCopy(index, from(), count, state.loop);
      else target = null;
    }
  }
  if (target === undefined) return;
  event.preventDefault();
  select(state, el, target);
}

/** Stops the drum's motion and listeners (unmount). */
export function wheelDispose<V extends WheelValue>(state: WheelState<V>): void {
  const rt = runtimes.get(state);
  if (!rt) return;
  rt.detach?.();
  clearTimeout(rt.wheelTimer);
  rt.motion.stop();
  runtimes.delete(state);
}
