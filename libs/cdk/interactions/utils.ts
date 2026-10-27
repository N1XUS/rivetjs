// Shared helpers of the interaction hooks: virtual click detection, focusability selectors,
// text selection, the preventFocus guard, createEventHandler, `read` / `MaybeAccessor` (`preventFocus` itself lives
// with its only user, the press core `./press-core.ts`: PRESSSPLIT 2026-10-26).
// Ported from @react-aria/interactions + @react-aria/utils (react-spectrum), Apache-2.0, © Adobe.
// Browser-only bodies; nothing runs at import time.
//
// One implementation per helper: platform probes come from `../platform` (return `undefined` on the
// server), DOM / shadow-DOM functions from `../utils/dom.ts`, `runAfterTransition` /
// `focusWithoutScrolling` from the leaf `../utils/transitions.ts`, `linkState` from the leaf
// `../utils/link-state.ts` (the flag usePress and focus-visible read is the one `openLink` sets).
// They are re-exported here for the hooks. Leaves only (DOCS-COLD 2026-10-20): `chain` (`./merge-props.tsx`)
// and `openLink` (`../utils/links.tsx`) are imported from their modules, so a focus / overlay helper
// importing this file does not pull prop merging or the router module into its chunk.
import { getEventTarget as domEventTarget } from "../utils/dom-core.ts";
import { isIOS, isWebKit } from "../platform/index.ts";
import { getOwnerDocument, getOwnerWindow } from "../utils/dom-core.ts";
import { runAfterTransition } from "../utils/transitions.ts";
export { DEV } from "../utils/dom-core.ts";

export { isAndroid, isChrome, isFirefox, isIOS, isIPad, isIPhone, isMac, isWebKit, isVirtualClick, isVirtualPointerEvent } from "../platform/index.ts";
export { getActiveElement, getOwnerDocument, getOwnerWindow, isFocusWithin, isShadowRoot, nodeContains } from "../utils/dom-core.ts";
export { focusWithoutScrolling, runAfterTransition } from "../utils/transitions.ts";
export { linkState } from "../utils/link-state.ts";

export type PointerType = "mouse" | "pen" | "touch" | "keyboard" | "virtual";
export type FocusableElement = HTMLElement | SVGElement;
/** A value or an accessor of it (signals qualify): options are read at event time. */
export type MaybeAccessor<T> = T | (() => T);

/** Read a `MaybeAccessor` (functions are called; signals are functions). */
export function read<T>(value: MaybeAccessor<T>): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

/** The event's real target (`../utils/dom.ts` `getEventTarget`), typed for the hooks (an `Element` unless told otherwise). */
export function getEventTarget<T = Element>(event: Event): T {
  return domEventTarget(event) as unknown as T;
}

// --- Focusability (react-aria selectors) --------------------------------------------------------------

const focusableElements = [
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "a[href]",
  "area[href]",
  "summary",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable^="false"])',
  "permission",
];
export const FOCUSABLE_ELEMENT_SELECTOR = focusableElements.join(":not([hidden]),") + ",[tabindex]:not([disabled]):not([hidden])";
export const TABBABLE_ELEMENT_SELECTOR = [...focusableElements, '[tabindex]:not([tabindex="-1"]):not([disabled])'].join(':not([hidden]):not([tabindex="-1"]),');

function isStyleVisible(element: Element): boolean {
  const win = getOwnerWindow(element);
  if (!(element instanceof win.HTMLElement) && !(element instanceof win.SVGElement)) return false;
  const { display, visibility } = element.style;
  let visible = display !== "none" && visibility !== "hidden" && visibility !== "collapse";
  if (visible) {
    const computed = win.getComputedStyle(element);
    visible = computed.display !== "none" && computed.visibility !== "hidden" && computed.visibility !== "collapse";
  }
  return visible;
}

/** Rendered and visible (`checkVisibility` where supported, else styles + `hidden` + closed `<details>`). */
export function isElementVisible(element: Element, child?: Element): boolean {
  if (typeof (element as Element & { checkVisibility?: unknown }).checkVisibility === "function")
    return element.checkVisibility({ visibilityProperty: true } as CheckVisibilityOptions) && !element.closest("[data-rv-prevent-focus]");
  return (
    element.nodeName !== "#comment" &&
    isStyleVisible(element) &&
    !element.hasAttribute("hidden") &&
    !element.hasAttribute("data-rv-prevent-focus") &&
    (element.nodeName === "DETAILS" && child && child.nodeName !== "SUMMARY" ? element.hasAttribute("open") : true) &&
    (!element.parentElement || isElementVisible(element.parentElement, element))
  );
}

function isInert(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) if ((node as HTMLElement).inert) return true;
  return false;
}

/** react-aria `isFocusable`: matches the focusable selector, not inert, visible (unless skipped). */
export function isFocusable(element: Element, options?: { skipVisibilityCheck?: boolean }): boolean {
  return element.matches(FOCUSABLE_ELEMENT_SELECTOR) && !isInert(element) && (!!options?.skipVisibilityCheck || isElementVisible(element));
}

