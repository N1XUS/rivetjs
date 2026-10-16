// iOS Safari part of `preventScroll()` (loaded lazily, only there or for `overrideFocus`). Even with
// `overflow: hidden` Mobile Safari scrolls the page: with collapsed toolbars, when the keyboard
// covers the viewport, when focusing an input (centers it), and with the keyboard's next / previous
// buttons. So: prevent `touchmove` outside scrollable elements, `overscroll-behavior: contain` on
// nested scrollers (a `<style>`, applied before touchstart as of iOS 26), and focus programmatically
// without page scroll, scrolling only the scroll parents once the virtual keyboard settled.
// Keyboard tracking starts on first use (React Aria starts it at import).
//
// Ported from @react-aria/overlays (usePreventScroll.ts) and @react-aria/utils (keyboard.tsx,
// runAfterKeyboard.ts, getNonce.ts), Apache-2.0, © Adobe.
import { isFocusable } from "../a11y/index.ts";
import { isAndroid, isWebKit } from "../platform/index.ts";
import { getScrollParent, isScrollable, setStyle } from "./prevent-scroll.ts";

const eventTarget = (event: Event): EventTarget | null => (event.composedPath?.()[0] as EventTarget | undefined) ?? event.target;

/** The CSP nonce for injected `<style>`: `<meta property="csp-nonce">`, else the nonce of a page script. */
export function getNonce(doc: Document = document): string | undefined {
  const meta = doc.querySelector<HTMLMetaElement>('meta[property="csp-nonce"], meta[name="csp-nonce"]')?.content;
  return meta || (doc.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? undefined) || undefined;
}

/** iOS Safari scroll lock; returns the restore function. */
export function preventScrollMobileWebKit(): () => void {
  ensureKeyboardTracking();
  let scrollable: Element | undefined;
  let allowTouchMove = false;
  const onTouchStart = (e: TouchEvent) => {
    // Nearest scrollable element from the touched one.
    const target = eventTarget(e) as Element;
    scrollable = isScrollable(target, true) ? target : getScrollParent(target, true);
    allowTouchMove = false;
    // Selected text: let the visitor adjust the selection.
    const selection = target.ownerDocument.defaultView!.getSelection();
    if (selection && !selection.isCollapsed && selection.containsNode(target, true)) allowTouchMove = true;
    // Range inputs: let the visitor drag the slider.
    if (e.composedPath().some((el) => el instanceof HTMLInputElement && el.type === "range")) allowTouchMove = true;
    // A focused input with a selected range: let the visitor drag the handles.
    const field = target as Partial<HTMLInputElement>;
    if (
      "selectionStart" in target &&
      "selectionEnd" in target &&
      (field.selectionStart as number) < (field.selectionEnd as number) &&
      target.ownerDocument.activeElement === target
    )
      allowTouchMove = true;
  };

  // Stop nested scrollers from chaining to the window at their ends (applied before touchstart).
  const style = document.createElement("style");
  const nonce = getNonce();
  if (nonce) style.nonce = nonce;
  style.textContent = "@layer {\n  * {\n    overscroll-behavior: contain;\n  }\n}";
  document.head.prepend(style);

  const onTouchMove = (e: TouchEvent) => {
    // Pinch zoom, selections, sliders.
    if (e.touches.length === 2 || allowTouchMove) return;
    // Scrolling the window.
    if (!scrollable || scrollable === document.documentElement || scrollable === document.body) {
      e.preventDefault();
      return;
    }
    // overscroll-behavior does not stop chaining when the element does not overflow
    // (https://bugs.webkit.org/show_bug.cgi?id=243452): neither axis overflowing → prevent.
    if (scrollable.scrollHeight === scrollable.clientHeight && scrollable.scrollWidth === scrollable.clientWidth) e.preventDefault();
  };

  const onBlur = (e: FocusEvent) => {
    const target = eventTarget(e) as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget && willOpenKeyboard(relatedTarget)) {
      // Re-focus programmatically so the focus override performs the scroll.
      relatedTarget.focus();
    } else if (!relatedTarget) {
      // Keyboard "Done" moves focus to the body; refocusing the same input later fires no blur and
      // Safari would scroll natively: move focus to the nearest focusable parent instead.
      const focusable = target.parentElement?.closest("[tabindex]") as HTMLElement | null;
      focusable?.focus({ preventScroll: true });
    }
  };

  const restoreFocus = overrideFocus();
  document.addEventListener("touchstart", onTouchStart, { passive: false, capture: true });
  document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
  document.addEventListener("blur", onBlur, true);
  return () => {
    document.removeEventListener("touchstart", onTouchStart, true);
    document.removeEventListener("touchmove", onTouchMove, true);
    document.removeEventListener("blur", onBlur, true);
    style.remove();
    restoreFocus();
  };
}

