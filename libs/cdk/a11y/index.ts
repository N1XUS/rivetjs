// Accessibility helpers: live announcements, focusability / visibility checks, the visually hidden
// styles. No import-time work: the fallback live regions are created by the first `announce()`.
import { cssEscape } from "../utils/dom-core.ts";

/**
 * Styles of visually hidden but accessible content (react-aria `useVisuallyHidden`): `style={visuallyHidden}`.
 * Inline on purpose: no stylesheet to import, and a class of your own cannot break it. Frozen: the DOM runtime writes a
 * frozen style object on a fresh element as one CSSOM `cssText` (validated once), not ten `setProperty` calls.
 */
export const visuallyHidden = Object.freeze({
  border: "0",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: "0",
  position: "absolute",
  width: "1px",
  whiteSpace: "nowrap",
} as const);

/** Hide `element` visually through the CSSOM (CSP-safe), keeping it for screen readers. */
export function hideVisually(element: HTMLElement): void {
  Object.assign(element.style, visuallyHidden);
}

export type Politeness = "polite" | "assertive";

const created: Partial<Record<Politeness, HTMLElement>> = {};
let pending: Partial<Record<Politeness, ReturnType<typeof setTimeout>>> = {};

/** The live region for `politeness`: a server-rendered `<Announcer/>` region, else one created now. */
function region(politeness: Politeness): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-rv-announcer="${politeness}"]`);
  if (found) return found;
  let own = created[politeness];
  if (!own?.isConnected) {
    own = created[politeness] = document.createElement("div");
    own.setAttribute("data-rv-announcer", politeness);
    own.setAttribute("aria-live", politeness);
    own.setAttribute("aria-atomic", "true");
    if (politeness === "assertive") own.setAttribute("role", "alert");
    hideVisually(own);
    document.body.append(own);
  }
  return own;
}

/**
 * Announce `message` to screen readers through a live region (polite by default). Live regions must
 * exist before their content changes: render `<Announcer/>` (`@rivetjs/cdk/announcer`) in the layout so
 * the first announcement is not lost; without it the regions are created on first use. The text is
 * cleared and set after a tick, so repeating a message announces it again. Browser only.
 */
export function announce(message: string, politeness: Politeness = "polite"): void {
  const target = region(politeness);
  clearTimeout(pending[politeness]);
  target.textContent = "";
  pending[politeness] = setTimeout(() => (target.textContent = message), 50);
}

/** Clear pending and shown announcements (tests, route changes). */
export function clearAnnouncements(): void {
  for (const key of Object.keys(pending) as Politeness[]) clearTimeout(pending[key]);
  pending = {};
  for (const el of document.querySelectorAll("[data-rv-announcer]")) el.textContent = "";
}

const FOCUSABLE =
  "a[href],area[href],button,input,select,textarea,iframe,summary,audio[controls],video[controls],[contenteditable]:not([contenteditable=false]),[tabindex]";

/** Whether `element` is rendered (not `display: none`, not in a closed `<details>`, not hidden). */
export function isVisible(element: Element): boolean {
  const check = (element as Element & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
  if (typeof check === "function") return check.call(element, { visibilityProperty: true });
  return !(element as HTMLElement).hidden && (element as HTMLElement).offsetParent !== null;
}

/** Can receive focus (programmatically or by pointer): focusable element, not disabled, not inert, visible. */
export function isFocusable(element: Element): boolean {
  if (!element.matches(FOCUSABLE)) return false;
  if ((element as HTMLButtonElement).disabled || element.closest("[inert]")) return false;
  if (element.localName === "input" && (element as HTMLInputElement).type === "hidden") return false;
  return isVisible(element);
}

/** Reachable with Tab: focusable and tabindex ≥ 0 (radio groups: only the checked / first radio). */
export function isTabbable(element: Element): boolean {
  if (!isFocusable(element) || (element as HTMLElement).tabIndex < 0) return false;
  const input = element as HTMLInputElement;
  if (input.localName === "input" && input.type === "radio" && input.name && !input.checked) {
    const group = [...(input.form ?? document).querySelectorAll<HTMLInputElement>(`input[type=radio][name="${cssEscape(input.name)}"]`)];
    return !group.some((radio) => radio.checked) && group.find((radio) => isFocusable(radio)) === input;
  }
  return true;
}

/** Tabbable descendants of `root` in DOM order (tabindex > 0 first is not modelled: avoid positive tabindex). */
export function tabbables(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isTabbable);
}
