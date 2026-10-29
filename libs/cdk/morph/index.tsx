// Rivet-authored (no upstream): morphing surface behaviour — a collapsed in-flow element (a "bag" pill, a button) whose
// surface grows into a panel and back. Feature set (footprint = the collapsed size, auto-measured collapsed / expanded
// targets, eight logical directions, controlled `isOpen` / `onOpenChange`, `isDisabled`, animation off switch, content
// cross-fade + scale) scoped from public docs of commercial UI kits (React Native); independent web implementation.
// Motion = the house motion `@rivetjs/cdk/motion` (embla-carousel 8.6.0 physics, MIT, © David Jerleke; user decision
// 2026-10-08: no CSS transitions / hand-rolled easing in components that adopt it).
//
// DOM contract (the styled layer renders it; `@rivetjs/ui/morph`):
//   root `[data-morph-root]` (in flow, sized by the collapsed content; `data-open` while open; `data-morphing` while a
//   morph runs; `data-animation="disabled"` turns motion off)
//   ├ collapsed `[data-morph-collapsed]` (in flow; holds the `[data-morph-trigger]` button)
//   └ surface `[data-morph-surface]` (absolutely positioned, anchored on the side opposite to the growth direction; closed:
//     the root's box) └ panel `[data-morph-expanded]` (natural size; in flow inside the surface when open at rest,
//     absolutely anchored while morphing)
// - One progress value p (0 = collapsed, 1 = expanded) on `Motion1D`; every frame writes only inline styles (surface
//   `width` / `height` / `border-radius` and `--morph-progress` on the root, which the stylesheet turns into the content
//   cross-fade / scale / stagger). Measurements happen once when a morph starts from rest (root box, panel box, two radius
//   variables), never inside the frame loop: no layout thrash. Retargeting mid-morph keeps the velocity (interruptible).
// - At rest every inline style is removed again: the stylesheet's open / closed state matches the measured end boxes, so a
//   server-rendered `defaultOpen` page and a settled page look the same with no script.
// - Radii: `--morph-collapsed-radius` (clamped to half the collapsed box, a pill) and `--morph-expanded-radius` on the root.
// - Reduced motion (`prefers-reduced-motion: reduce`) or `data-animation="disabled"`: every morph jumps.
// - Focus / dismiss (`openMorph` / `closeMorph`): opening moves focus into the panel (`[data-morph-autofocus]`, else the
//   first tabbable, else the panel) on the next frame; Escape, a pointer press outside the root and focus leaving the root
//   close it; closing returns focus to the trigger when focus was inside the root (or lost to the body).
import { type Signal } from "@rivetjs/reactivity";
import { tabbables } from "../a11y/index.ts";
import { controllable, controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { Motion1D, type Motion1DType } from "../motion/index.ts";

/** Logical direction the surface grows toward (`start` / `end` mirror in RTL). */
export type MorphDirection = "top" | "top-end" | "end" | "bottom-end" | "bottom" | "bottom-start" | "start" | "top-start";

export interface MorphStateProps {
  /** Whether the surface is expanded (controlled): a plain value, a two-way Signal or an accessor. */
  isOpen?: boolean | Signal<boolean> | (() => boolean);
  /** Initial expanded state (uncontrolled). @default false */
  defaultOpen?: boolean;
  /** Called when the open state changes. */
  onOpenChange?: (isOpen: boolean) => void;
  /** Whether opening is disabled. */
  isDisabled?: boolean;
}

export interface MorphState {
  /** The open state (read `state.open.value()` in bindings). */
  readonly open: ControlledState<boolean>;
  readonly isDisabled: boolean;
}

/** Morph open state (react-stately `useControlledState` semantics through `controllable`). */
export function createMorphState(props: MorphStateProps = {}): MorphState {
  return { open: controllable<boolean>(props.isOpen, props.defaultOpen ?? false, props.onOpenChange), isDisabled: props.isDisabled === true };
}

/** Whether the morph is open (tracked read). */
export const isMorphOpen = (state: MorphState): boolean => state.open.value();

export interface MorphMotionOptions {
  /** Base duration (embla `duration`, fixed 60 Hz steps; lower = stiffer). @default 10 */
  duration?: number;
  /** Base friction (embla; lower = less damping). @default 0.6 */
  friction?: number;
}

// Defaults: embla's update rule `v = f·(v + Δ/d)` is a damped spring; d = 10, f = 0.6 gives a slightly under-damped
// response (|λ| = √f ≈ 0.77 per 60 Hz step: visually settled in ~300 ms, < 1 % overshoot), the feel of the MorphButton
// spring in commercial UI kits' public docs (damping 25, stiffness 300, mass 0.8 ≈ ζ 0.8). Embla's carousel default (25 / 0.68)
// is over-damped and tails for ~1 s on a box this size.
/** Default morph duration (embla units). */
export const MORPH_DURATION = 10;
/** Default morph friction. */
export const MORPH_FRICTION = 0.6;

interface Box {
  w: number;
  h: number;
  r: number;
}

interface MorphController {
  motion: Motion1DType;
  /** 0 or 1. */
  target: number;
  from: Box;
  to: Box;
  morphing: boolean;
  onSettle: (() => void) | undefined;
}

const controllers = new WeakMap<Element, MorphController>();
const dismissers = new WeakMap<Element, () => void>();

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function parts(root: HTMLElement): { surface: HTMLElement | null; panel: HTMLElement | null } {
  const surface = root.querySelector<HTMLElement>("[data-morph-surface]");
  return { surface, panel: surface?.querySelector<HTMLElement>("[data-morph-expanded]") ?? null };
}

function cssPx(style: CSSStyleDeclaration, name: string, fallback: number): number {
  const value = parseFloat(style.getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

/** Collapsed (root) and expanded (panel) boxes, read once per morph from rest. */
function measure(root: HTMLElement, panel: HTMLElement): { from: Box; to: Box } {
  const style = getComputedStyle(root);
  const w0 = root.offsetWidth;
  const h0 = root.offsetHeight;
  const r0 = Math.min(cssPx(style, "--morph-collapsed-radius", 9999), Math.min(w0, h0) / 2);
  const w1 = panel.offsetWidth;
  const h1 = panel.offsetHeight;
  const r1 = Math.min(cssPx(style, "--morph-expanded-radius", 24), Math.min(w1, h1) / 2);
  return { from: { w: w0, h: h0, r: r0 }, to: { w: w1, h: h1, r: r1 } };
}

/** Whether morphs on `root` jump (reduced motion or `data-animation="disabled"`). */
export function morphReducesMotion(root: Element): boolean {
  if ((root as HTMLElement).dataset?.animation === "disabled") return true;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clear(root: HTMLElement, surface: HTMLElement): void {
  root.removeAttribute("data-morphing");
  root.style.removeProperty("--morph-progress");
  surface.style.removeProperty("width");
  surface.style.removeProperty("height");
  surface.style.removeProperty("border-radius");
}

/**
 * Morphs `root` to its open (`true`) or collapsed state. Idempotent per target; a call mid-morph retargets the running
 * motion (velocity kept). `onSettle` runs once the surface rests at the new target (also when jumping).
 */
export function morphTo(root: HTMLElement, open: boolean, options: MorphMotionOptions & { jump?: boolean; onSettle?: () => void } = {}): void {
  const { surface, panel } = parts(root);
  if (!surface || !panel) return;
  const target = open ? 1 : 0;
  let ctl = controllers.get(root);
  if (ctl && ctl.target === target) {
    // Already heading there (or resting there): keep going.
    if (ctl.morphing) {
      if (options.onSettle) ctl.onSettle = options.onSettle;
    } else options.onSettle?.();
    return;
  }
  const jump = options.jump === true || morphReducesMotion(root);
  if (!ctl || !ctl.morphing) {
    // From rest (at the other state): measure both boxes before the first write.
    const boxes = measure(root, panel);
    const start = 1 - target;
    if (!ctl) {
      const self: MorphController = {
        motion: undefined as never,
        target,
        from: boxes.from,
        to: boxes.to,
        morphing: false,
        onSettle: undefined,
      };
      self.motion = Motion1D({
        value: start,
        duration: options.duration ?? MORPH_DURATION,
        friction: options.friction ?? MORPH_FRICTION,
        render: (p) => {
          if (!self.morphing) return;
          surface.style.width = `${lerp(self.from.w, self.to.w, p)}px`;
          surface.style.height = `${lerp(self.from.h, self.to.h, p)}px`;
          surface.style.borderRadius = `${Math.max(0, lerp(self.from.r, self.to.r, p))}px`;
          root.style.setProperty("--morph-progress", String(Math.round(p * 1e4) / 1e4));
        },
        onSettle: () => {
          self.morphing = false;
          clear(root, surface);
          const done = self.onSettle;
          self.onSettle = undefined;
          done?.();
        },
      });
      controllers.set(root, self);
      ctl = self;
    } else {
      ctl.from = boxes.from;
      ctl.to = boxes.to;
    }
  }
  ctl.target = target;
  ctl.onSettle = options.onSettle;
  ctl.morphing = true;
  root.setAttribute("data-morphing", "");
  // Paint the start frame synchronously so the stylesheet switch (data-open) never shows a jump.
  const p = ctl.motion.get();
  surface.style.width = `${lerp(ctl.from.w, ctl.to.w, p)}px`;
  surface.style.height = `${lerp(ctl.from.h, ctl.to.h, p)}px`;
  surface.style.borderRadius = `${Math.max(0, lerp(ctl.from.r, ctl.to.r, p))}px`;
  root.style.setProperty("--morph-progress", String(p));
  if (jump) {
    ctl.motion.to(target, true);
    if (ctl.morphing) {
      ctl.morphing = false;
      clear(root, surface);
      const done = ctl.onSettle;
      ctl.onSettle = undefined;
      done?.();
    }
    return;
  }
  ctl.motion.to(target);
}

/** Whether a morph is running on `root`. */
export const isMorphing = (root: Element): boolean => controllers.get(root)?.morphing === true || rectControllers.get(root)?.morphing === true;

// ---------------------------------------------------------------------------------------------
// Rect mode: a fixed-position surface (in the overlay layer) morphs between an external rect (a list row, a card)
// and its own resting box. Same motion, defaults, interruption and reduced-motion rules as `morphTo`.
// ---------------------------------------------------------------------------------------------

/** A viewport rect + corner radius (px). */
export interface MorphRect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export interface MorphRectOptions extends MorphMotionOptions {
  /** The collapsed rect (p = 0), e.g. the source row's `getBoundingClientRect()`; read when a morph starts from rest. */
  from: () => MorphRect;
  /** The expanded rect (p = 1): where the surface rests open; read when a morph starts from rest. */
  to: () => MorphRect;
  /** Element whose inline `opacity` follows the progress (a dimming backdrop). */
  backdrop?: HTMLElement | null;
  /** Jump (no motion). Reduced motion / `data-animation="disabled"` on the surface jump too. */
  jump?: boolean;
  /** Runs once the surface rests at the new target. */
  onSettle?: () => void;
}

interface RectController {
  motion: Motion1DType;
  target: number;
  from: MorphRect;
  to: MorphRect;
  morphing: boolean;
  backdrop: HTMLElement | null;
  onSettle: (() => void) | undefined;
}

const rectControllers = new WeakMap<Element, RectController>();

function paintRect(surface: HTMLElement, ctl: RectController, p: number): void {
  const { from, to } = ctl;
  const s = surface.style;
  s.left = `${lerp(from.x, to.x, p)}px`;
  s.top = `${lerp(from.y, to.y, p)}px`;
  s.width = `${lerp(from.w, to.w, p)}px`;
  s.height = `${lerp(from.h, to.h, p)}px`;
  s.borderRadius = `${Math.max(0, lerp(from.r, to.r, p))}px`;
  const progress = String(Math.round(p * 1e4) / 1e4);
  s.setProperty("--morph-progress", progress);
  if (ctl.backdrop) ctl.backdrop.style.opacity = String(Math.min(1, Math.max(0, p)));
}

/** Settle: open = the surface keeps its resting position (left / top) and sizes itself; closed = no inline geometry. */
function restRect(surface: HTMLElement, ctl: RectController): void {
  const s = surface.style;
  surface.removeAttribute("data-morphing");
  s.removeProperty("width");
  s.removeProperty("height");
  s.removeProperty("border-radius");
  s.removeProperty("--morph-progress");
  if (ctl.target === 1) {
    s.left = `${ctl.to.x}px`;
    s.top = `${ctl.to.y}px`;
    if (ctl.backdrop) ctl.backdrop.style.opacity = "1";
  } else {
    s.removeProperty("left");
    s.removeProperty("top");
    if (ctl.backdrop) ctl.backdrop.style.opacity = "0";
  }
}

/**
 * Morphs a fixed-position `surface` between `from` (closed, p = 0) and `to` (open, p = 1): every frame writes the
 * surface's inline `left` / `top` / `width` / `height` / `border-radius`, `--morph-progress` on it and the backdrop's
 * `opacity` (no reads in the loop). Both rects are read once when a morph starts from rest; a call mid-morph retargets
 * the running motion (velocity kept, no re-measure). The caller keeps the surface `position: fixed` and clips it
 * (`overflow: hidden`).
 */
export function morphRectTo(surface: HTMLElement, open: boolean, options: MorphRectOptions): void {
  const target = open ? 1 : 0;
  let ctl = rectControllers.get(surface);
  if (ctl && ctl.target === target) {
    if (ctl.morphing) {
      if (options.onSettle) ctl.onSettle = options.onSettle;
    } else options.onSettle?.();
    return;
  }
  const jump = options.jump === true || morphReducesMotion(surface);
  if (!ctl || !ctl.morphing) {
    const from = options.from();
    const to = options.to();
    if (!ctl) {
      const self: RectController = { motion: undefined as never, target, from, to, morphing: false, backdrop: options.backdrop ?? null, onSettle: undefined };
      self.motion = Motion1D({
        value: 1 - target,
        duration: options.duration ?? MORPH_DURATION,
        friction: options.friction ?? MORPH_FRICTION,
        render: (p) => {
          if (self.morphing) paintRect(surface, self, p);
        },
        onSettle: () => {
          if (!self.morphing) return;
          self.morphing = false;
          restRect(surface, self);
          const done = self.onSettle;
          self.onSettle = undefined;
          done?.();
        },
      });
      rectControllers.set(surface, self);
      ctl = self;
    } else {
      ctl.from = from;
      ctl.to = to;
      ctl.backdrop = options.backdrop ?? ctl.backdrop;
    }
  }
  ctl.target = target;
  ctl.onSettle = options.onSettle;
  ctl.morphing = true;
  surface.setAttribute("data-morphing", "");
  paintRect(surface, ctl, ctl.motion.get());
  if (jump) {
    ctl.motion.to(target, true);
    if (ctl.morphing) {
      ctl.morphing = false;
      restRect(surface, ctl);
      const done = ctl.onSettle;
      ctl.onSettle = undefined;
      done?.();
    }
    return;
  }
  ctl.motion.to(target);
}

/** Current progress of a rect morph (0 closed … 1 open), or `undefined` when `surface` never morphed. */
export const morphRectProgress = (surface: Element): number | undefined => rectControllers.get(surface)?.motion.get();

function focusPanel(panel: HTMLElement): void {
  const first = panel.querySelector<HTMLElement>("[data-morph-autofocus]") ?? tabbables(panel)[0] ?? panel;
  first.focus({ preventScroll: true });
}

function trigger(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>("[data-morph-trigger]");
}

/** Finds the morph root an event / element belongs to. */
export const morphRootOf = (el: EventTarget | null | undefined): HTMLElement | null =>
  el instanceof Element ? (el.closest("[data-morph-root]") as HTMLElement | null) : null;

/** Escape / outside press / focus leaving the root → `close(restoreFocus)`. Returns the remover. */
function installDismiss(root: HTMLElement, close: (restoreFocus: boolean) => void): () => void {
  const doc = root.ownerDocument;
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    close(true);
  };
  const onDown = (e: PointerEvent): void => {
    const t = e.target as Node | null;
    if (t && root.contains(t)) return;
    close(true);
  };
  const onFocusOut = (e: FocusEvent): void => {
    const next = e.relatedTarget as Node | null;
    // Focus went elsewhere on purpose (Tab, a click on a focusable element): close without pulling it back.
    if (next && !root.contains(next)) close(false);
  };
  doc.addEventListener("keydown", onKey, true);
  doc.addEventListener("pointerdown", onDown, true);
  root.addEventListener("focusout", onFocusOut);
  return () => {
    doc.removeEventListener("keydown", onKey, true);
    doc.removeEventListener("pointerdown", onDown, true);
    root.removeEventListener("focusout", onFocusOut);
  };
}

/** Sets the open state and morphs `root` (when given) with focus + dismiss handling. */
export function setMorphOpen(state: MorphState, open: boolean, root?: HTMLElement | null, motion?: MorphMotionOptions, restoreFocus = true): void {
  if (open && state.isDisabled) return;
  setControlledValue(state.open, open);
  // A read-only controlled value (plain / accessor) changes only when the caller says so: its follower effect syncs.
  if (root && (!state.open.isControlled || state.open.isSignal)) syncMorph(state, root, open, motion, restoreFocus);
}

/** Opens the morph (`root` = the morph root or any element inside it). */
export const openMorph = (state: MorphState, el?: EventTarget | null, motion?: MorphMotionOptions): void => setMorphOpen(state, true, morphRootOf(el), motion);
/** Closes the morph. */
export const closeMorph = (state: MorphState, el?: EventTarget | null, motion?: MorphMotionOptions): void =>
  setMorphOpen(state, false, morphRootOf(el), motion);
/** Toggles the morph. */
export const toggleMorph = (state: MorphState, el?: EventTarget | null, motion?: MorphMotionOptions): void =>
  setMorphOpen(state, !controlledValue(state.open), morphRootOf(el), motion);

/**
 * Morphs `root` to `open` and wires focus + dismissal: opening installs Escape / outside-press / focus-out listeners
 * (they call `setMorphOpen(state, false, root)`), moves focus into the panel; closing removes them and returns focus to the
 * trigger. Safe to call repeatedly (controlled state followers call it from an effect).
 */
export function syncMorph(state: MorphState, root: HTMLElement, open: boolean, motion?: MorphMotionOptions, restoreFocus = true): void {
  const { panel } = parts(root);
  if (!panel) return;
  const ctl = controllers.get(root);
  const current = ctl ? ctl.target === 1 : root.hasAttribute("data-open");
  if (current === open) return;
  const collapsed = root.querySelector<HTMLElement>("[data-morph-collapsed]");
  const button = trigger(root);
  if (open) {
    root.setAttribute("data-open", "");
    panel.inert = false;
    if (collapsed) collapsed.inert = true;
    button?.setAttribute("aria-expanded", "true");
    if (!dismissers.has(root))
      dismissers.set(
        root,
        installDismiss(root, (restore) => setMorphOpen(state, false, root, motion, restore)),
      );
    morphTo(root, true, motion);
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (f: () => void) => setTimeout(f, 0);
    raf(() => {
      if (root.hasAttribute("data-open")) focusPanel(panel);
    });
  } else {
    dismissers.get(root)?.();
    dismissers.delete(root);
    const active = root.ownerDocument.activeElement;
    const wasInside = restoreFocus && (!active || active === root.ownerDocument.body || root.contains(active));
    root.removeAttribute("data-open");
    panel.inert = true;
    if (collapsed) collapsed.inert = false;
    button?.setAttribute("aria-expanded", "false");
    morphTo(root, false, motion);
    if (wasInside) button?.focus({ preventScroll: true });
  }
}
