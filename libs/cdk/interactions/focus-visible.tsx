// Global interaction modality tracking (keyboard / pointer / virtual) and focus-visible state.
// Ported from @react-aria/interactions useFocusVisible (react-spectrum), Apache-2.0, © Adobe.
//
// Deviation (resumability, no import-time globals): the original installs its document listeners when
// the module is imported. Here they install on first use — `addWindowFocusTracking()`, any hook's
// handler, or the `useFocusVisible` / `useInteractionModality` client effect. Until then the modality
// is unknown (`null`, focus visible like the original's initial state); a focus handler running before
// installation infers it from the browser's own `:focus-visible` heuristic (`syncModalityFromFocus`).
import { signal, type Signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import {
  focusGuard,
  getActiveElement,
  getEventTarget,
  getOwnerDocument,
  getOwnerWindow,
  isMac,
  isVirtualClick,
  linkState,
  nonTextInputTypes,
  type PointerType,
} from "./utils.ts";

export type Modality = "keyboard" | "pointer" | "virtual";
type HandlerEvent = PointerEvent | MouseEvent | KeyboardEvent | FocusEvent | null;
type Handler = (modality: Modality, e: HandlerEvent) => void;
export type FocusVisibleHandler = (isFocusVisible: boolean) => void;

export interface FocusVisibleProps {
  /** Whether the element is a text input. */
  isTextInput?: boolean;
  /** Whether the element will be auto focused. */
  autoFocus?: boolean;
}

export interface FocusVisibleResult {
  /** Whether keyboard focus is visible globally (signal). */
  isFocusVisible: () => boolean;
}

// Mutable module state lives in one object: resume-extracted symbols import module bindings read-only.
const g: { currentModality: Modality | null; currentPointerType: PointerType; hasEventBeforeFocus: boolean; hasBlurredWindowRecently: boolean } = {
  currentModality: null,
  currentPointerType: "keyboard",
  hasEventBeforeFocus: false,
  hasBlurredWindowRecently: false,
};
/** Subscribers to modality changes (browser-only functions). */
export const changeHandlers = new Set<Handler>();
const tracked = new Map<Window, { focus: HTMLElement["focus"] }>();

// Only Tab or Escape make focus visible on text inputs.
const FOCUS_VISIBLE_INPUT_KEYS: Record<string, true> = { Tab: true, Escape: true };

function triggerChangeHandlers(modality: Modality, e: HandlerEvent): void {
  for (const handler of changeHandlers) handler(modality, e);
}

/** Unmodified key that could make keyboard focus visible (Control / Shift fire when returning to the tab). */
function isValidKey(e: KeyboardEvent): boolean {
  return !(e.metaKey || (!isMac() && e.altKey) || e.ctrlKey || e.key === "Control" || e.key === "Shift" || e.key === "Meta");
}

function handleKeyboardEvent(e: KeyboardEvent): void {
  g.hasEventBeforeFocus = true;
  if (!linkState.isOpening && isValidKey(e)) {
    g.currentModality = "keyboard";
    g.currentPointerType = "keyboard";
    triggerChangeHandlers("keyboard", e);
  }
}

function handlePointerEvent(e: PointerEvent | MouseEvent): void {
  g.currentModality = "pointer";
  g.currentPointerType = "pointerType" in e ? (e.pointerType as PointerType) : "mouse";
  if (e.type === "mousedown" || e.type === "pointerdown") {
    g.hasEventBeforeFocus = true;
    triggerChangeHandlers("pointer", e);
  }
}

function handleClickEvent(e: MouseEvent): void {
  if (!linkState.isOpening && isVirtualClick(e)) {
    g.hasEventBeforeFocus = true;
    g.currentModality = "virtual";
    g.currentPointerType = "virtual";
  }
}

function handleFocusEvent(e: FocusEvent): void {
  if (focusGuard.ignore) return;
  const target = getEventTarget<EventTarget>(e);
  const win = getOwnerWindow(target),
    doc = getOwnerDocument(target);
  // Window focus (tab / app switch): restored element focus must not switch to virtual. Safari fires
  // the window/element pair twice, so re-arm on every window focus.
  if (target === win) {
    g.hasBlurredWindowRecently = true;
    return;
  }
  // Firefox: extra window/document focus events when first clicking into an iframe.
  if (target === doc || !e.isTrusted) return;
  // Focus without a preceding key / pointer event: virtual (e.g. iOS form next/previous buttons).
  if (!g.hasEventBeforeFocus && !g.hasBlurredWindowRecently) {
    g.currentModality = "virtual";
    g.currentPointerType = "virtual";
    triggerChangeHandlers("virtual", e);
  }
  g.hasEventBeforeFocus = false;
  g.hasBlurredWindowRecently = false;
}

function handleWindowBlur(): void {
  if (focusGuard.ignore) return;
  // Tabbing out of the window: no focus event follows, so reset.
  g.hasEventBeforeFocus = false;
  g.hasBlurredWindowRecently = true;
}

function handleInvalidEvent(e: Event): void {
  const doc = getOwnerDocument(getEventTarget(e));
  const starting = getActiveElement(doc);
  // A forms library moved focus to the first invalid field: keyboard modality.
  queueMicrotask(() => {
    if (getActiveElement(doc) !== starting) setInteractionModality("keyboard");
  });
}

/** Install the global listeners for the element's window (idempotent). Browser only. */
export function setupGlobalFocusEvents(element?: Element | null): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const win = getOwnerWindow(element),
    doc = getOwnerDocument(element);
  if (tracked.get(win)) return;
  // A resumed page installs these on first use: the resume loader's last input modality covers the events before it.
  if (g.currentModality === null) adoptLoaderModality(win);
  // Programmatic focus() must not switch the modality; other focus without a user event (screen
  // reader) does. Patching HTMLElement.prototype.focus marks programmatic calls.
  const focus = win.HTMLElement.prototype.focus;
  Reflect.defineProperty(win.HTMLElement.prototype, "focus", {
    configurable: true,
    writable: true,
    value: function (this: HTMLElement, ...args: [FocusOptions?]) {
      g.hasEventBeforeFocus = true;
      focus.apply(this, args);
    },
  });
  doc.addEventListener("keydown", handleKeyboardEvent, true);
  doc.addEventListener("keyup", handleKeyboardEvent, true);
  doc.addEventListener("click", handleClickEvent, true);
  doc.addEventListener("invalid", handleInvalidEvent, true);
  // Window capture: before any document listener.
  win.addEventListener("focus", handleFocusEvent, true);
  win.addEventListener("blur", handleWindowBlur, false);
  doc.addEventListener("pointerdown", handlePointerEvent, true);
  doc.addEventListener("pointermove", handlePointerEvent, true);
  doc.addEventListener("pointerup", handlePointerEvent, true);
  win.addEventListener("beforeunload", () => tearDownWindowFocusTracking(element), { once: true });
  tracked.set(win, { focus });
}

