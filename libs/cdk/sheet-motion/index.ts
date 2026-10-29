// Rivet-authored (no upstream): drag-to-dismiss + snap points for an edge-attached sheet, on the house motion
// `@rivetjs/cdk/motion` (embla-carousel 8.6.0 physics, MIT, © David Jerleke; user decision 2026-10-08: no hand-rolled
// physics / JS easing). Feature set (snap points, close threshold, sequential snapping, handle-only drags, backdrop fade
// from a snap index) scoped from public docs of commercial UI kits; independent implementation. Generalises the Sidebar's
// mobile sheet swipe (`../sidebar/sheet-motion.ts`) to four placements, so the Sidebar can adopt it later.
// - Units: `offset` = px the sheet is pushed towards its closed edge: 0 = fully shown, `size` (its own extent along the
//   axis) = off-screen. Rendered as an inline `transform: translate{X|Y}(…)` (an overlay's CSS enter / exit animates
//   the separate `translate` property: the two compose).
// - Snap points: numbers 0…1 = fraction of the viewport along the axis, or CSS lengths (`"148px"`, `"20rem"`, `"50dvh"`,
//   `"40%"` of the viewport); offset of a point = `size - visible` clamped to 0…size (a point ≥ the sheet's size = fully
//   shown). `snapPointTransform()` gives the same position as a CSS expression for the first render (no measurement).
// - Drag: a move must go `AXIS_LOCK` px, more along the axis than across, before the drag starts (cross moves scroll /
//   pan); a start inside a scroll container that can still scroll in the drag direction scrolls it instead (closing
//   direction: always; opening direction: once the sheet is fully expanded). Past the drag limits the sheet follows
//   at `RUBBER_BAND` of the pointer. A started drag dispatches a synthetic `pointercancel` on the press target (the
//   browser does the same when it starts a pan; our own window listener ignores it) and swallows the next click.
// - Release: `VelocityTracker` flick force × `DragRelease.forceBoost` (snap 300 mouse / 400 touch) projects the throw.
//   Without snap points: dismiss when the projection passes `closeThreshold` × size, else settle back open. With snap
//   points: dismiss when it passes the lowest point + `closeThreshold` × the remaining distance, else the nearest point
//   (`sequential`: at most one point from where the drag started). Settle duration / friction = `DragRelease.settle`.
//   A dismiss animates off-screen, then `close()` runs on settle. `prefers-reduced-motion: reduce` or `reduceMotion()`
//   → every release / `snapTo` jumps.
import { DragRelease, Motion1D, VelocityTracker } from "../motion/index.ts";

export type SheetPlacement = "top" | "bottom" | "left" | "right";
/** A snap point: a fraction (0…1) of the viewport along the sheet's axis, or a CSS length (`px`, `rem`, `em`, `vh` / `dvh` / `svh` / `lvh`, `vw` / `dvw` / `svw` / `lvw`, `%` of the viewport). */
export type SheetSnapPoint = number | string;

/** Pixels a pointer moves before a drag is decided. */
export const SHEET_AXIS_LOCK = 6;
/** Pointer-to-sheet ratio past the drag limits. */
export const SHEET_RUBBER_BAND = 0.2;
/** Default dismiss threshold (fraction of the remaining distance to the closed edge). */
export const SHEET_CLOSE_THRESHOLD = 0.25;
const BASE_FRICTION = 0.68;
/** Elements a drag never starts from (text entry). */
const NO_DRAG = "input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-sheet-no-drag]";

