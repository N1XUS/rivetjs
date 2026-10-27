// Policy triggers of client-created islands (`dom.tsx`): what the resume runtime's `when` (`dom-resume`) applies to
// server-rendered ones, plus `rootMargin` / `timeout` options. Kept out of `client.ts` so resumed pages' driver chunk
// carries none of it.
import type { Trigger } from "./client.ts";

/** Client-created islands: the policy trigger the resume runtime applies to server-rendered ones (`dom-resume` `when`). */
export const trigger: Trigger = (on, root, options, listen, stops, start, fetch) => {
  if (on === "load" || on === "only") return start();
  if (on === "idle") {
    const idle = (globalThis.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 1))) as (fn: () => void, o?: { timeout?: number }) => unknown;
    idle(start, typeof options.timeout === "number" ? { timeout: options.timeout } : undefined);
    return;
  }
  if (on === "interaction") {
    for (const type of ["pointerdown", "keydown"]) listen(root.ownerDocument, type, start);
    return;
  }
  if (on === "visible") {
    // User ruling 2026-10-27: fetched when the island nears the viewport (one viewport away: `fetch`, the island chunk
    // without hydrating), hydrated once it is visible — or both within `rootMargin` when the policy sets one.
    const watch = (go: () => void, rootMargin: string | undefined, root: Document | null): void => {
      const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && (observer.disconnect(), go()), {
        rootMargin,
        root,
      });
      for (const box of boxes) observer.observe(box);
      stops.push(() => observer.disconnect());
    };
    // The root is `display: contents`: observe its boxed descendants (the fallback), else the root as an empty block.
    const boxes: Element[] = [];
    const walk = (parent: Element): void => {
      for (const kid of parent.children) (kid as HTMLElement).style?.display === "contents" ? walk(kid) : boxes.push(kid);
    };
    walk(root);
    if (!boxes.length) {
      (root as HTMLElement).style.display = "block";
      boxes.push(root);
    }
    // An explicit `rootMargin`: fetched and hydrated within it. The near observer's root is the document: its margin also
    // applies inside an iframe.
    const margin = typeof options.rootMargin === "string" ? options.rootMargin : undefined;
    if (fetch && margin === undefined) watch(fetch, "100% 0px", root.ownerDocument);
    watch(start, margin, null);
    return;
  }
  if (on.startsWith("media:")) {
    const query = matchMedia(on.slice(6));
    if (query.matches) return start();
    listen(query, "change", () => query.matches && start(), false);
  }
};
