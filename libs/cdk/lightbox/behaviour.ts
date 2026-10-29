// Ported from yet-another-react-lightbox (src/modules/Controller/{Controller.tsx,usePointerSwipe.ts,useWheelSwipe.ts,
// usePreventWheelDefaults.ts}, src/modules/Navigation/{useKeyboardNavigation.ts,useNavigationState.ts}, v3.32.2), MIT,
// © Igor Danchenko.
// Rivet:
// - Motion = the house motion (`../motion`, embla-carousel 8.6.0 physics, MIT, © David Jerleke): the carousel track and the
//   pull offset are `Motion1D` values (YARL: FLIP keyframe animations with CSS easings). Navigation keeps the visual
//   position (the track jumps by the slide step the re-keyed slides moved) and settles to 0; swipe release / cancel and
//   pull cancel settle the same way. Reduced motion (`prefers-reduced-motion: reduce`) jumps.
// - Gesture rules are YARL's: 30 px threshold, swipe finishes past 30 % of the width or a short (< `animation.swipe`)
//   flick over 5 px, pull closes past 60 px, wheel swipe intent 30 px / 20 % finish / inertia filter, keyboard throttle
//   (navigation or swipe duration) / 2, `isSwipeValid` for finite carousels, RTL mirrored.
// - DOM-agnostic state, handlers bound by the parts (resumable inline arrows call these functions); the per-container
//   runtime (motions, pointers, timers) lives in a WeakMap keyed by the container element — never serialized.
// - Escape and focus containment / restoration belong to the cdk overlay (`ModalOverlay`); `closeLightbox` closes the
//   overlay state the root keeps in `state.overlay`.
// - Media controls: a pointer down within 40 px of the bottom of a `<video controls>` never starts a swipe (YARL: WebKit
//   only), so the scrubber works in every browser.
import { untrack } from "@rivetjs/reactivity";
import { Motion1D, type Motion1DType } from "../motion/index.ts";
import { closeOverlay } from "../state/overlays.ts";
import {
  getSlideIndex,
  lengthPx,
  lightboxNavigation,
  lightboxSlides,
  msToMotion,
  parseLength,
  round,
  setLightboxGlobalIndex,
  type LightboxState,
} from "./state.ts";

const SWIPE_THRESHOLD = 30;
const PULL_MIN_OPACITY = 0.5;
const PULL_OPACITY_THRESHOLD = 60;

interface PointerSample {
  id: number;
  x: number;
  y: number;
  target: EventTarget | null;
}

interface Controller {
  container: HTMLElement;
  /** Track offset (px, physical x). */
  x: Motion1DType;
  /** Pull offset (px). */
  y: Motion1DType;
  pointers: PointerSample[];
  active: number | undefined;
  gesture: "swipe" | "pull" | undefined;
  start: number;
  offset: number;
  base: number;
  /** Wheel swipe (YARL useWheelSwipe refs). */
  wheel: {
    offset: number;
    intent: number;
    inertia: number;
    start: number;
    swiping: boolean;
    timers: Record<string, ReturnType<typeof setTimeout> | undefined>;
  };
  lastKey: number;
  installed: boolean;
}

const controllers = new WeakMap<Element, Controller>();

/** Events a plugin handled (Zoom pans / zooms): the core swipe, wheel and arrow navigation skip them (YARL stopPropagation). */
export const lightboxHandled = new WeakSet<Event>();

const doc = (): Document | undefined => globalThis.document;

/** The lightbox container element (`<id>-container`). */
export const lightboxContainer = (state: LightboxState): HTMLElement | null => doc()?.getElementById(`${state.id}-container`) ?? null;
/** The carousel track element (`<id>-carousel`). */
export const lightboxCarousel = (state: LightboxState): HTMLElement | null => doc()?.getElementById(`${state.id}-carousel`) ?? null;

/** Whether animations jump (`prefers-reduced-motion: reduce`). */
export function lightboxReducesMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const isRTL = (el: Element): boolean => typeof getComputedStyle === "function" && getComputedStyle(el).direction === "rtl";

