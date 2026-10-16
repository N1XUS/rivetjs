// The islands-only lean boot (T7b): an inline classic script the server writes instead of the resume state + loader
// when a page's only resumables are framework islands with plain-value props (`lean.ts` decides per render). It reads
// the island records from the `<script type="rivet/islands">` right before it and, per island, applies the same policy
// trigger the resume runtime applies to a resumed island (`dom-resume` `when`: load / idle at idle, `interaction`,
// `visible` over the root's boxes, `idle` / `visible` chunk closures prefetched at idle, `media:`), imports the island chunk and hydrates (or, `only`, mounts) through the
// chunk's adapter, mounting over the server HTML when hydration throws — what `client.ts` `_drive` does without the
// Rivet runtime: no live props, callbacks, slots or nesting (the server never picks the lean tail for those).
// Serialized with Function#toString and minified by `build-boot.ts` into `boot.min.ts`: browser globals only, no
// imports, no free variables.

/**
 * Island record on the wire: [root id (`data-ri`), island chunk URL, framework props (JSON), policy, prefetch: the
 * chunk + its static imports, modulepreloaded at idle after the paint gate — `idle` / `visible` islands like the full
 * planner's `i` / `P` schedule, `load` / `only` islands the same way (no `<link>` in the HTML: high-priority preloads
 * issued during parse sat on the paint path)].
 */
export type LeanRecord = [id: string, url: string, props: Record<string, unknown>, on: string, prefetch?: string[]];

// Strings compare with `==` (same result for strings, fewer inline bytes).
export function boot(): void {
  const doc = document;
  const script = doc.currentScript as HTMLScriptElement;
  const records = JSON.parse((script.previousElementSibling as HTMLScriptElement).textContent!) as LeanRecord[];
  // Idle after the first paint (its paint-timing entry; one idle slice, shared): no island chunk or prefetch starts
  // before it — requests issued earlier sit on Lighthouse's simulated FCP / LCP path (bridges demo: the `load` islands'
  // vendor chunk, an in-viewport `visible` island; a `requestAnimationFrame` gate still ran before the frame was
  // presented). Fallbacks, so an island always mounts: no `paint` entry type → the idle slice alone; 1 s after `load`
  // at the latest (a page that never paints contentfully: hidden until an island reveals it, an empty `only` shell,
  // a 0×0 iframe — Safari / Firefox emit only `first-contentful-paint`); a first pointerdown / keydown opens it at once
  // (the user sees the page). A hidden tab / prerender waits for its paint (or the cap).
  let open!: (value?: unknown) => void;
  const idle = new Promise((go) => {
    open = go;
    const Observer = self.PerformanceObserver;
    const slice = (): unknown => (self.requestIdleCallback ?? setTimeout)(go as () => void);
    // The cap first (armed now when `load` already fired), so nothing below can keep the gate shut.
    const cap = (): unknown => setTimeout(slice, 1e3);
    doc.readyState == "complete" ? cap() : addEventListener("load", cap);
    Observer?.supportedEntryTypes?.includes("paint") ? new Observer(slice).observe({ type: "paint", buffered: true }) : slice();
  });
  const fail = (what: string) => (error: unknown) => console.error("[rivet:bridge] island " + what + ":", error);
  // Strict CSP: the idle prefetch links carry the boot script's nonce (`nonce` reads back from the element).
  const nonce = script.nonce;
  const fetched = new Set<string>();
  for (const [id, url, props, on, prefetch] of records) {
    const root = doc.querySelector('rivet-island[data-ri="' + id + '"]') as HTMLElement | null;
    if (!root) continue;
    const ctx = { id };
    // Before the trigger's own idle start: the closure is in flight when `import(url)` runs.
    if (prefetch)
      idle.then(() => {
        // `nonce` "" when the boot has none: the property only, no attribute.
        for (const href of prefetch)
          if (!fetched.has(href)) (fetched.add(href), doc.head.append(Object.assign(doc.createElement("link"), { rel: "modulepreload", href, nonce })));
      });
    const start = (): unknown =>
      idle
        .then(() => import(url))
        .then(async (mod: { default: unknown; adapter: { hydrate: Function; mount: Function } }) => {
          const adapter = mod.adapter;
          if (on == "only") {
            root.replaceChildren();
            root.style.display = "contents";
            return adapter.mount(root, mod.default, props, {}, ctx);
          }
          try {
            await adapter.hydrate(root, mod.default, props, {}, ctx);
          } catch {
            // Hydration mismatch / throw: mount fresh over the server HTML (the driver's recovery).
            root.replaceChildren();
            await adapter.mount(root, mod.default, props, {}, ctx);
          }
        }, fail("chunk failed to load"))
        .catch(fail("failed to start"));
    if (on == "interaction") {
      // Capture phase (`passive` would change nothing: neither event blocks scrolling).
      const types = ["pointerdown", "keydown"];
      const once = (): void => {
        for (const type of types) doc.removeEventListener(type, once, true);
        open();
        start();
      };
      for (const type of types) doc.addEventListener(type, once, true);
    } else if (on == "visible") {
      // `display: contents` root: observe its boxed descendants (at most 48, spread evenly); none → idle.
      const boxes: Element[] = [];
      const walk = (parent: Element): void => {
        for (const kid of parent.children) (kid as HTMLElement).style?.display == "contents" ? walk(kid) : boxes.push(kid);
      };
      walk(root);
      if (!boxes.length) start();
      else {
        const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && (observer.disconnect(), start()), {
          rootMargin: "100% 0px",
        });
        const n = Math.min(boxes.length, 48);
        for (let i = 0; i < n; i++) observer.observe(boxes[Math.floor((i * boxes.length) / n)]!);
      }
    } else if (on.startsWith("media:")) {
      const query = matchMedia(on.slice(6));
      const change = (): void => {
        if (!query.matches) return;
        query.removeEventListener("change", change);
        start();
      };
      query.addEventListener("change", change);
      change();
    } else start(); // load / idle / only (the resume runtime's `when`: idle after boot; here after the paint gate)
  }
}