/**
 * The resume loader's record of the last user input before any cdk code ran (`window.__rvIM`: "keyboard", a pointer
 * type "mouse" / "pen" / "touch", or "virtual"; set by capture listeners in the loader, RESUME-PINS request). Absent
 * (client render, older loader): the modality stays unknown and focus handlers fall back to `:focus-visible`.
 */
function adoptLoaderModality(win: Window): void {
  const last = (win as Window & { __rvIM?: unknown }).__rvIM;
  if (last === "keyboard" || last === "virtual") {
    g.currentModality = last;
    g.currentPointerType = last;
  } else if (last === "mouse" || last === "pen" || last === "touch") {
    g.currentModality = "pointer";
    g.currentPointerType = last;
  }
}

function tearDownWindowFocusTracking(element?: Element | null, loadListener?: () => void): void {
  const win = getOwnerWindow(element),
    doc = getOwnerDocument(element);
  if (loadListener) doc.removeEventListener("DOMContentLoaded", loadListener);
  const entry = tracked.get(win);
  if (!entry) return;
  Reflect.defineProperty(win.HTMLElement.prototype, "focus", { configurable: true, writable: true, value: entry.focus });
  doc.removeEventListener("keydown", handleKeyboardEvent, true);
  doc.removeEventListener("keyup", handleKeyboardEvent, true);
  doc.removeEventListener("click", handleClickEvent, true);
  doc.removeEventListener("invalid", handleInvalidEvent, true);
  win.removeEventListener("focus", handleFocusEvent, true);
  win.removeEventListener("blur", handleWindowBlur, false);
  doc.removeEventListener("pointerdown", handlePointerEvent, true);
  doc.removeEventListener("pointermove", handlePointerEvent, true);
  doc.removeEventListener("pointerup", handlePointerEvent, true);
  tracked.delete(win);
}

/**
 * Track focus visibility in another window (an iframe), given an element inside it; the default
 * window is tracked on first use. Returns the function removing the listeners.
 */
export function addWindowFocusTracking(element?: HTMLElement | null): () => void {
  const doc = getOwnerDocument(element);
  let loadListener: (() => void) | undefined;
  if (doc.readyState !== "loading") setupGlobalFocusEvents(element);
  else doc.addEventListener("DOMContentLoaded", (loadListener = () => setupGlobalFocusEvents(element)));
  return () => tearDownWindowFocusTracking(element, loadListener);
}

/**
 * Called by focus handlers: installs tracking and, when the modality is still unknown (the page
 * resumed and nothing tracked the event that moved focus), adopts the browser's `:focus-visible`
 * verdict for the focused element.
 */
