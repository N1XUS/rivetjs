// Scroll restoration and history-entry bookkeeping for client navigation. The router's keys (`i`:
// entry index, `rivet`: scroll key) merge into `history.state`, so app keys on an entry survive.
type EntryState = { i?: number; rivet?: number } | null;
const SCROLL = "rivet:scroll:";
let seq = 0;
// Scroll key of the entry the page shows; unknown until the first client navigation.
let shown: number | undefined;
let manual = false;

/** Key the current history entry (merged into its state) and make it the shown one. */
export function enter(i: number): void {
  const state = history.state as EntryState;
  const key = typeof state?.rivet === "number" ? state.rivet : Date.now() * 1000 + (seq++ % 1000);
  if (state?.i !== i || state?.rivet !== key) history.replaceState({ ...state, i, rivet: key }, "");
  shown = key;
}

/**
 * Before a navigation leaves the shown entry: take scroll restoration over from the browser (once)
 * and save the position. `here`: `history.state` still belongs to that entry (link clicks), so it
 * can be keyed now if no navigation keyed it yet.
 */
export function leave(here: boolean, i: number): void {
  if (!manual) {
    manual = true;
    history.scrollRestoration = "manual";
    // Reloads and cross-document traversals restore natively: hand control back while unloading.
    addEventListener("pagehide", () => (history.scrollRestoration = "auto"));
    addEventListener("pageshow", (event) => event.persisted && (history.scrollRestoration = "manual"));
  }
  if (here && shown === undefined) enter(i);
  if (shown === undefined) return;
  try {
    sessionStorage.setItem(SCROLL + shown, JSON.stringify([scrollX, scrollY]));
  } catch {
    /* Storage may be unavailable (private mode); scroll restoration degrades to top. */
  }
}

/** Restore the current entry's saved position; false when there is none. */
export function restoreScroll(): boolean {
  const state = history.state as EntryState;
  let position: [number, number] | null = null;
  if (typeof state?.rivet === "number") {
    try {
      position = JSON.parse(sessionStorage.getItem(SCROLL + state.rivet) ?? "null") as [number, number] | null;
    } catch {
      position = null;
    }
  }
  if (position) scrollTo(position[0], position[1]);
  return !!position;
}

/** Make `element` the focus (programmatically focusable when it is not already). */
export function focusOn(element: HTMLElement): void {
  if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
  element.focus({ preventScroll: true });
}

/** The element a URL's fragment names, if any. */
export function fragmentTarget(url: URL): HTMLElement | null {
  if (!url.hash) return null;
  try {
    return document.getElementById(decodeURIComponent(url.hash.slice(1)));
  } catch {
    return null;
  }
}

/** Hash-only navigation: scroll to and focus the fragment's target; no fragment scrolls to the top. */
export function reveal(url: URL): void {
  const target = fragmentTarget(url);
  if (target) {
    target.scrollIntoView();
    focusOn(target);
  } else if (!url.hash) scrollTo(0, 0);
}
