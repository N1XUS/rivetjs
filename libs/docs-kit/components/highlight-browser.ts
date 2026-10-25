// The browser highlighter, started by `page-script.ts` (the plain module script docs pages link). Tiny: an
// IntersectionObserver over the page's plain code blocks; the shared highlighter chunk (highlighter.ts) loads when
// the first one comes near the viewport. Hidden tabs / closed `<details>` do not intersect, so they are coloured
// when shown. One block per task, so highlighting never holds the main thread for long.
// A .ts module: not server-rewritten (browser globals are fine).

/** Plain (not yet coloured) code blocks. */
export const CODE_SELECTOR = "pre[data-lang]:not([data-hl])";

/** Observe every not-yet-highlighted code block under `root` (or exactly the given blocks); returns the cleanup. */
export function watchCode(root: ParentNode | readonly HTMLElement[] = document): () => void {
  if (typeof IntersectionObserver !== "function") return () => {};
  const queue: HTMLElement[] = [];
  let running = false;
  const pump = async () => {
    if (running) return;
    running = true;
    try {
      const { highlightPre } = await import("./highlighter.ts");
      for (let pre = queue.shift(); pre; pre = queue.shift()) {
        await highlightPre(pre).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      running = false;
    }
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        queue.push(entry.target as HTMLElement);
      }
      // Nothing visible yet (initial callback of hidden blocks): no chunk load.
      if (queue.length) void pump();
    },
    { rootMargin: "200px 0px" },
  );
  for (const pre of Array.isArray(root) ? root : (root as ParentNode).querySelectorAll<HTMLElement>(CODE_SELECTOR)) observer.observe(pre);
  return () => observer.disconnect();
}
