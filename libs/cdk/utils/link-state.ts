// The flag `openLink` sets while it dispatches its synthetic click, and `openLink` itself (react-spectrum
// packages/react-aria/src/utils/openLink.tsx, Apache-2.0, © Adobe). A leaf module (DOCS-COLD 2026-10-20): focus-visible /
// usePress read the flag through `../interactions/utils.ts`, and usePress (Space on an `<a>` with a role override) calls
// `openLink` from here (BUTTONDIET 2026-10-26), without reaching the router module `./links.tsx` (RouterContext,
// RouterProvider, synthetic link props), which re-exports both.
import { isIPad, isMac, isWebKit } from "../platform/index.ts";

/** Set while `openLink` dispatches its event (react-aria's `openLink.isOpening`); read by usePress / focus-visible / collections. */
export const linkState = { isOpening: false };

/** Whether `openLink` is dispatching its synthetic click (item click handlers let it through). */
export const isOpeningLink = (): boolean => linkState.isOpening;

export interface Modifiers {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/**
 * Open `target` as if clicked with `modifiers` (new tab / window / download follow the browser's
 * rules for them). Focuses the link without scrolling, then dispatches a click (WebKit on macOS:
 * a keydown Enter, as WebKit ignores modifiers on synthetic clicks).
 */
export function openLink(target: HTMLAnchorElement, modifiers: Modifiers, setOpening = true): void {
  const { metaKey, ctrlKey, altKey, shiftKey } = modifiers;
  const view = target.ownerDocument.defaultView!;
  const event =
    isWebKit() && isMac() && !isIPad()
      ? new view.KeyboardEvent("keydown", { keyIdentifier: "Enter", metaKey, ctrlKey, altKey, shiftKey } as KeyboardEventInit)
      : new view.MouseEvent("click", { metaKey, ctrlKey, altKey, shiftKey, detail: 1, bubbles: true, cancelable: true });
  linkState.isOpening = setOpening;
  target.focus({ preventScroll: true });
  target.dispatchEvent(event);
  linkState.isOpening = false;
}
