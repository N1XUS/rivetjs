// Rivet-authored (no upstream: React Aria / React Aria Components / Angular CDK have no compare slider): before / after
// comparison behaviour — two overlapped layers and a draggable divider that reveals one over the other. Composed from cdk
// primitives: `controllable` (value / defaultValue / onChange), `../interactions/utils.ts` text-selection lock (RA
// useMove), `../interactions/focus-visible.tsx` modality, `useLocale` direction (RTL) and the house motion
// `../motion` (embla-carousel 8.6.0 physics, MIT, © David Jerleke) for the animated settle.
// - Value = the share of the "before" layer in percent (0–100), measured from the start edge (left in LTR, right in RTL,
//   top when vertical). The "after" layer sits on top and is clipped to the end side by an inline `clip-path: inset(…)`
//   (behaviour-critical: inline, never keyed on a class).
// - Pointer: a press on the handle grabs it where it was hit (no jump) and follows the pointer 1:1 (continuous value,
//   2 decimals); with `dragAnywhere` a press on the surface jumps there (animated) and keeps following the pointer.
//   `onChange` per move, `onChangeEnd` on release. Window listeners while dragging (pointermove / pointerup / cancel).
// - Keyboard (the handle is an ARIA slider): Arrow keys ± `step` (Shift: `pageStep`), PageUp / PageDown ± `pageStep`,
//   Home / End 0 / 100. Horizontal: ArrowRight / ArrowUp increase (RTL: ArrowLeft / ArrowUp, React Aria slider rules);
//   vertical: the divider follows the arrows spatially (ArrowDown / ArrowRight increase: the value grows downward).
//   Keyed values snap to `step`; `onChange` + `onChangeEnd` once per key that moves the divider.
// - Motion: keys and surface jumps commit the value at once and animate the rendered position (`position`, `null` at
//   rest) with `Motion1D` (`animation` tunes duration / friction, `false` = jump); a drag is 1:1 (a running settle is
//   retargeted, so a press-and-drag on the surface stays continuous). `prefers-reduced-motion: reduce` always jumps.
// - State = plain signals + JSON (resumable): the runtime (Motion1D, drag) lives in a module WeakMap keyed by the state,
//   created by the first interaction — nothing runs before it.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { controllable, controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { noteModality } from "../interactions/focus-visible.tsx";
import { cachedIntl } from "../i18n/intl-cache.ts";
import { disableTextSelection, read, restoreTextSelection } from "../interactions/utils.ts";
import { Motion1D, type Motion1DType } from "../motion/index.ts";

export type CompareOrientation = "horizontal" | "vertical";

/** Motion of the animated settle (embla units: `duration` in fixed steps, `friction` 0–1). */
export interface CompareMotionOptions {
  duration?: number;
  friction?: number;
}

export interface CompareStateOptions {
  /** The before share in percent (controlled): a plain value, a two-way Signal or an accessor. */
  value?: number | Signal<number> | (() => number);
  /** Initial value (uncontrolled). @default 50 */
  defaultValue?: number;
  /** Called with every new value (each pointer move, each key). */
  onChange?: (value: number) => void;
  /** Called once an interaction ends (pointer release, each key). */
  onChangeEnd?: (value: number) => void;
  /** @default "horizontal" */
  orientation?: CompareOrientation;
  /** Disables pointer and keyboard interaction (the handle stays focusable-off). */
  isDisabled?: boolean | (() => boolean | undefined);
  /** Arrow key step (percent). @default 1 */
  step?: number;
  /** PageUp / PageDown / Shift+Arrow step (percent). @default 10 */
  pageStep?: number;
  /** A press anywhere on the surface jumps the divider there and drags it. @default false */
  dragAnywhere?: boolean;
  /** Animated settle for keys / surface jumps; `false` jumps. @default true */
  animation?: boolean | CompareMotionOptions;
  /** Writing direction (horizontal: the start edge). @default "ltr" */
  direction?: "ltr" | "rtl";
  /** Locale of the default `aria-valuetext` (percent). @default "en-US" */
  locale?: string;
}