export interface SheetMotionOptions {
  /** The edge the sheet is attached to. @default "bottom" */
  placement?: SheetPlacement;
  /** Closes the sheet (called once a dismiss has animated off-screen). */
  close: () => void;
  /** Whether a drag may dismiss the sheet. @default true */
  dismissible?: boolean;
  /** Snap points, smallest first. */
  snapPoints?: readonly SheetSnapPoint[];
  /** The snap point index the sheet rests at when attached (read once). @default 0 */
  activeSnapIndex?: number;
  /** A release landed on a snap point (called on release, before the settle animation). */
  onSnap?: (index: number) => void;
  /** Dismiss threshold. @default 0.25 */
  closeThreshold?: number;
  /** Snap to the neighbouring point only (never skip points). @default false */
  sequential?: boolean;
  /** Only drags that start inside an element matching this selector move the sheet (e.g. `[data-slot="sheet-handle"]`). */
  handle?: string;
  /** The backdrop: its `--sheet-backdrop-opacity` variable (0…1) follows the drag (style it: `opacity: var(--sheet-backdrop-opacity, 1)`; removed again at rest without snap points). */
  backdrop?: HTMLElement | null;
  /** With snap points: the index from which the backdrop is fully opaque (fades in between the previous point and it). @default the last index */
  fadeFromIndex?: number;
  /** Every drag frame: the pointer event and the dragged fraction (`offset / size`, 0 = fully shown). */
  onDrag?: (event: PointerEvent, percentageDragged: number) => void;
  /** Pointer released after a drag: whether the sheet stays open. */
  onRelease?: (event: PointerEvent, open: boolean) => void;
  /** Every rendered frame: the shown fraction (1 = fully shown, 0 = off-screen); drives background scaling / nesting. */
  onProgress?: (shown: number) => void;
  /** A drag / snap / dismiss animation settled (`open`: the sheet rests open). */
  onSettle?: (open: boolean) => void;
  /** Turns off the animations (on top of `prefers-reduced-motion`). */
  reduceMotion?: () => boolean;
  /** `touch-action` set inline on the sheet (behaviour-critical) while attached. @default "none" (vertical), "pan-y" (horizontal); with `handle`: unchanged */
  touchAction?: string;
  /**
   * Overdrag bleed: while the sheet is dragged past fully shown (rubber band), a child `[data-sheet-bleed]` with the
   * sheet's background (`background: inherit`) fills the space between its attached edge and the viewport edge, so the
   * surface stays attached (vaul's `::after`). Off for a sheet that floats away from the edge (detached).
   * @default true
   */
  bleed?: boolean;
}

export interface SheetMotionController {
  /** Animates (or `jump`s) to snap point `index` (-1 = fully shown when there are no snap points). */
  snapTo: (index: number, jump?: boolean) => void;
  /** Animates the sheet off-screen and calls `close()` when it settles. */
  dismiss: () => void;
  /** The current offset (px towards the closed edge). */
  offset: () => number;
  /** The snap point index the sheet rests at / animates to (-1 without snap points). */
  index: () => number;
  /** Removes the listeners and stops the motion (inline styles stay when dismissed, so an exit animation continues from there). */
  destroy: () => void;
}

const LENGTH = /^(-?\d*\.?\d+)(px|rem|em|vh|dvh|svh|lvh|vw|dvw|svw|lvw|%)?$/;

/** Visible size (px) of a snap point on a sheet whose axis is `vertical`, in a `width` × `height` viewport (`rem` / `em` from `rootFontSize`). */
export function snapPointSize(point: SheetSnapPoint, viewport: { width: number; height: number }, vertical: boolean, rootFontSize = 16): number {
  const along = vertical ? viewport.height : viewport.width;
  if (typeof point === "number") return point <= 1 ? point * along : point;
  const match = LENGTH.exec(point.trim());
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === undefined || unit === "px") return value;
  if (unit === "rem" || unit === "em") return value * rootFontSize;
  if (unit === "%") return (value / 100) * along;
  return (value / 100) * (unit.endsWith("h") ? viewport.height : viewport.width);
}

/** Whether the axis of `placement` is vertical. */
export const isVerticalSheet = (placement: SheetPlacement): boolean => placement === "top" || placement === "bottom";

/**
 * The resting `transform` of a sheet at snap point `point` as a CSS expression (first render, before any measurement):
 * `translateY(max(0px, calc(100% - 50dvh)))` for a bottom sheet at `0.5`. `undefined` when there is no point.
 */
export function snapPointTransform(placement: SheetPlacement, point: SheetSnapPoint | undefined): string | undefined {
  if (point === undefined) return undefined;
  const vertical = isVerticalSheet(placement);
  const visible =
    typeof point === "number"
      ? point <= 1
        ? `${+(point * 100).toFixed(4)}${vertical ? "dvh" : "dvw"}`
        : `${point}px`
      : point.endsWith("%")
        ? `${parseFloat(point)}${vertical ? "dvh" : "dvw"}`
        : point;
  const sign = placement === "bottom" || placement === "right" ? "" : "-1 * ";
  const offset = `max(0px, calc(100% - ${visible}))`;
  return `translate${vertical ? "Y" : "X"}(${sign ? `calc(${sign}${offset})` : offset})`;
}