export function syncModalityFromFocus(target: Element | null): void {
  setupGlobalFocusEvents(target);
  if (g.currentModality !== null || !target) return;
  let visible: boolean;
  try {
    visible = target.matches(":focus-visible");
  } catch {
    return;
  }
  g.currentModality = visible ? "keyboard" : "pointer";
  g.currentPointerType = visible ? "keyboard" : "mouse";
}

/** Whether keyboard focus is visible (modality is not pointer). */
export function isFocusVisible(): boolean {
  return g.currentModality !== "pointer";
}

export function getInteractionModality(): Modality | null {
  return g.currentModality;
}

export function setInteractionModality(modality: Modality): void {
  g.currentModality = modality;
  g.currentPointerType = modality === "pointer" ? "mouse" : modality;
  triggerChangeHandlers(modality, null);
}

/** @internal Tests: reset the modality (`null` = unknown) without notifying listeners. */
export function _setInteractionModality(modality: Modality | null): void {
  g.currentModality = modality;
  g.currentPointerType = modality === "pointer" || modality === null ? "mouse" : modality;
}

/**
 * Record the modality of a DOM event a resumed handler received: the global listeners install on
 * first use, so they may have missed the very event that loaded the handler's chunk. Runs the same
 * classification as the document listeners (modifier-only keys ignored, virtual clicks / pointers
 * detected) and installs the listeners for later events. Collection / select / tabs handlers call it.
 */
export function noteModality(e: Event): void {
  setupGlobalFocusEvents(getEventTarget<Element | null>(e) ?? undefined);
  if (e.type === "keydown" || e.type === "keyup") handleKeyboardEvent(e as KeyboardEvent);
  else if (e.type === "click") handleClickEvent(e as MouseEvent);
  else if (e.type === "pointerdown" || e.type === "pointerup" || e.type === "pointermove" || e.type === "mousedown" || e.type === "mouseup")
    handlePointerEvent(e as PointerEvent | MouseEvent);
  else if (e.type.startsWith("touch")) {
    g.currentModality = "pointer";
    g.currentPointerType = "touch";
  }
}

/** @private The pointer type of the last interaction. */
export function getPointerType(): PointerType {
  return g.currentPointerType;
}

/** On text inputs, keyboard events other than Tab / Escape do not toggle focus visibility. */
export function isKeyboardFocusEvent(isTextInput: boolean, modality: Modality, e: HandlerEvent): boolean {
  const target = e ? getEventTarget<Element>(e) : undefined;
  const win = getOwnerWindow(target);
  const active = getActiveElement(getOwnerDocument(target));
  isTextInput =
    isTextInput ||
    (active instanceof win.HTMLInputElement && !nonTextInputTypes.has(active.type)) ||
    active instanceof win.HTMLTextAreaElement ||
    (active instanceof win.HTMLElement && active.isContentEditable);
  return !(isTextInput && modality === "keyboard" && e instanceof win.KeyboardEvent && !FOCUS_VISIBLE_INPUT_KEYS[e.key]);
}

/**
 * Subscribe `fn` to focus-visible changes (browser only, outside components: a handler or effect).
 * Returns the unsubscribe function. The component-level form is `useFocusVisibleListener`.
 */
export function addFocusVisibleListener(fn: FocusVisibleHandler, opts?: { isTextInput?: boolean }): () => void {
  setupGlobalFocusEvents();
  const handler: Handler = (modality, e) => {
    if (!isKeyboardFocusEvent(!!opts?.isTextInput, modality, e)) return;
    fn(isFocusVisible());
  };
  changeHandlers.add(handler);
  return () => changeHandlers.delete(handler);
}

/**
 * Listen for modality changes and report whether focus is visible. Deviation: no React `deps`; the
 * listener is a client effect (resumed pages: installed when the runtime starts).
 */
export function watchFocusVisible(fn: FocusVisibleHandler, opts?: { enabled?: boolean | (() => boolean); isTextInput?: boolean }): void {
  clientEffect(() => {
    const enabled = typeof opts?.enabled === "function" ? opts.enabled() : opts?.enabled;
    if (enabled === false) return;
    return addFocusVisibleListener(fn, { isTextInput: opts?.isTextInput });
  });
}

/** The current modality as a signal (`null` on the server and until the first interaction). */
export function createInteractionModality(): Signal<Modality | null> {
  const modality = signal<Modality | null>(null);
  clientEffect(() => {
    setupGlobalFocusEvents();
    modality.set(g.currentModality);
    const handler = () => modality.set(g.currentModality);
    changeHandlers.add(handler);
    return () => changeHandlers.delete(handler);
  });
  return modality;
}

/** Focus-visible state for the page (signal), updated on modality changes. */
export function createFocusVisible(props: FocusVisibleProps = {}): FocusVisibleResult {
  const { isTextInput, autoFocus } = props;
  const visible = signal(!!autoFocus || isFocusVisible());
  clientEffect(() => addFocusVisibleListener((value) => visible.set(value), { isTextInput }));
  return { isFocusVisible: visible };
}