/** Patch `HTMLElement.prototype.focus`: focus without scrolling the page, then scroll only its scroll parents. */
export function overrideFocus(): () => void {
  ensureKeyboardTracking();
  const focus = HTMLElement.prototype.focus;
  Reflect.defineProperty(HTMLElement.prototype, "focus", {
    configurable: true,
    writable: true,
    value: function (this: HTMLElement, opts?: FocusOptions) {
      focus.call(this, { ...opts, preventScroll: true });
      if (!opts || !opts.preventScroll) {
        const scroll = () => {
          if (document.activeElement === this) scrollIntoView(this);
        };
        runAfterKeyboard((isOpen) => (isOpen ? scroll() : runAfterKeyboardTransition(() => scroll())));
      }
    },
  });
  return () => {
    Reflect.defineProperty(HTMLElement.prototype, "focus", { configurable: true, writable: true, value: focus });
  };
}

function scrollIntoView(target: Element): void {
  const root = document.scrollingElement || document.documentElement;
  const visualViewport = window.visualViewport;
  let nextTarget: Element | null = target;
  while (nextTarget && nextTarget !== root && nextTarget.isConnected) {
    // Adjust the scroll parent if the target is not in view.
    const scrollable = getScrollParent(nextTarget);
    if (scrollable !== document.documentElement && scrollable !== document.body && scrollable !== nextTarget) {
      const scrollableRect = scrollable.getBoundingClientRect();
      const targetRect = nextTarget.getBoundingClientRect();
      if (targetRect.top < scrollableRect.top || targetRect.bottom > scrollableRect.top + nextTarget.clientHeight) {
        let bottom = scrollableRect.bottom;
        if (visualViewport) bottom = Math.min(bottom, visualViewport.offsetTop + visualViewport.height);
        // Center within the viewport, clamped to the scroll range.
        const adjustment = targetRect.top - scrollableRect.top - ((bottom - scrollableRect.top) / 2 - targetRect.height / 2);
        scrollable.scrollTo({
          top: Math.max(0, Math.min(scrollable.scrollHeight - scrollable.clientHeight, scrollable.scrollTop + adjustment)),
          behavior: "smooth",
        });
      }
    }
    nextTarget = scrollable.parentElement;
  }
}

// ---------------------------------------------------------------------------------------------
// Virtual keyboard tracking (keyboard.tsx, runAfterKeyboard.ts).

const KEYBOARD_HEIGHT = 100;
const KEYBOARD_TIMEOUT = 600;
const state = {
  isOpen: false,
  screenWidth: 0,
  screenHeight: 0,
  screenAngle: 0,
  screenTimeout: 0,
  startTimeStamp: 0,
  endTimeStamp: 0,
  resizeTimeStamp: 0,
  resizeTimeout: 0,
};
// Input types that open no software keyboard.
const nonTextInputTypes = new Set(["checkbox", "radio", "range", "color", "file", "image", "button", "submit", "reset"]);
let tracking = false;

const metaValue = (name: string): string | undefined => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content;

function getTouchScreen(): { width: number; height: number; angle: number } {
  // Undo scaling: layout coordinate space.
  const screenWidth = Number(window.visualViewport?.width ?? window.innerWidth);
  const screenHeight = Number(window.visualViewport?.height ?? window.innerHeight);
  const visualScale = Number(window.visualViewport?.scale ?? 1);
  return { width: screenWidth * visualScale, height: screenHeight * visualScale, angle: window.screen.orientation?.angle ?? 0 };
}