function render(c: Controller, state: LightboxState): void {
  const track = lightboxCarousel(state);
  // A settled motion renders its target (the last interpolated frame can stop short of it).
  const x = c.x.settled() ? c.x.target.get() : c.x.get(),
    y = c.y.settled() ? c.y.target.get() : c.y.get();
  if (track) {
    // The loop's last frame can render a hair short of the target (interpolated offset, `settled()` < 0.001) and then
    // stop: at rest = the offset and the target are both within half a pixel of the origin.
    if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && Math.abs(c.x.target.get()) < 0.5 && Math.abs(c.y.target.get()) < 0.5) track.style.removeProperty("transform");
    else track.style.transform = `translate3d(${round(x, 2)}px, ${round(y, 2)}px, 0)`;
  }
  const ctl = state.controller;
  const pull = (ctl.closeOnPullDown && y > 0) || (ctl.closeOnPullUp && y < 0) ? Math.abs(y) : 0;
  const opacity = Math.min(Math.max(round(1 - (pull / PULL_OPACITY_THRESHOLD) * (1 - PULL_MIN_OPACITY), 2), PULL_MIN_OPACITY), 1);
  if (opacity < 1) c.container.style.setProperty("--rv-lightbox-pull-opacity", String(opacity));
  else c.container.style.removeProperty("--rv-lightbox-pull-opacity");
}

/** The runtime controller of a lightbox (created on first use; `undefined` before the container exists). */
export function lightboxController(state: LightboxState): Controller | undefined {
  const container = lightboxContainer(state);
  if (!container) return undefined;
  let c = controllers.get(container);
  if (c) return c;
  const settle = () => {
    if (c && c.x.settled() && c.y.settled() && !c.gesture) untrack(() => state.gesture.set(undefined));
  };
  c = {
    container,
    x: Motion1D({ value: 0, duration: msToMotion(state.animation.swipe), render: () => render(c!, state), onSettle: settle }),
    y: Motion1D({ value: 0, duration: msToMotion(state.animation.fade), render: () => render(c!, state), onSettle: settle }),
    pointers: [],
    active: undefined,
    gesture: undefined,
    start: 0,
    offset: 0,
    base: 0,
    wheel: { offset: 0, intent: 0, inertia: 0, start: 0, swiping: false, timers: {} },
    lastKey: 0,
    installed: false,
  };
  controllers.set(container, c);
  return c;
}

/** Closes the lightbox (no-op inline). */
export function closeLightbox(state: LightboxState): void {
  if (state.overlay) closeOverlay(state.overlay);
}

/** Width of the carousel track (0 before layout). */
function trackWidth(state: LightboxState): number {
  return lightboxCarousel(state)?.clientWidth ?? lightboxContainer(state)?.clientWidth ?? 0;
}

/** Distance between two neighbouring slides in px (width + spacing). */
export function lightboxStep(state: LightboxState): number {
  const width = trackWidth(state);
  return width + lengthPx(state.carousel.spacing, width);
}

/** YARL `isSwipeValid`: a finite carousel cannot swipe past its ends (`offset` in physical px). */
function isSwipeValid(state: LightboxState, offset: number, rtl: boolean): boolean {
  if (!state.carousel.finite) return true;
  const count = lightboxSlides(state).length;
  const current = getSlideIndex(untrack(state.globalIndex), count);
  const value = (rtl ? -1 : 1) * offset;
  return !((value > 0 && current === 0) || (value < 0 && current === count - 1));
}

function animate(m: Motion1DType, value: number, ms: number): void {
  const units = lightboxReducesMotion() ? 0 : msToMotion(ms);
  if (!units) {
    m.to(value, true);
    return;
  }
  m.to(value);
  m.scrollBody.useDuration(units);
}

/**
 * Pauses media of slides that are no longer current and autoplays the current slide's `video[data-autoplay]` (YARL Video
 * plugin: pause on leave, autoplay when viewed). DOM-driven (no effect), so resumed / inline pages run nothing at load.
 */
export function syncLightboxMedia(state: LightboxState): void {
  const container = lightboxContainer(state);
  if (!container) return;
  for (const video of container.querySelectorAll<HTMLVideoElement>("[data-lightbox-slide]:not([data-current]) video")) if (!video.paused) video.pause();
  const current = container.querySelector<HTMLVideoElement>("[data-lightbox-slide][data-current] video[data-autoplay]");
  if (current && current.paused) current.play()?.catch(() => {});
}

/** After a slide change (bindings flushed): refocus the container when focus sits in a slide that moved off screen or on
 * a button that became disabled (YARL CarouselSlide `focus()` effect + `useLoseFocus`), sync media. */
