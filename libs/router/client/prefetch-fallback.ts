// Document prefetch fallback for browsers without Speculation Rules (Safari, Firefox; Chromium with
// the feature off). Shipped inline (classic script, no imports): `build/prefetch-script.ts` minifies
// this function into `shared/prefetch-fallback.min.ts`; `shared/prefetch.ts` writes it into pages.
// Keep it self-contained: it is serialized with Function#toString.
//
// On intent — pointer resting 65 ms on a matching link (cancelled when it leaves), focus, touch or
// pointer down — the link's document is fetched once: `<link rel="prefetch" as="document">`, or a
// low-priority `fetch()` where `rel=prefetch` is unsupported (Safari; helps only cacheable responses).
// Skipped: other origins (and non-http(s): their origin is "null"), the current URL, Save-Data / 2g connections.
//
// Only cacheable HTML helps (the click must be allowed to reuse the copy): the first intent probes
// with a `no-store` fetch (no HTTP cache entry, so an early click never waits on it) and reads
// `cache-control` / `pragma`. `no-store`, `no-cache` or `max-age=0` without `stale-while-revalidate`
// turn prefetch off; else the probed URL is warmed and later intents prefetch. The verdict is kept
// per origin for the tab session (`sessionStorage["rivet:prefetch"]`: "1" / "0").
//
// `routes` (client-routed apps): matches the path of every route of the app. A link the router
// intercepts (path matches, not `data-rivet-reload` / `rel=external`) is skipped: it loads no document.
export function fallback(selector: string, routes?: RegExp): void {
  const d = document;
  if (HTMLScriptElement.supports?.("speculationrules")) return;
  const seen = new Set<string>(),
    rel = d.createElement("link").relList.supports?.("prefetch"),
    key = "rivet:prefetch",
    low = { priority: "low" } as RequestInit,
    options = { capture: true, passive: true },
    on = (type: string, fn: (event: Event) => void) => d.addEventListener(type, fn, options);
  let timer: ReturnType<typeof setTimeout> | undefined,
    over: Element | null = null,
    // "1" cacheable, "0" not, "" probing, 2 unknown (`state < 1`: no prefetch now).
    state: string | number = 2;
  try {
    state = sessionStorage.getItem(key) || 2;
  } catch {}
  const anchor = (event: Event) => {
    const link = (event.target as Element | null)?.closest?.(selector) as HTMLAnchorElement | null | undefined;
    return link && routes?.test(link.pathname) && !link.matches("[data-rivet-reload],[rel~=external]") ? null : link;
  };
  const go = (link: HTMLAnchorElement | null | undefined) => {
    const connection = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (!link || connection?.saveData || /2g/.test(connection?.effectiveType as string)) return;
    // Same origin only (also rules out mailto: / javascript:, whose origin is "null"); not this page.
    const href = link.href.split("#")[0]!;
    if (link.origin !== location.origin || href === location.href.split("#")[0] || seen.has(href) || (state as number) < 1) return;
    // Bounded: the oldest URL leaves (the browser's cache keeps what it fetched).
    if (seen.size > 99) seen.delete(seen.values().next().value!);
    seen.add(href);
    const warm = () =>
      rel ? d.head.append(Object.assign(d.createElement("link"), { rel: "prefetch", as: "document", href })) : fetch(href, low).catch(() => {});
    if (state == "1") return void warm();
    state = "";
    fetch(href, { ...low, cache: "no-store" }).then(
      (response) => {
        response.body?.cancel();
        const policy = response.headers.get("cache-control") + "," + response.headers.get("pragma");
        state = /no-(store|cache)|^(?!.*stale-while).*max-age=0\b/.test(policy) ? "0" : "1";
        try {
          sessionStorage.setItem(key, state);
        } catch {}
        if (state == "1") warm();
      },
      () => {
        state = 2;
        seen.delete(href);
      },
    );
  };
  on("pointerover", (event) => {
    const link = anchor(event) || null;
    if (link === over) return;
    clearTimeout(timer);
    over = link;
    if (link) timer = setTimeout(go, 65, link);
  });
  on("pointerout", (event) => {
    if (over && !over.contains((event as PointerEvent).relatedTarget as Node | null)) {
      clearTimeout(timer);
      over = null;
    }
  });
  for (const type of ["focusin", "touchstart", "pointerdown"]) on(type, (event) => go(anchor(event)));
}