export interface CompareState {
  readonly value: ControlledState<number>;
  /** Rendered position while a settle animates; `null` at rest (the value renders). */
  readonly position: Signal<number | null>;
  /** Whether a pointer drags the divider. */
  readonly dragging: Signal<boolean>;
  readonly orientation: CompareOrientation;
  readonly direction: "ltr" | "rtl";
  readonly isDisabled: boolean | (() => boolean | undefined) | undefined;
  readonly step: number;
  readonly pageStep: number;
  readonly dragAnywhere: boolean;
  readonly onChangeEnd: ((value: number) => void) | undefined;
  readonly locale: string;
  /** Settle motion (`duration` 0 = jump). */
  readonly duration: number;
  readonly friction: number;
}

/** Default settle duration (embla units): a quick, slightly soft glide. */
export const COMPARE_DURATION = 20;
/** Default settle friction (embla engine constant). */
export const COMPARE_FRICTION = 0.68;
/** `data-rk` of the handle: every key `compareKeyDown` handles (a cold key on a resumed page never scrolls). */
export const COMPARE_KEYS = "ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown Home End";

const clamp = (v: number): number => (v < 0 ? 0 : v > 100 ? 100 : v);
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Compare state (`createCompareState`): the value + the settle position. */
export function createCompareState(options: CompareStateOptions = {}): CompareState {
  const animation = options.animation ?? true;
  const motion = typeof animation === "object" ? animation : {};
  return {
    value: controllable<number>(options.value, clamp(options.defaultValue ?? 50), options.onChange),
    position: signal<number | null>(null),
    dragging: signal(false),
    orientation: options.orientation === "vertical" ? "vertical" : "horizontal",
    direction: options.direction === "rtl" ? "rtl" : "ltr",
    isDisabled: options.isDisabled,
    step: options.step && options.step > 0 ? options.step : 1,
    pageStep: options.pageStep && options.pageStep > 0 ? options.pageStep : 10,
    dragAnywhere: !!options.dragAnywhere,
    onChangeEnd: options.onChangeEnd,
    locale: options.locale ?? "en-US",
    duration: animation === false ? 0 : (motion.duration ?? COMPARE_DURATION),
    friction: motion.friction ?? COMPARE_FRICTION,
  };
}

/** The value (percent, clamped). Reads. */
export function compareValue(state: CompareState): number {
  return clamp(Number(state.value.value()) || 0);
}

/** The rendered divider position (percent): the settle position while it animates, else the value. Reads. */
export function comparePosition(state: CompareState): number {
  return state.position() ?? compareValue(state);
}

/** Whether the compare is disabled now (live accessors read). */
export function isCompareDisabled(state: CompareState): boolean {
  return !!read(state.isDisabled);
}

const PERCENT: Intl.NumberFormatOptions = { style: "percent", maximumFractionDigits: 0 };

/** Localized percent text of the value (`aria-valuetext`). Reads. Formatter cached per locale (`i18n/intl-cache`). */
export function compareValueText(state: CompareState): string {
  const value = Math.round(compareValue(state));
  try {
    return cachedIntl(Intl.NumberFormat, state.locale, PERCENT).format(value / 100);
  } catch {
    return `${value}%`;
  }
}

const pct = (v: number): string => `${+v.toFixed(3)}%`;

/** Inline style of the root (behaviour-critical: stacking context for the layers, gestures) + `--rv-compare-position`. Reads. */
export function compareRootStyle(state: CompareState): Record<string, string> {
  const style: Record<string, string> = { position: "relative", overflow: "hidden", "--rv-compare-position": pct(comparePosition(state)) };
  if (state.dragAnywhere) style["touch-action"] = state.orientation === "vertical" ? "pan-x" : "pan-y";
  return style;
}

/** Inline style of the "after" layer: on top of the "before" layer, clipped to the end side of the divider. Reads. */
export function compareAfterStyle(state: CompareState): Record<string, string> {
  const p = pct(comparePosition(state));
  const inset = state.orientation === "vertical" ? `inset(${p} 0 0 0)` : state.direction === "rtl" ? `inset(0 ${p} 0 0)` : `inset(0 0 0 ${p})`;
  return { position: "absolute", inset: "0", "clip-path": inset, "-webkit-clip-path": inset };
}