function afterNavigate(state: LightboxState): void {
  queueMicrotask(() => {
    syncLightboxMedia(state);
    const container = lightboxContainer(state);
    if (container) {
      // Thumbnails: keep the current one in view (YARL ThumbnailsTrack offset animation).
      container
        .querySelector("[data-lightbox-thumbnail][data-current]")
        ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: lightboxReducesMotion() ? "auto" : "smooth" });
      // Plugins that run while active (Slideshow) listen for this.
      container.dispatchEvent(new (container.ownerDocument.defaultView ?? globalThis).CustomEvent("rv-lightbox-view"));
    }
    const active = doc()?.activeElement as HTMLElement | null | undefined;
    if (!container || !active || !container.contains(active) || active === container) return;
    const slide = active.closest("[data-lightbox-slide]");
    if ((slide && !slide.hasAttribute("data-current")) || active.matches(":disabled")) container.focus({ preventScroll: true });
  });
}

/**
 * Navigates by `increment` slides (YARL `swipe` action): the current index changes at once; the track jumps by the
 * distance the slides moved and settles to its rest position (`ms` = animation duration).
 */
export function lightboxNavigate(state: LightboxState, increment: number, ms?: number): void {
  if (!increment) return;
  const count = untrack(() => lightboxSlides(state)).length;
  if (!count) return;
  const nav = untrack(() => lightboxNavigation(state));
  if ((increment < 0 && nav.prevDisabled) || (increment > 0 && nav.nextDisabled)) return;
  let target = untrack(state.globalIndex) + increment;
  if (state.carousel.finite) {
    const current = getSlideIndex(untrack(state.globalIndex), count);
    target = untrack(state.globalIndex) + Math.max(-current, Math.min(count - 1 - current, increment));
  }
  const moved = target - untrack(state.globalIndex);
  const c = lightboxController(state);
  setLightboxGlobalIndex(state, target);
  untrack(() => state.on.onView?.({ index: getSlideIndex(target, count) }));
  if (c) {
    const sign = isRTL(c.container) ? -1 : 1;
    c.x.to(c.x.get() + sign * moved * lightboxStep(state), true);
    state.gesture.set("animation");
    animate(c.x, 0, ms ?? state.animation.navigation ?? state.animation.swipe);
  }
  afterNavigate(state);
}

/** Previous slide (YARL `prev`, `count` slides). */
export const lightboxPrev = (state: LightboxState, count = 1): void => lightboxNavigate(state, -count);
/** Next slide (YARL `next`). */
export const lightboxNext = (state: LightboxState, count = 1): void => lightboxNavigate(state, count);

/** Jumps to slide `index` (shortest way round when not finite), animated. */
export function lightboxGoTo(state: LightboxState, index: number): void {
  const count = untrack(() => lightboxSlides(state)).length;
  if (!count) return;
  const current = getSlideIndex(untrack(state.globalIndex), count);
  let delta = getSlideIndex(index, count) - current;
  if (!state.carousel.finite && Math.abs(delta) > count / 2) delta -= Math.sign(delta) * count;
  lightboxNavigate(state, delta);
}

/** Syncs the rendered slide with the controlled `index` (external change: jump, no animation). */
export function syncLightboxIndex(state: LightboxState): void {
  const count = lightboxSlides(state).length;
  const index = state.index.value();
  untrack(() => {
    const g = state.globalIndex();
    if (count && getSlideIndex(g, count) !== getSlideIndex(index, count)) {
      state.globalIndex.set(g - getSlideIndex(g, count) + getSlideIndex(index, count));
      if (doc()) afterNavigate(state);
    }
  });
}

/** Focuses the container (YARL `focus`). */
export function focusLightbox(state: LightboxState): void {
  lightboxContainer(state)?.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------------------------------------
 * Pointer swipe / pull (YARL usePointerSwipe)
 * ----------------------------------------------------------------------------------------------*/

function clearPointer(c: Controller, id: number): void {
  if (c.active === id) {
    c.active = undefined;
    c.gesture = undefined;
  }
  c.pointers = c.pointers.filter((p) => p.id !== id);
}

function isMediaControls(event: PointerEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLMediaElement) || !target.controls) return false;
  return target.getBoundingClientRect().bottom - event.clientY < 40;
}

/** `pointerdown` on the container. */
export function lightboxPointerDown(state: LightboxState, event: PointerEvent): void {
  const c = lightboxController(state);
  if (!c) return;
  ensureLightbox(state);
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (isMediaControls(event)) return;
  clearPointer(c, event.pointerId);
  c.pointers.push({ id: event.pointerId, x: event.clientX, y: event.clientY, target: event.target });
  // A second pointer (pinch) cancels a running swipe / pull.
  if (c.pointers.length > 1 && c.active !== undefined) cancelGesture(state, c);
}