function onResizeStart(e: Event): void {
  // Reschedule only when the timer gets close.
  if (state.resizeTimeStamp <= e.timeStamp + 50) {
    state.resizeTimeStamp = e.timeStamp + 150;
    window.clearTimeout(state.resizeTimeout);
    state.resizeTimeout = window.setTimeout(onResizeEnd, 150);
  }
}

function onResizeEnd(): void {
  // Overlaying keyboards do not change geometry.
  if (isAndroid() && metaValue("viewport")?.includes("overlays-content")) return;
  const time = performance.now();
  const screen = getTouchScreen();
  const elapsed = time - state.startTimeStamp;
  let delta = state.screenHeight - screen.height;
  const rotation = state.screenAngle - screen.angle;
  // An open keyboard that rotated along closes: the old width predicts the closing height.
  if (Math.abs(rotation) % 180 && state.screenWidth - screen.height < KEYBOARD_HEIGHT) {
    state.screenWidth = screen.width;
    state.screenHeight = screen.height;
    state.screenAngle = screen.angle;
    delta = 0;
  }
  // A resize outside the capture window updates the screen (debounced: WebKit may resize before focus).
  if (elapsed > KEYBOARD_TIMEOUT) {
    window.clearTimeout(state.screenTimeout);
    state.screenTimeout = window.setTimeout(() => {
      const activeElement = document.hasFocus() ? document.activeElement : null;
      const willKeyboardOpen = willOpenKeyboard(activeElement);
      const next = getTouchScreen();
      if (Math.abs(state.screenAngle - next.angle) % 180) return;
      if (state.isOpen && willKeyboardOpen) return;
      state.screenWidth = next.width;
      state.screenHeight = next.height;
      state.screenAngle = next.angle;
      state.isOpen = false;
    }, KEYBOARD_TIMEOUT);
  }
  // Otherwise an opening, when the height changed past the threshold.
  if (elapsed <= KEYBOARD_TIMEOUT && delta >= KEYBOARD_HEIGHT) state.endTimeStamp = time;
  state.isOpen = delta >= KEYBOARD_HEIGHT;
}

function onOrientationChange(): void {
  const screen = getTouchScreen();
  const rotation = state.screenAngle - screen.angle;
  // A screen estimate must exist before focus lands after a rotation.
  if (Math.abs(rotation) % 180 && !state.isOpen) {
    const width = state.screenWidth;
    state.screenWidth = state.screenHeight;
    state.screenHeight = width;
  }
  if (!state.isOpen) state.screenAngle = screen.angle;
}

function onFocus(e: FocusEvent): void {
  const willKeyboardOpen = willOpenKeyboard(eventTarget(e) as Element);
  const time = performance.now();
  const screen = getTouchScreen();
  const delta = state.screenHeight - screen.height;
  if (delta < KEYBOARD_HEIGHT && willKeyboardOpen) {
    state.screenWidth = screen.width;
    state.screenHeight = screen.height;
    state.screenAngle = screen.angle;
    state.startTimeStamp = time;
  }
  if (willKeyboardOpen) window.clearTimeout(state.screenTimeout);
  if (delta >= KEYBOARD_HEIGHT && willKeyboardOpen) state.endTimeStamp = time;
}

function ensureKeyboardTracking(): void {
  if (tracking || typeof window === "undefined") return;
  tracking = true;
  const screen = getTouchScreen();
  // WebKit fires a single event per resize.
  window.visualViewport?.addEventListener("resize", isWebKit() ? onResizeEnd : onResizeStart);
  window.screen.orientation?.addEventListener("change", onOrientationChange);
  window.addEventListener("focus", onFocus, { capture: true, passive: true });
  state.screenWidth = screen.width;
  state.screenHeight = screen.height;
  state.screenAngle = screen.angle;
}

