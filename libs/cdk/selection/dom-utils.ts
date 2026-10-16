// Ported from @react-aria/focus (virtualFocus.ts: getVirtuallyFocusedElement, dispatchVirtualBlur /
// Focus, moveVirtualFocus), Apache-2.0, © Adobe.
//
// Everything else the selection hooks need is re-exported from the package's single implementations:
// modality from `../interactions/focus-visible.tsx` (`trackModality` = `noteModality`), scrolling and
// `nodeContains` from `../utils/dom.ts`, `focusSafely` from `../focus`, `focusWithoutScrolling` from
// `../utils`, virtual events from `../platform`, `openLink` / `isOpeningLink` from `../utils/links.tsx`.
// `pointerTypeOf(event)` (Rivet: the press pointer type of any DOM event) lives here.
import { isVirtualPointerEvent } from "../platform/index.ts";
import { openLink as openAnchor } from "../utils/links.tsx";
import type { PointerType } from "./manager.ts";

export type { Modality } from "../interactions/focus-visible.tsx";
export { _setInteractionModality, getInteractionModality, noteModality as trackModality } from "../interactions/focus-visible.tsx";
export { isVirtualPointerEvent } from "../platform/index.ts";
export { getScrollParents, isScrollable, nodeContains, scrollIntoView, scrollIntoViewport } from "../utils/dom.ts";
export { focusWithoutScrolling } from "../utils/index.ts";
export { focusSafely } from "../focus/index.ts";
export { isOpeningLink } from "../utils/links.tsx";

/** Pointer type of a DOM event (press-event `pointerType`): keyboard, virtual (screen readers / `element.click()`), mouse / pen / touch. */
export function pointerTypeOf(event: Event): PointerType {
  if (event.type.startsWith("key")) return "keyboard";
  if (event.type.startsWith("pointer") && isVirtualPointerEvent(event as PointerEvent)) return "virtual";
  const pointer = (event as PointerEvent).pointerType;
  if (pointer === "mouse" || pointer === "pen" || pointer === "touch") return pointer;
  if (event.type.startsWith("touch")) return "touch";
  // Virtual clicks: screen readers / element.click() (detail 0, no pointer).
  if (event.type === "click" && (event as MouseEvent).detail === 0 && !pointer) return "virtual";
  return "mouse";
}

export function getVirtuallyFocusedElement(doc: Document): Element | null {
  const activeElement = doc.activeElement;
  const activeDescendant = activeElement?.getAttribute("aria-activedescendant");
  if (activeDescendant) return doc.getElementById(activeDescendant) || activeElement;
  return activeElement;
}

export function dispatchVirtualBlur(from: Element, to: Element | null): void {
  from.dispatchEvent(new FocusEvent("blur", { relatedTarget: to }));
  from.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: to }));
}

export function dispatchVirtualFocus(to: Element, from: Element | null): void {
  to.dispatchEvent(new FocusEvent("focus", { relatedTarget: from }));
  to.dispatchEvent(new FocusEvent("focusin", { bubbles: true, relatedTarget: from }));
}

/** Move virtual focus (aria-activedescendant targets) from the current element to `to`. */
export function moveVirtualFocus(to: Element | null): void {
  if (typeof document === "undefined") return;
  const from = getVirtuallyFocusedElement(to?.ownerDocument ?? document);
  if (from !== to) {
    if (from) dispatchVirtualBlur(from, to);
    if (to) dispatchVirtualFocus(to, from);
  }
}

/**
 * Open a link item like a click on it: an anchor opens itself (react-aria `openLink`, modifiers
 * honoured, `linkState.isOpening` set); any other element with `href` gets a temporary anchor.
 */
export function openLink(target: HTMLElement, modifiers: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }, href?: string): void {
  if (target instanceof HTMLAnchorElement && (!href || target.getAttribute("href") === href)) return openAnchor(target, modifiers);
  if (!href) return;
  const anchor = target.ownerDocument.createElement("a");
  anchor.href = href;
  const t = target.getAttribute("target");
  if (t) anchor.target = t;
  target.appendChild(anchor);
  openAnchor(anchor, modifiers);
  anchor.remove();
}