/** Inline style of the handle: centred on the divider across the whole cross axis, no browser gestures. Reads. */
export function compareHandleStyle(state: CompareState): Record<string, string> {
  const p = pct(comparePosition(state));
  if (state.orientation === "vertical") return { position: "absolute", left: "0", right: "0", top: p, transform: "translateY(-50%)", "touch-action": "none" };
  return state.direction === "rtl"
    ? { position: "absolute", top: "0", bottom: "0", right: p, transform: "translateX(50%)", "touch-action": "none" }
    : { position: "absolute", top: "0", bottom: "0", left: p, transform: "translateX(-50%)", "touch-action": "none" };
}

// Runtime -----------------------------------------------------------------------------------------

interface CompareRuntime {
  motion: Motion1DType | undefined;
  drag: { id: number; offset: number; rect: DOMRect; root: HTMLElement; detach: () => void } | null;
}

const runtimes = new WeakMap<object, CompareRuntime>();
const runtimeOf = (state: CompareState): CompareRuntime => {
  let rt = runtimes.get(state);
  if (!rt) runtimes.set(state, (rt = { motion: undefined, drag: null }));
  return rt;
};

const reducedMotion = (el: Element | null | undefined): boolean => {
  const view = el?.ownerDocument?.defaultView ?? (typeof window === "undefined" ? undefined : window);
  return !!view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
};

/** The root element of a compare part. */
export const compareRootOf = (el: Element | null | undefined): HTMLElement | null => (el?.closest("[data-rv-compare]") as HTMLElement | null) ?? null;

/** The value (percent) at a pointer position over `rect` (`raw`: not clamped to 0–100). */
export function compareValueAt(
  state: CompareState,
  rect: { left: number; top: number; right: number; width: number; height: number },
  x: number,
  y: number,
  raw = false,
): number {
  const size = state.orientation === "vertical" ? rect.height : rect.width;
  if (!size) return 0;
  const along = state.orientation === "vertical" ? y - rect.top : state.direction === "rtl" ? rect.right - x : x - rect.left;
  const value = (along / size) * 100;
  return raw ? value : clamp(value);
}

/**
 * Moves the divider to `value` (percent, clamped): commits it (`onChange` when it differs) and moves the rendered
 * position — `"animate"`: the settle motion glides there (jumps without animation / under reduced motion); `"follow"`
 * (a drag): 1:1, except that a settle still running is retargeted (no visual jump); `"jump"`: at once.
 */
export function compareSetValue(state: CompareState, value: number, mode: "animate" | "follow" | "jump" = "jump", el?: Element | null): void {
  const next = round2(clamp(value));
  const from = untrack(() => comparePosition(state));
  setControlledValue(state.value, next);
  const rt = runtimeOf(state);
  const moving = untrack(state.position) !== null;
  const still = !state.duration || reducedMotion(el);
  if (mode === "follow" && moving && rt.motion && !still) return rt.motion.to(next);
  if (mode !== "animate" || still) {
    if (moving) {
      rt.motion?.stop();
      state.position.set(null);
    }
    return;
  }
  if (Math.abs(from - next) < 0.001 && !moving) return;
  const motion = (rt.motion ??= Motion1D({
    value: from,
    duration: state.duration,
    friction: state.friction,
    render: (v) => state.position.set(v),
    onSettle: () => state.position.set(null),
  }));
  if (!moving) motion.to(from, true);
  state.position.set(from);
  motion.to(next);
}

const end = (state: CompareState): void => state.onChangeEnd?.(controlledValue(state.value));

/**
 * pointerdown of the handle (`fromSurface` false) or the root (`true`: only with `dragAnywhere`, and not when the press
 * started on the handle). Grabs the divider and follows the pointer until release.
 */
