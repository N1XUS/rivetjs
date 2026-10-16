// Resume loader module (`@rivetjs/runtime/resume-loader-module`, manifest `loader`, state `data-ld`): the part of the
// resume loader no page needs before its first frame or first intent. The inline stub (`resume-loader.ts`) imports it
// with the first intent / interaction, or after the first frame on pages with `data-preload`; it is hashed and cached
// across pages. It owns:
// - scheduled prefetches (`data-preload`, streamed patches' `p`): eager after the first frame, idle, visible (and `P`:
//   visible within the background budget, also queued at idle);
// - the low-priority queue: at most two in flight, intent hints jump it (they are urgent), nothing starts during scroll;
//   chunk group / route siblings of chunks an interaction used and lazy imports of intent chunks go through it;
// - the idle evaluation of every prefetched module, so the interaction that needs it runs synchronously;
// - a lazy router's fetch-only chunks (`data-fo`), after the `load` event and the web fonts.
// No imports, not even `import()` (a bundler would wrap it in its preload helper, a static import): modules load
// through the stub's `api.m`.
import type { LoaderApi, PreloadEntry } from "./resume-format.ts";

type Plan = (string | PreloadEntry | null)[];

export default function loaderModule(api: LoaderApi): void {
  const add = api.a!,
    idle = api.c!,
    state = api.P!,
    lean = api.n,
    d = document,
    queue: string[] = [];
  let active = 0;
  const pump = (): unknown =>
    idle(() => {
      while (active < 2 && queue.length) {
        const url = queue.shift()!;
        // Already hinted: by intent (high priority, evaluated once loaded) not counted; fetch-only (`data-fo`, a lazy
        // router's runtime + chunks, never evaluated) evaluated now — a visible / eager plan asked for it, and its
        // runtime URL (plan[0]) must start the runtime so the first press runs synchronously.
        const hinted = api.h![url];
        hinted ? hinted == 2 && idle(() => warm(url)) : (active++, add(url));
      }
    });
  const later = (...urls: string[]): unknown => (queue.push(...urls), pump());
  // Evaluate a prefetched module. The runtime URL (a scheduled preload's plan[0]) also starts it, so a first press after
  // the preload runs synchronously (MATRIX-rt-1; only pages with `data-preload` schedule this).
  const warm = (url: string): void => {
    const i = state().c.indexOf(url);
    (i < 0 ? Promise.all([api.b!(), api.m!(url)]) : api.ensure([i])).catch(() => {});
  };
  api.w = (url, ok, urgent, dep) => {
    // Queued (low priority, evaluated): one less in flight. Fetch-only ones (`dep`) never count.
    if (!urgent && !dep) (active--, pump());
    if (ok && !dep) idle(() => warm(url));
  };
  api.u = (chunks, intent) => {
    const s = state();
    // Intent: the chunks' lazy imports; an interaction: the chunk group / route siblings of the chunks it used.
    if (intent) for (const i of chunks) later(...(s.l?.[i] || []));
    else if (!lean) for (const group of s.g || []) if (group.some((i) => chunks.includes(i))) later(...group.map((i) => s.c[i]!));
  };
  api.s = (plan: Plan): void => {
    if (lean) return;
    for (const [url, strategy, ids] of plan.slice(1) as PreloadEntry[])
      if (strategy == "e") later(plan[0] as string, url);
      else if (strategy == "i") idle(() => later(plan[0] as string, url));
      else {
        // `P` (a `v` chunk within the planner's background budget): also queued at idle (plan order, like an idle
        // one), so a below-the-fold widget is ready when scrolled to. Becoming visible moves a `v` / `P` chunk to the
        // queue front. Visible area, not `isIntersecting`: a clipped visually-hidden control (RA hidden select / date
        // input in a `position: fixed; top: 0` wrapper) intersects with zero area wherever its widget is.
        if (strategy == "P") idle(() => later(plan[0] as string, url));
        const observer = new IntersectionObserver(
          (entries) => entries.some((entry) => entry.intersectionRatio) && (observer.disconnect(), queue.unshift(plan[0] as string, url), pump()),
          { rootMargin: "100%" },
        );
        for (const id of ids!) {
          const node = d.querySelector('[data-r="' + id + '"]');
          // A path-addressed row element: the rows add-on (`$rw`) observes it at idle, once found from the row markers.
          node ? observer.observe(node) : (d as Document & { $rw?: (id: number, observer: IntersectionObserver) => unknown }).$rw?.(+id, observer);
        }
      }
  };
  // A lazy router's chunks + the runtime (`data-fo`): fetched at low priority, never evaluated, after the `load` event,
  // the page's web fonts and an idle slice (before the fonts they still delayed the LCP text: docs `/learn/resuming/`
  // Lighthouse LCP 1,353 / 1,956 ms bimodal after `load` alone), so a first link click finds them in the module map.
  // None under Save-Data / 2G (`lean`), like the scheduled prefetch. After the first paint too (its paint-timing entry):
  // on a fast load `load` can fire before it, and requests issued then sit on Lighthouse's simulated FCP / LCP path
  // (bridges demo `/`: 4.2 s vs 0.9 s; a `requestAnimationFrame` gate still ran before the frame was presented).
  // No `paint` entry type → no wait; a page that never paints contentfully → 1 s after `load` + fonts at the latest.
  const fetchOnly = (): unknown =>
    d.fonts.ready
      .then(
        () =>
          new Promise((paint) => {
            const Observer = self.PerformanceObserver;
            setTimeout(paint, 1e3);
            Observer?.supportedEntryTypes?.includes("paint") ? new Observer(paint).observe({ type: "paint", buffered: true }) : paint(0);
          }),
      )
      .then(() => idle(() => (api.x!.dataset.fo || "").split(" ").map((url) => url && add(url, 0, 1))));
  lean || (d.readyState == "complete" ? fetchOnly() : addEventListener("load", fetchOnly));
  // What the stub recorded before this module ran: hints (evaluated at idle; any still in flight evaluate once loaded
  // — `import()` waits for the fetch), interactions, plans.
  for (const url in api.h) if (api.h[url] == 1) idle(() => warm(url));
  for (const [chunks, intent] of api.U!.splice(0)) api.u(chunks, intent);
  for (const plan of api.S!.splice(0)) api.s(plan);
}