function cancelGesture(state: LightboxState, c: Controller): void {
  const gesture = c.gesture;
  c.active = undefined;
  c.gesture = undefined;
  c.offset = 0;
  if (gesture === "swipe") animate(c.x, 0, state.animation.swipe / 2);
  if (gesture === "pull") animate(c.y, 0, state.animation.fade * 2);
}

const exceedsPull = (state: LightboxState, value: number, threshold: number): boolean =>
  (state.controller.closeOnPullDown && value > threshold) || (state.controller.closeOnPullUp && value < -threshold);

/** `pointermove` on the container. */
export function lightboxPointerMove(state: LightboxState, event: PointerEvent): void {
  const c = lightboxController(state);
  if (!c) return;
  const pointer = c.pointers.find((p) => p.id === event.pointerId);
  if (!pointer) return;
  const isCurrent = c.active === event.pointerId;
  if (event.buttons === 0) {
    // Released over an opaque element / out-of-order events (YARL #48, #59).
    if (isCurrent && c.offset !== 0) lightboxPointerUp(state, event);
    else clearPointer(c, event.pointerId);
    return;
  }
  // Zoomed in or pinching: the Zoom plugin pans / zooms.
  if (untrack(state.zoom) > 1 || c.pointers.length > 1) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  if (c.active === undefined) {
    const rtl = isRTL(c.container);
    const startGesture = (gesture: "swipe" | "pull") => {
      c.active = event.pointerId;
      c.start = Date.now();
      c.gesture = gesture;
      c.offset = 0;
      state.gesture.set(gesture);
      try {
        c.container.setPointerCapture(event.pointerId);
      } catch {
        // pointer already released
      }
    };
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD && isSwipeValid(state, dx, rtl)) {
      if (!state.controller.disableSwipeNavigation) {
        startGesture("swipe");
        c.base = c.x.get();
        c.x.stop();
      }
    } else if (Math.abs(dy) > Math.abs(dx) && exceedsPull(state, dy, SWIPE_THRESHOLD)) {
      startGesture("pull");
    }
  }
  if (c.active === event.pointerId) {
    if (c.gesture === "swipe") {
      c.offset = dx;
      c.x.to(c.base + dx, true);
    } else if (c.gesture === "pull") {
      c.offset = dy;
      c.y.to(dy, true);
    }
  }
}

/** `pointerup` / `pointercancel` / `pointerleave` on the container. */
export function lightboxPointerUp(state: LightboxState, event: PointerEvent): void {
  const c = lightboxController(state);
  if (!c) return;
  const pointer = c.pointers.find((p) => p.id === event.pointerId);
  if (pointer) {
    if (c.active === event.pointerId) {
      const duration = Date.now() - c.start;
      const offset = c.offset;
      const gesture = c.gesture;
      c.active = undefined;
      c.gesture = undefined;
      c.offset = 0;
      if (gesture === "swipe") {
        const width = trackWidth(state);
        if (event.type !== "pointercancel" && (Math.abs(offset) > 0.3 * width || (Math.abs(offset) > 5 && duration < state.animation.swipe))) {
          const rtl = isRTL(c.container);
          lightboxNavigate(state, (rtl ? -1 : 1) * offset > 0 ? -1 : 1, state.animation.swipe);
        } else animate(c.x, 0, state.animation.swipe / 2);
      } else if (gesture === "pull") {
        if (event.type !== "pointercancel" && exceedsPull(state, offset, 2 * SWIPE_THRESHOLD)) {
          closeLightbox(state);
          animate(c.y, 0, state.animation.fade);
        } else animate(c.y, 0, state.animation.fade * 2);
      }
    } else if (event.type === "pointerup") {
      // A click: close on the backdrop (the slide box or a media wrapper, not the media).
      const target = event.target;
      if (
        state.controller.closeOnBackdropClick &&
        target instanceof Element &&
        target === pointer.target &&
        (target.hasAttribute("data-lightbox-slide") || target.hasAttribute("data-lightbox-backdrop"))
      )
        closeLightbox(state);
    }
  }
  clearPointer(c, event.pointerId);
}

/* ------------------------------------------------------------------------------------------------
 * Keyboard (YARL useKeyboardNavigation)
 * ----------------------------------------------------------------------------------------------*/

