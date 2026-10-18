// Spike S2 (derived client, docs/design/research/2026-10-18-beyond-resume-hydration.md §4 / §8): the inline loader a
// compiler would emit for this route. Nothing here runs app code: it holds the first events, fetches the route's
// derived slice ahead at idle (never evaluated before an input / trigger), evaluates it on the first input, visible
// trigger or scroll, and replays the held events. Budget ≤ 1 KB brotli minified.
(() => {
  const d = document;
  const q = []; // held events: [type, target, value]
  let m, p;
  // fetch-ahead of the route closure (slice + its lazy route), never evaluated by the hint itself
  const hint = () => {
    if (hint.done) return;
    hint.done = 1;
    for (const href of ["/d.js", "/detail.js"]) {
      const l = d.createElement("link");
      l.rel = "modulepreload";
      l.href = href;
      d.head.append(l);
    }
  };
  const load = () =>
    (p ||= import("/d.js").then((x) => {
      m = x;
      m.boot(JSON.parse(d.getElementById("rv").textContent));
      for (const e of q) m.replay(e);
      q.length = 0;
      return m;
    }));
  const on = (type, target, opts) =>
    target.addEventListener(
      type,
      (e) => {
        if (m) return m.dispatch(e);
        // cold: cancel what the handler would cancel (same-document link), snapshot, load, replay
        const a = type === "click" && e.target.closest && e.target.closest("a[href]");
        if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) e.preventDefault();
        q.push([type, e.target, e.target.value]);
        load();
      },
      opts,
    );
  on("click", d, true);
  on("input", d, true);
  on("scroll", window, { passive: true, capture: true });
  d.addEventListener("pointerover", hint, { passive: true, once: true });
  d.addEventListener("focusin", hint, { passive: true, once: true });
  d.addEventListener("pointerdown", () => load(), { passive: true, capture: true });
  d.addEventListener("keydown", () => load(), { passive: true, capture: true });
  // triggers: visible (canvas effect), idle (analytics chunk, independent of the slice)
  new IntersectionObserver((es, o) => {
    if (es.some((e) => e.isIntersecting)) {
      o.disconnect();
      load().then((x) => x.chart());
    }
  }).observe(d.getElementById("chart"));
  addEventListener("load", () => {
    requestIdleCallback(() => {
      hint();
      import("/a.js").then((a) => a.pageview(location.pathname));
      // Idle evaluation of the slice (definitions only, no page code) + the values parse, so the first input runs
      // synchronously — what Rivet's planner does for prefetched chunks ("evaluated in a later idle slice").
      requestIdleCallback(() => load());
    });
  });
  addEventListener("popstate", () => load().then((x) => x.route()));
})();