/** Backdrop opacity at `offset` for snap offsets `offsets` (descending visibility order = ascending index) and `fadeFrom`. */
export function sheetBackdropOpacity(offset: number, size: number, offsets: readonly number[], fadeFrom: number): number {
  if (!offsets.length) return size ? Math.max(0, Math.min(1, 1 - offset / size)) : 1;
  const index = Math.max(0, Math.min(offsets.length - 1, fadeFrom));
  const full = offsets[index]!;
  const none = index === 0 ? size : offsets[index - 1]!;
  if (offset <= full) return 1;
  if (offset >= none || none === full) return 0;
  return 1 - (offset - full) / (none - full);
}

/** Where the sheet goes for an undamped pointer offset `raw`: `raw` within `limits`, `SHEET_RUBBER_BAND` of the overshoot past them. */
export function rubberBand(raw: number, limits: readonly [number, number]): number {
  const [min, max] = limits;
  if (raw < min) return min - (min - raw) * SHEET_RUBBER_BAND;
  if (raw > max) return max + (raw - max) * SHEET_RUBBER_BAND;
  return raw;
}

/** Attaches drag / snap motion to an open sheet element; returns its controller. */
export function sheetMotion(sheet: HTMLElement, options: SheetMotionOptions): SheetMotionController {
  const placement = options.placement ?? "bottom";
  const { close, onSnap, onDrag, onRelease, onProgress, onSettle, reduceMotion, backdrop, handle } = options;
  const dismissible = options.dismissible ?? true;
  const points = options.snapPoints?.length ? options.snapPoints : undefined;
  const closeThreshold = options.closeThreshold ?? SHEET_CLOSE_THRESHOLD;
  const fadeFrom = options.fadeFromIndex ?? (points ? points.length - 1 : 0);
  const view = sheet.ownerDocument.defaultView!;
  const vertical = isVerticalSheet(placement);
  // Closing direction in screen coordinates: a bottom sheet closes downwards (+y).
  const sign = placement === "bottom" || placement === "right" ? 1 : -1;
  const tracker = VelocityTracker();
  const release = DragRelease(false, BASE_FRICTION);

  let size = 0;
  let offsets: number[] = [];
  let index = points ? Math.max(0, Math.min(points.length - 1, options.activeSnapIndex ?? 0)) : -1;
  let dismissing = false;

  const measure = (): void => {
    size = vertical ? sheet.offsetHeight : sheet.offsetWidth;
    if (!points) return void (offsets = []);
    const viewport = { width: view.innerWidth, height: view.innerHeight };
    const rem = parseFloat(view.getComputedStyle(sheet.ownerDocument.documentElement).fontSize) || 16;
    offsets = points.map((point) => Math.max(0, Math.min(size, size - snapPointSize(point, viewport, vertical, rem))));
  };
  const restOf = (i: number): number => (i < 0 || !offsets.length ? 0 : offsets[i]!);

  // Overdrag bleed (inline: behaviour-critical, never keyed on a class): created on the first overdrag past fully
  // shown, removed when the motion settles.
  const bleeds = options.bleed ?? true;
  let bleed: HTMLElement | null = null;
  let position: string | null = null;
  const showBleed = (): void => {
    if (bleed) return;
    bleed = sheet.ownerDocument.createElement("div");
    bleed.setAttribute("data-sheet-bleed", "");
    bleed.setAttribute("aria-hidden", "true");
    const beyond = {
      bottom: "top:100%;left:0;right:0;height:100vh",
      top: "bottom:100%;left:0;right:0;height:100vh",
      right: "left:100%;top:0;bottom:0;width:100vw",
      left: "right:100%;top:0;bottom:0;width:100vw",
    }[placement];
    bleed.style.cssText = `position:absolute;${beyond};background:inherit;pointer-events:none;`;
    if (view.getComputedStyle(sheet).position === "static") ((position = sheet.style.position), (sheet.style.position = "relative"));
    sheet.append(bleed);
  };
  const hideBleed = (): void => {
    if (!bleed) return;
    bleed.remove();
    bleed = null;
    if (position !== null) ((sheet.style.position = position), (position = null));
  };

  const render = (value: number): void => {
    const px = sign * value;
    if (value < 0 && bleeds) showBleed();
    sheet.style.transform = px || points ? `translate${vertical ? "Y" : "X"}(${px}px)` : "";
    if (points) sheet.style.setProperty("--snap-point-height", `${value}px`);
    if (backdrop && size) {
      const opacity = sheetBackdropOpacity(value, size, offsets, fadeFrom);
      if (points || value) backdrop.style.setProperty("--sheet-backdrop-opacity", String(+opacity.toFixed(4)));
      else backdrop.style.removeProperty("--sheet-backdrop-opacity");
    }
    onProgress?.(size ? Math.max(0, Math.min(1, 1 - value / size)) : 1);
  };
  const motion = Motion1D({
    value: 0,
    friction: BASE_FRICTION,
    render,
    onSettle: () => {
      sheet.removeAttribute("data-dragging");
      if (motion.target.get() >= 0) hideBleed();
      onSettle?.(!dismissing);
      if (dismissing) return close();
      sheet.style.transition = "";
      if (backdrop) backdrop.style.transition = "";
      if (!points) reset();
    },
  });
  const reset = (): void => {
    sheet.style.transform = "";
    backdrop?.style.removeProperty("--sheet-backdrop-opacity");
  };
  const reduced = (): boolean => !!reduceMotion?.() || !!view.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const animateTo = (next: number, rawForce: number): void => {
    const current = motion.target.get();
    if (reduced()) return motion.to(next, true);
    const { duration, friction } = release.settle(rawForce || next - current, next - current);
    motion.scrollBody.useDuration(duration).useFriction(friction);
    motion.target.set(next);
    motion.animation.start();
  };

  let pointer: { id: number; x: number; y: number; target: EventTarget | null; mouse: boolean; startOffset: number } | null = null;
  let dragging = false;
  let cancelling = false;
  let limits: [number, number] = [0, 0];
  let origin = 0;
  const along = (event: PointerEvent): number => sign * (vertical ? event.clientY : event.clientX);

  /** Whether a scroll container between `target` and the sheet can scroll for a finger moving `towardsClosed`. */
  const scrollsFirst = (target: Element | null, towardsClosed: boolean): boolean => {
    for (let el = target; el && el !== sheet; el = el.parentElement) {
      if (!(el instanceof HTMLElement)) continue;
      const style = view.getComputedStyle(el);
      const overflow = vertical ? style.overflowY : style.overflowX;
      if (overflow !== "auto" && overflow !== "scroll") continue;
      const pos = vertical ? el.scrollTop : Math.abs(el.scrollLeft);
      const max = vertical ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
      if (max <= 1) continue;
      // Finger towards the closed edge on a bottom / right sheet scrolls the content back to its start.
      const towardsStart = towardsClosed === (sign === 1);
      if (towardsStart ? pos > 0 : pos < max - 1) return true;
    }
    return false;
  };

  const down = (event: PointerEvent): void => {
    if (pointer || dismissing || (event.pointerType === "mouse" && event.button !== 0)) return;
    const target = event.target as Element | null;
    if (target?.closest?.(NO_DRAG)) return;
    if (handle && !target?.closest?.(handle)) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, target, mouse: event.pointerType === "mouse", startOffset: motion.target.get() };
    dragging = false;
  };
  const move = (event: PointerEvent): void => {
    if (!pointer || event.pointerId !== pointer.id) return;
    if (!dragging) {
      const dx = event.clientX - pointer.x,
        dy = event.clientY - pointer.y;
      const main = vertical ? dy : dx,
        cross = vertical ? dx : dy;
      if (Math.abs(main) < SHEET_AXIS_LOCK && Math.abs(cross) < SHEET_AXIS_LOCK) return;
      if (Math.abs(cross) >= Math.abs(main)) return void (pointer = null);
      const towardsClosed = sign * main > 0;
      measure();
      const min = offsets.length ? Math.min(...offsets) : 0;
      if (!handle && scrollsFirst(pointer.target as Element | null, towardsClosed) && (towardsClosed || motion.target.get() <= min + 0.5))
        return void (pointer = null);
      dragging = true;
      const max = dismissible ? size : offsets.length ? Math.max(...offsets) : 0;
      limits = [min, max];
      sheet.style.transition = "none";
      sheet.setAttribute("data-dragging", "true");
      if (backdrop) backdrop.style.transition = "none";
      try {
        sheet.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointers have no capture.
      }
      cancelling = true;
      try {
        pointer.target?.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: event.pointerId, pointerType: event.pointerType }));
      } finally {
        cancelling = false;
      }
      view.addEventListener("click", swallow, { capture: true, once: true });
      origin = sign * (vertical ? pointer.y : pointer.x);
      tracker.pointerDown(origin, event.timeStamp);
      motion.hold(true);
      // Grabbed mid-animation: the drag continues from where the sheet is.
      pointer.startOffset = motion.target.get();
    }
    event.preventDefault();
    const point = along(event);
    tracker.pointerMove(point, event.timeStamp);
    // `origin` = pointer position (along the closing direction) at the drag start.
    motion.drag(rubberBand(pointer.startOffset + point - origin, limits) - motion.target.get());
    onDrag?.(event, size ? Math.max(0, motion.target.get() / size) : 0);
  };
  const up = (event: PointerEvent): void => {
    if (cancelling || !pointer || event.pointerId !== pointer.id) return;
    const { mouse, startOffset } = pointer;
    pointer = null;
    if (!dragging) return;
    dragging = false;
    view.setTimeout(() => view.removeEventListener("click", swallow, { capture: true }), 0);
    const rawForce = event.type === "pointercancel" ? 0 : tracker.pointerUp(event.timeStamp) * release.forceBoost(mouse);
    const current = motion.target.get();
    const projected = current + rawForce;
    motion.hold(false);
    let next: number;
    if (!offsets.length) {
      dismissing = dismissible && projected > size * closeThreshold;
      next = dismissing ? size : 0;
    } else {
      const lowest = Math.max(...offsets);
      dismissing = dismissible && projected > lowest + (size - lowest) * closeThreshold && (!options.sequential || index === 0 || startOffset >= lowest - 0.5);
      if (dismissing) next = size;
      else {
        let target = index;
        if (options.sequential) {
          const moved = projected - startOffset;
          if (Math.abs(moved) > SHEET_AXIS_LOCK) target = Math.max(0, Math.min(offsets.length - 1, index + (moved > 0 ? -1 : 1)));
        } else {
          let best = Infinity;
          offsets.forEach((o, i) => {
            const d = Math.abs(o - projected);
            if (d < best) ((best = d), (target = i));
          });
        }
        next = offsets[target]!;
        if (target !== index) ((index = target), onSnap?.(target));
      }
    }
    onRelease?.(event, !dismissing);
    animateTo(next, rawForce);
  };
  const swallow = (event: Event): void => {
    event.stopPropagation();
    event.preventDefault();
  };

  const touchAction = sheet.style.touchAction;
  if (!handle) sheet.style.touchAction = options.touchAction ?? (vertical ? "none" : "pan-y");
  else if (options.touchAction) sheet.style.touchAction = options.touchAction;
  sheet.addEventListener("pointerdown", down);
  view.addEventListener("pointermove", move, { passive: false });
  view.addEventListener("pointerup", up);
  view.addEventListener("pointercancel", up);

  // Rest at the initial snap point in px (replaces the CSS expression of the first render).
  if (points) {
    measure();
    motion.to(restOf(index), true);
  }

  return {
    snapTo: (i: number, jump?: boolean): void => {
      if (dismissing) return;
      measure();
      if (points) index = Math.max(0, Math.min(points.length - 1, i));
      const next = restOf(points ? index : -1);
      if (jump || reduced()) motion.to(next, true);
      else animateTo(next, 0);
    },
    dismiss: (): void => {
      if (dismissing) return;
      measure();
      dismissing = true;
      animateTo(size, 0);
    },
    offset: () => motion.get(),
    index: () => index,
    destroy: (): void => {
      motion.stop();
      sheet.removeEventListener("pointerdown", down);
      view.removeEventListener("pointermove", move);
      view.removeEventListener("pointerup", up);
      view.removeEventListener("pointercancel", up);
      view.removeEventListener("click", swallow, { capture: true });
      sheet.style.touchAction = touchAction;
      sheet.removeAttribute("data-dragging");
      hideBleed();
      if (!dismissing && !points) reset();
    },
  };
}