/** Whether the device has a software keyboard (best effort). */
export function supportsKeyboard(): boolean {
  if (isAndroid() && metaValue("viewport")?.includes("overlays-content")) return false;
  if (state.isOpen) return true;
  if (!state.startTimeStamp) return window.navigator.maxTouchPoints > 0;
  if (state.endTimeStamp >= state.startTimeStamp) return true;
  return performance.now() - state.startTimeStamp <= KEYBOARD_TIMEOUT ? state.endTimeStamp > 0 || window.navigator.maxTouchPoints > 0 : false;
}

/** Whether focusing `target` opens the software keyboard. */
export function willOpenKeyboard(target: Element | null): boolean {
  if (!(target instanceof Element) || !isFocusable(target)) return false;
  const isTextArea = target instanceof HTMLTextAreaElement;
  const isEditable = target instanceof HTMLElement && target.isContentEditable;
  const isTextInput = target instanceof HTMLInputElement && !nonTextInputTypes.has(target.type);
  return isTextArea || isEditable || isTextInput;
}

export const isKeyboardOpen = (): boolean => state.isOpen;

const WEBKIT_OPEN_DELAY = 200;
const TRANSITION_FRAMETIME = 50;
const TRANSITION_TIMEOUT = 600;
type QueuedCallback = (isKeyboardOpen: boolean) => void;
let interval: number | undefined;
const transitionCallbacks = new Set<QueuedCallback>();
const resizeCallbacks = new Set<QueuedCallback>();

function onTransitionFrame(wasOpenKeyboard: boolean, signal: AbortSignal): void {
  const isOpenKeyboard = isKeyboardOpen();
  // Resize callbacks: once layout changed, or out of time.
  if (wasOpenKeyboard !== isOpenKeyboard || signal.aborted)
    for (const callback of resizeCallbacks) {
      callback(isOpenKeyboard);
      resizeCallbacks.delete(callback);
    }
  // WebKit fires one resize at the start of the ~200 ms opening: restart and flush when it ends.
  if (!wasOpenKeyboard && isOpenKeyboard && isWebKit() && !signal.aborted) {
    window.clearInterval(interval);
    interval = setupInterval(WEBKIT_OPEN_DELAY);
    return;
  }
  if (wasOpenKeyboard !== isOpenKeyboard || signal.aborted)
    for (const callback of transitionCallbacks) {
      callback(isOpenKeyboard);
      transitionCallbacks.delete(callback);
    }
  if (resizeCallbacks.size + transitionCallbacks.size <= 0 || signal.aborted) {
    window.clearInterval(interval);
    interval = undefined;
  }
}

const setupInterval = (timeout = TRANSITION_TIMEOUT): number =>
  window.setInterval(onTransitionFrame, TRANSITION_FRAMETIME, isKeyboardOpen(), AbortSignal.timeout(timeout));

function queue(fn: QueuedCallback, into: Set<QueuedCallback>, fireOnClose: boolean): () => void {
  // No keyboard: synchronously.
  if (!supportsKeyboard()) return (fn(false), () => {});
  // Two frames: does focus land on an input?
  let frame = window.requestAnimationFrame(() => {
    frame = window.requestAnimationFrame(() => {
      const activeElement = document.hasFocus() ? document.activeElement : null;
      const willKeyboardOpen = willOpenKeyboard(activeElement);
      if (isKeyboardOpen() === willKeyboardOpen) return fn(willKeyboardOpen);
      // On close, at once: callers may assert the initial containing block.
      if (fireOnClose && isKeyboardOpen() && !willKeyboardOpen) return fn(willKeyboardOpen);
      into.add(fn);
      interval ??= setupInterval();
    });
  });
  return () => {
    window.cancelAnimationFrame(frame);
    into.delete(fn);
  };
}

/** Run `fn` once a keyboard transition can no longer affect layout (at most ~600 ms later). */
export const runAfterKeyboard = (fn: QueuedCallback): (() => void) => queue(fn, resizeCallbacks, true);
/** Run `fn` once the software keyboard finished its transition (at most ~600 ms later). */
export const runAfterKeyboardTransition = (fn: QueuedCallback): (() => void) => queue(fn, transitionCallbacks, false);