export function comparePointerDown(event: PointerEvent, state: CompareState, fromSurface: boolean): void {
  if (isCompareDisabled(state)) return;
  if (event.button !== 0 || event.ctrlKey) return;
  const target = event.target as Element | null;
  if (fromSurface && (!state.dragAnywhere || target?.closest?.("[data-rv-compare-handle]"))) return;
  const root = compareRootOf(event.currentTarget as Element);
  if (!root) return;
  const rt = runtimeOf(state);
  if (rt.drag) return;
  noteModality(event);
  event.preventDefault();
  const handle = root.querySelector<HTMLElement>("[data-rv-compare-handle]");
  handle?.focus({ preventScroll: true });
  const rect = root.getBoundingClientRect();
  const at = compareValueAt(state, rect, event.clientX, event.clientY);
  let offset = 0;
  if (fromSurface) compareSetValue(state, at, "animate", root);
  else offset = untrack(() => compareValue(state)) - at;
  const win = root.ownerDocument.defaultView ?? window;
  const id = event.pointerId;
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== id || !rt.drag) return;
    // No unmount hook (a cleanup effect would boot a resumed page at load): a drag whose root left the document ends here.
    if (!root.isConnected) return compareDispose(state);
    compareSetValue(state, compareValueAt(state, rt.drag.rect, e.clientX, e.clientY, true) + rt.drag.offset, "follow", root);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    compareDragEnd(state);
  };
  win.addEventListener("pointermove", onMove);
  win.addEventListener("pointerup", onUp);
  win.addEventListener("pointercancel", onUp);
  rt.drag = {
    id,
    offset,
    rect,
    root,
    detach: () => {
      win.removeEventListener("pointermove", onMove);
      win.removeEventListener("pointerup", onUp);
      win.removeEventListener("pointercancel", onUp);
    },
  };
  disableTextSelection(root);
  state.dragging.set(true);
}

/** Ends a drag (pointer up / cancel; a move after the root left the document): listeners off, text selection restored, `onChangeEnd`. */
export function compareDragEnd(state: CompareState): void {
  const rt = runtimes.get(state);
  const drag = rt?.drag;
  if (!rt || !drag) return;
  rt.drag = null;
  drag.detach();
  restoreTextSelection(drag.root);
  state.dragging.set(false);
  end(state);
}

/** keydown of the handle (ARIA slider keys, see the header). */
export function compareKeyDown(event: KeyboardEvent, state: CompareState): void {
  if (isCompareDisabled(state)) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const vertical = state.orientation === "vertical";
  const rtl = state.direction === "rtl" && !vertical;
  const small = event.shiftKey ? state.pageStep : state.step;
  const current = untrack(() => compareValue(state));
  let next: number;
  switch (event.key) {
    case "ArrowRight":
      next = current + (rtl ? -small : small);
      break;
    case "ArrowLeft":
      next = current + (rtl ? small : -small);
      break;
    case "ArrowUp":
      next = current + (vertical ? -small : small);
      break;
    case "ArrowDown":
      next = current + (vertical ? small : -small);
      break;
    case "PageUp":
      next = current + (vertical ? -state.pageStep : state.pageStep);
      break;
    case "PageDown":
      next = current + (vertical ? state.pageStep : -state.pageStep);
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = 100;
      break;
    default:
      return;
  }
  event.preventDefault();
  noteModality(event);
  if (event.key !== "Home" && event.key !== "End") {
    // Keyed values land on the `step` grid (a dragged 50.37 + 1 → 51, + 10 → 60).
    const step = state.step;
    next = next > current ? Math.floor(next / step + 1e-9) * step : Math.ceil(next / step - 1e-9) * step;
  }
  if (round2(clamp(next)) === current) return;
  compareSetValue(state, next, "animate", event.currentTarget as Element);
  end(state);
}

/** Stops the motion and any drag. The parts register no unmount hook (a cleanup effect would boot a resumed page at load); a drag whose root left the document ends on its next move. */
export function compareDispose(state: CompareState): void {
  compareDragEnd(state);
  const rt = runtimes.get(state);
  rt?.motion?.stop();
  if (untrack(state.position) !== null) state.position.set(null);
}
