// `<Link active>` state: the link's path against the current page's. Rendered by `<Link>` (server:
// the request URL; browser renders: `location`); after client navigation the generated App re-marks
// every `a[data-rivet-active]` (`_markActive`, only in apps that use `active`).

/** Link active mode: `"exact"` (same path) or `"prefix"` (same path or below it). */
export type ActiveMode = "exact" | "prefix";

// One optional trailing slash is the same route (the matcher accepts it).
const trim = (path: string): string => (path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path);

/** `aria-current` for a link to `path` while the page is `here`: `page` on the page itself, `true` below it (prefix). */
export function currentOf(path: string, here: string, mode: ActiveMode): "page" | "true" | undefined {
  const to = trim(path),
    at = trim(here);
  if (to === at) return "page";
  return mode === "prefix" && at.startsWith(to === "/" ? "/" : to + "/") ? "true" : undefined;
}

/** @internal Generated App (apps using `<Link active>`): re-mark active links after a navigation commits. */
export function _markActive(): void {
  document.querySelectorAll<HTMLAnchorElement>("a[data-rivet-active]").forEach((anchor) => {
    const current = currentOf(anchor.pathname, location.pathname, anchor.getAttribute("data-rivet-active") as ActiveMode);
    if (current) (anchor.setAttribute("aria-current", current), anchor.setAttribute("data-current", ""));
    else (anchor.removeAttribute("aria-current"), anchor.removeAttribute("data-current"));
  });
}