/** react-aria `isTabbable`: matches the tabbable selector, visible, not inert. */
export function isTabbable(element: Element): boolean {
  return element.matches(TABBABLE_ELEMENT_SELECTOR) && isElementVisible(element) && !isInert(element);
}

// --- Text selection (iOS: whole document; elsewhere: the pressed element) ---------------------------

type SelectionState = "default" | "disabled" | "restoring";
let selectionState: SelectionState = "default";
let savedUserSelect = "";
const modifiedElements = new WeakMap<Element, string>();
type UserSelectStyle = CSSStyleDeclaration & { webkitUserSelect: string };

export function disableTextSelection(target?: Element): void {
  if (isIOS() && isWebKit()) {
    if (selectionState === "default") {
      const style = getOwnerDocument(target).documentElement.style as UserSelectStyle;
      savedUserSelect = style.webkitUserSelect;
      style.webkitUserSelect = "none";
    }
    selectionState = "disabled";
  } else if (target instanceof HTMLElement || target instanceof SVGElement) {
    const style = target.style as UserSelectStyle;
    const property = "userSelect" in style ? "userSelect" : "webkitUserSelect";
    modifiedElements.set(target, style[property]);
    style[property] = "none";
  }
}

export function restoreTextSelection(target?: Element): void {
  if (isIOS() && isWebKit()) {
    if (selectionState !== "disabled") return;
    selectionState = "restoring";
    // iOS may still select right after pointer up: wait, then let transitions finish.
    setTimeout(() => {
      runAfterTransition(() => {
        if (selectionState === "restoring") {
          const style = getOwnerDocument(target).documentElement.style as UserSelectStyle;
          if (style.webkitUserSelect === "none") style.webkitUserSelect = savedUserSelect || "";
          savedUserSelect = "";
          selectionState = "default";
        }
      });
    }, 300);
  } else if ((target instanceof HTMLElement || target instanceof SVGElement) && modifiedElements.has(target)) {
    const old = modifiedElements.get(target)!;
    const style = target.style as UserSelectStyle;
    const property = "userSelect" in style ? "userSelect" : "webkitUserSelect";
    if (style[property] === "none") style[property] = old;
    if (target.getAttribute("style") === "") target.removeAttribute("style");
    modifiedElements.delete(target);
  }
}

/** `<input type>`s that take no text (upstream declares this set in usePress and useFocusVisible each; one copy here). */
export const nonTextInputTypes: ReadonlySet<string> = new Set(["checkbox", "radio", "range", "color", "file", "image", "button", "submit", "reset"]);

// --- preventFocus guard (preventFocus itself: `./press-core.ts`, its only user) ------------------------

/** Set while `preventFocus` (`./press-core.ts`, usePress `preventFocusOnPress`) swallows the focus events it causes (focus-visible ignores them). */
export const focusGuard = { ignore: false };

// --- Events -----------------------------------------------------------------------------------------

/** A native event with react-aria's propagation API: stopped by default, `continuePropagation()` opts out. */
export type BaseEvent<E extends Event> = E & {
  /** @deprecated stopPropagation is the default; call `continuePropagation()` to let the event bubble. */
  stopPropagation(): void;
  continuePropagation(): void;
  isPropagationStopped(): boolean;
};

/**
 * Wrap an event handler so propagation stops by default and `continuePropagation()` lets the event
 * through (react-aria `createEventHandler`). The handler gets the native event, augmented in place for
 * the call (`continuePropagation`, `isPropagationStopped`; `stopPropagation` only marks it); nested
 * wrappers chain, so an inner `continuePropagation()` also continues the outer one.
 */
export function createEventHandler<E extends Event>(handler?: (e: BaseEvent<E>) => void): ((e: E) => void) | undefined {
  if (!handler) return undefined;
  return (e: E) => {
    let shouldStop = true;
    const own = e as E & Partial<BaseEvent<E>>;
    const outer = {
      continuePropagation: Object.getOwnPropertyDescriptor(e, "continuePropagation"),
      isPropagationStopped: Object.getOwnPropertyDescriptor(e, "isPropagationStopped"),
      stopPropagation: Object.getOwnPropertyDescriptor(e, "stopPropagation"),
    };
    const outerContinue = own.continuePropagation;
    Object.defineProperties(e, {
      continuePropagation: {
        configurable: true,
        value: () => {
          shouldStop = false;
          outerContinue?.call(e);
        },
      },
      isPropagationStopped: { configurable: true, value: () => shouldStop },
      stopPropagation: {
        configurable: true,
        value: () => {
          shouldStop = true;
        },
      },
    });
    try {
      handler(e as BaseEvent<E>);
    } finally {
      for (const key of ["continuePropagation", "isPropagationStopped", "stopPropagation"] as const) {
        const descriptor = outer[key];
        if (descriptor) Object.defineProperty(e, key, descriptor);
        else delete (e as Record<string, unknown>)[key];
      }
    }
    // Nested wrappers: the outer one decides (it reads the inner result through continuePropagation).
    if (shouldStop && !outer.isPropagationStopped && !e.cancelBubble) e.stopPropagation();
  };
}

/** The global document in a browser, `null` on the server (for code that also runs while rendering). */
export const browserDocument = (): Document | null => (typeof document === "undefined" ? null : document);
