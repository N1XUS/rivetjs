// Ported from @radix-ui/react-scroll-area 1.3.0 (src/scroll-area.tsx `ScrollAreaViewportStyle`, `addUnlinkedScrollListener`,
// `useResizeObserver`), MIT, © 2022 WorkOS.
// Browser-only helpers of `index.tsx` (`.ts`: never server-rewritten; called from handlers / `clientEffect`s only).
// - `insertViewportStyle`: the declarations are inline on the Viewport (`HIDE_NATIVE_SCROLLBAR` in `index.tsx`: SSR + CSP safe); this
//   nonce'd stylesheet (one per document, client only — Radix renders a `<style>` next to every viewport) carries the
//   rule inline styles cannot express: `::-webkit-scrollbar` (WebKit without `scrollbar-width`).

/** Hides the native scrollbars cross-browser and enables momentum scroll on touch devices (Radix, attribute renamed). */
export const VIEWPORT_STYLE =
  "[data-rv-scroll-area-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-rv-scroll-area-viewport]::-webkit-scrollbar{display:none}";

const styledDocuments = new WeakSet<Document>();

/** Inserts the viewport stylesheet into `document.head` once (`nonce`: CSP nonce of the `<style>`). */
export function insertViewportStyle(nonce: string | undefined): void {
  if (styledDocuments.has(document)) return;
  styledDocuments.add(document);
  const style = document.createElement("style");
  if (nonce) style.setAttribute("nonce", nonce);
  style.setAttribute("data-rv-scroll-area-style", "");
  style.textContent = VIEWPORT_STYLE;
  document.head.appendChild(style);
}

/** A rAF loop calling `handler` whenever the scroll position changed (no scroll-linked effects). Returns the stop function. */
export function addUnlinkedScrollListener(node: HTMLElement, handler: () => void): () => void {
  let prevPosition = { left: node.scrollLeft, top: node.scrollTop };
  let rAF = 0;
  const loop = () => {
    const position = { left: node.scrollLeft, top: node.scrollTop };
    const isHorizontalScroll = prevPosition.left !== position.left;
    const isVerticalScroll = prevPosition.top !== position.top;
    if (isHorizontalScroll || isVerticalScroll) handler();
    prevPosition = position;
    rAF = window.requestAnimationFrame(loop);
  };
  loop();
  return () => window.cancelAnimationFrame(rAF);
}

/**
 * Radix `useResizeObserver`: `onResize` once per frame while `element` resizes (a rAF per notification avoids the
 * benign "ResizeObserver loop completed with undelivered notifications" error). Returns the stop function.
 */
export function observeResize(element: Element | null | undefined, onResize: () => void): () => void {
  if (!element) return () => {};
  let rAF = 0;
  const resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(rAF);
    rAF = window.requestAnimationFrame(onResize);
  });
  resizeObserver.observe(element);
  return () => {
    window.cancelAnimationFrame(rAF);
    resizeObserver.unobserve(element);
  };
}