/** `keydown` on the container: ArrowLeft / ArrowRight (mirrored in RTL), throttled. Escape is the overlay's. */
export function lightboxKeyDown(state: LightboxState, event: KeyboardEvent): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  // The Zoom plugin pans with the arrows while zoomed in (it marks the event handled).
  if (lightboxHandled.has(event) || untrack(state.zoom) > 1) return;
  const c = lightboxController(state);
  event.stopPropagation();
  const throttle = (state.animation.navigation ?? state.animation.swipe) / 2;
  const now = Date.now();
  if (c) {
    if (now - c.lastKey < throttle) return;
    c.lastKey = now;
  }
  const rtl = c ? isRTL(c.container) : false;
  const prev = event.key === "ArrowLeft" ? !rtl : rtl;
  if (prev) lightboxPrev(state);
  else lightboxNext(state);
}

/* ------------------------------------------------------------------------------------------------
 * Wheel (YARL useWheelSwipe + usePreventWheelDefaults)
 * ----------------------------------------------------------------------------------------------*/

function wheelSwipe(state: LightboxState, c: Controller, event: WheelEvent): void {
  if (event.ctrlKey) return; // zoom
  if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) return; // pan-y
  if (untrack(state.zoom) > 1) return;
  const w = c.wheel;
  const width = trackWidth(state);
  const swipeMs = state.animation.swipe;
  const setInertia = (inertia: number) => {
    w.inertia = inertia;
    clearTimeout(w.timers.inertia);
    w.timers.inertia =
      inertia > 0
        ? setTimeout(() => {
            w.inertia = 0;
            w.timers.inertia = undefined;
          }, 300)
        : undefined;
  };
  if (!w.swiping) {
    if (c.gesture || untrack(state.gesture) === "animation") {
      setInertia(event.deltaX);
      return;
    }
    if (Math.abs(event.deltaX) <= 1.2 * Math.abs(w.inertia)) {
      setInertia(event.deltaX);
      return;
    }
    if (!isSwipeValid(state, -event.deltaX, isRTL(c.container))) return;
    w.intent += event.deltaX;
    clearTimeout(w.timers.intent);
    if (Math.abs(w.intent) > 30) {
      w.intent = 0;
      setInertia(0);
      w.start = Date.now();
      w.swiping = true;
      w.offset = 0;
      c.base = c.x.get();
      c.x.stop();
      state.gesture.set("swipe");
    } else {
      const intent = w.intent;
      w.timers.intent = setTimeout(() => {
        w.timers.intent = undefined;
        if (intent === w.intent) w.intent = 0;
      }, swipeMs);
    }
    return;
  }
  let offset = w.offset - event.deltaX;
  offset = Math.min(Math.abs(offset), width) * Math.sign(offset);
  w.offset = offset;
  c.x.to(c.base + offset, true);
  clearTimeout(w.timers.reset);
  if (Math.abs(offset) > 0.2 * width) {
    setInertia(event.deltaX);
    w.swiping = false;
    w.offset = 0;
    const rtl = isRTL(c.container);
    lightboxNavigate(state, (rtl ? -1 : 1) * offset > 0 ? -1 : 1, swipeMs);
    return;
  }
  w.timers.reset = setTimeout(() => {
    w.timers.reset = undefined;
    if (w.swiping && w.offset === offset) {
      w.swiping = false;
      w.offset = 0;
      animate(c.x, 0, swipeMs / 2);
    }
  }, 2 * swipeMs);
}

/**
 * Installs the browser-only listeners (non-passive `wheel`) once per container: called when the lightbox opens and from
 * the first pointer / focus interaction of an inline lightbox (nothing runs on a resumed page before that).
 */
export function ensureLightbox(state: LightboxState): void {
  const c = lightboxController(state);
  if (!c || c.installed) return;
  c.installed = true;
  c.container.addEventListener(
    "wheel",
    (event: WheelEvent) => {
      const { preventDefaultWheelX, preventDefaultWheelY } = state.controller;
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if ((horizontal && preventDefaultWheelX) || (!horizontal && preventDefaultWheelY) || event.ctrlKey) event.preventDefault();
      if (lightboxHandled.has(event)) return;
      wheelSwipe(state, c, event);
    },
    { passive: false },
  );
}

/** `padding` / `spacing` of the carousel as CSS (`calc` of px + % of the carousel width). */
export function lightboxLengthCss(value: Parameters<typeof parseLength>[0]): string {
  const v = parseLength(value);
  return `calc(${v.pixel ?? 0}px + ${v.percent ?? 0}%)`;
}
