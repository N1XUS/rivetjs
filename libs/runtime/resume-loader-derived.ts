// Inline loader of the derived model (milestone M2 lane R, R2; spec docs/design/specs/2026-10-18-structural-resume-design.md
// §3.4). Serialized with String(fn) into the page right after the boundaries tail (`<script type="rivet/boundaries">`,
// `server-derived.ts` `derivedToString` / `renderDerived`), so it is self-contained: browser globals only.
//
// It reads nothing but the tail script's attributes until an event: `data-events` (delegated types, default
// "click input change submit keydown pointerdown pointerup pointercancel mousedown mouseup focusin focusout": a cold press holds its
// pointer / mouse / focus events too, DERIVED-C), `data-rt` (the runtime URL: its default export is `dom-derived.ts`'s instance),
// `data-boot` (a boundary has a load / idle / visible trigger: start now; `data-boot="<ids>"`, ZERO ABI-SPLIT: the page's only
// triggers are `visible` ones — start when the first element of one of those boundaries intersects the viewport). An event inside a boundary (`data-b`, or
// `<!--b<id>-->` openers before an ancestor) whose name listens to its type (tail v2 `n[i][2]`, D5 / ZERO R2; any other event acts
// natively: nothing listens there before the page adopts) goes to the runtime: when everything around its target is adopted now it
// runs live (`rt.on`); else it is held — click defaults (links, toggles, labels, summary, submit / reset), submit,
// invalid, a `contextmenu` inside the nearest `data-cm` (COLD-CTXMENU), the keys the target's nearest `data-rk` or the boundary record (`k`) lists — and queued with its path and the target's form state, and the
// runtime replays it once the boundary chunks loaded (`rt.cold`). An event outside every listening boundary whose target is inside
// a `data-g` selector match goes to the document click listener's boundary (tail `g`, the router's links; M2-R5). Intent
// (pointerdown, focusin, touchstart, keydown, a mouse / pen pointer resting 80 ms on an element) inside a listening
// boundary starts the runtime, fetches the page's fetch-ahead list at once (`data-fo`, high priority: no import
// waterfall) and loads the chunks of the listening boundaries around the target (`rt.w`). One chunk per boundary: tail
// `m`. Hover events (`pointerover` / `mouseover` / `…enter`) of a listening boundary boot like any held event (a pointer
// passing over adopts before the press: no click pays the adopt). With `data-fw="intent"` (ZERO ONDEMAND) they never boot
// by themselves: they are held until the pointer rests, and a held one whose target the pointer left is dropped (the state
// it would leave is "not hovered"; the page's CSS `:hover` drew the hover meanwhile).
// Fetch-ahead timing (`data-fw`, ZERO ONDEMAND): absent = after `load`, in the first idle period; `load` = right after
// `load`; `intent` = nothing before the first intent. None in the background under Save-Data or a 2G connection.
// Lazy parts (`data-fl`, IDLE-PREFETCH): pages with one ship the loader with `derivedFetchLater` in place of the fetch-ahead's
// link loop: once every fetch-ahead link loaded, the lazy parts follow in the next idle period, at low priority.
import type { DerivedLoaderApi, DerivedRuntime, HeldEvent } from "./dom-derived.ts";
import type { BoundaryTail } from "./resume-format.ts";

export function derivedLoader(): void {
  const d = document,
    script = d.currentScript?.previousElementSibling as HTMLScriptElement | null | undefined;
  if (!script) return;
  let tail: BoundaryTail | undefined,
    rt: DerivedRuntime | undefined,
    booting: Promise<DerivedRuntime> | undefined,
    // The element a replay re-dispatches on (its own event is not handled again).
    skip: Element | null | undefined;
  const q: HeldEvent[] = [],
    parse = (): BoundaryTail => (tail ??= JSON.parse(script.textContent!)),
    fo = script.dataset.fo,
    fw = script.dataset.fw,
    // `intent` pages: hover events are held without booting (the dwell decides).
    lazy = fw == "intent",
    hover = /^(pointer|mouse)(over|enter)$/,
    hovered = (n: EventTarget | null): unknown => (n as Element).matches?.(":hover"),
    // `intent` pages: drops the held hover events whose target the pointer left.
    prune = (): void => {
      if (lazy) for (let i = q.length; i--;) hover.test(q[i]![0].type) && !hovered(q[i]![0].target) && q.splice(i, 1);
    };
  // The fetch-ahead list as modulepreloads (fetched + compiled, never evaluated), once: low priority in the background,
  // high on intent.
  let ahead = (priority?: string): unknown =>
    fo &&
    ((ahead = () => {}),
    fo.split(" ").map((href) => d.head.append(Object.assign(d.createElement("link"), { rel: "modulepreload", href, fetchPriority: priority || "low" }))));
  // Reload unless prevented, at most once per page URL within 10 s (resume-loader.ts `fail`; without sessionStorage:
  // no reload — the serialized loader's navigation-type fallback did not fit the 1 KB budget).
  const fail = (error: unknown): void => {
    if (d.dispatchEvent(new CustomEvent("rivet:resume-error", { detail: error, cancelable: true })))
      try {
        const key = "rivet:reload:" + location.href,
          now = Date.now();
        if (!(now - +sessionStorage[key] < 1e4)) ((sessionStorage[key] = now), location.reload());
      } catch {}
  };
  const retry = (url: string): Promise<Record<string, unknown>> => import(url).catch(() => import(url + (url.includes("?") ? "&" : "?") + "r=" + Date.now()));
  const api: DerivedLoaderApi = { q, m: retry, f: fail, i: (node, type) => ids(node, type) };
  // Starts the runtime; an event / intent (not a trigger, `bg`) also fetches the fetch-ahead list at high priority.
  const boot = (bg?: unknown): Promise<DerivedRuntime> => (
    bg || ahead("high"),
    (booting ??= retry(script.dataset.rt!).then((module) => {
      prune();
      rt = module.default as DerivedRuntime;
      rt.start(parse(), d, api);
      return rt;
    }))
  );
  // The ids of the boundaries around a node whose name listens to `type` ("": to anything), innermost first (D5: tail v2
  // `n[i][2]` by name, a run's member through its template; a record not in the tail — streamed later — and a tail whose
  // names list no types: all).
  const ids = (node: Node | null, type: string): string[] => {
    const out: string[] = [],
      t = parse(),
      e = t.n.some((x) => x[2]),
      add = (id: string): unknown => {
        let x: any, k: number;
        // The record's name index (a run's member: its template slot's).
        if (e) for (const r of t.b as any[]) (k = +id - r[0]) < 0 || (r[3] < 0 ? k < r[4] * r[5].length && (x = r[5][k % r[5].length][2]) : k || (x = r[3]));
        return (x == null || ((x = t.n[x]![2]) && (!type || x == "*" || (" " + x + " ").includes(" " + type + " ")))) && out.push(id);
      };
    for (let n = node; n && n.nodeType != 9; n = n.parentNode) {
      const b = (n as Element).getAttribute?.("data-b");
      if (b) add(b);
      for (let s = n.previousSibling, depth = 0; s; s = s.previousSibling)
        if (s.nodeType == 8) {
          const x = (s as Comment).data;
          x == "/b" ? depth++ : /^b\d+$/.test(x) && (depth ? depth-- : add(x.slice(1)));
        }
    }
    return out;
  };
  const on = (event: Event): unknown => {
    const type = event.type,
      target = event.target as HTMLInputElement;
    // A replay's own click / submit (resume-loader.ts `on`).
    if (target == skip) return (type != "click" || skip!.localName == "a" || event.stopImmediatePropagation(), (skip = null));
    // The records around the target listening to this type: an event no record hears acts natively (not held, no boot).
    // Listening to anything: once the runtime runs (it filters by type itself) or an event is held (a press's later events
    // keep their order), and for a form control's / a form's events (the deferred units in the form adopt first).
    // A native automaton's control (`data-nc`, ZERO STATESPACE: a native switch's label, an accordion's summary): its state
    // is the browser's. No form control here (only records listening to the type hold its events), and its presses act
    // natively — a held press replays the cold-press focus emulation after the native activation already focused.
    const nc = target.closest?.("[data-nc]");
    if (nc && /^(pointer|mouse)(down|up)$/.test(type)) return;
    const at = ids(target, rt || booting || type == "submit" || (target.form && !nc) ? "" : type);
    // Outside every boundary inside a `data-g` match (the router's links): the document click listener's (tail `g`).
    at.length || !target.closest?.(script.dataset.g!) || at.push("");
    if (!at.length || rt?.on(event)) return;
    let replay: (() => void) | undefined;
    if (
      type == "click" &&
      !(
        (event as MouseEvent).button ||
        (event as MouseEvent).metaKey ||
        (event as MouseEvent).ctrlKey ||
        (event as MouseEvent).shiftKey ||
        (event as MouseEvent).altKey
      )
    ) {
      const el = (event.composedPath() as (HTMLInputElement & HTMLAnchorElement)[]).find((n) => n.matches?.("a[href],button,input,summary,label"))!,
        kind = el && (el.type || el.localName);
      // A native control's activation acts at once (a replayed, synthetic one would count as script focus:
      // `:focus-visible` after a mouse click); the held event still reaches the handlers around it.
      if (
        el?.localName == "a"
          ? !el.target && !el.hasAttribute("download")
          : /^(checkbox|radio|summary|label)$/.test(kind)
            ? !nc
            : el?.form && /^(submit|image|reset)$/.test(kind)
      )
        replay = () => ((skip = el), el.dispatchEvent(new (event.constructor as typeof MouseEvent)(type, event)), (skip = null));
    } else if (type == "submit") {
      const form = target as unknown as HTMLFormElement,
        submitter = (event as SubmitEvent).submitter;
      replay = () => ((skip = form), form.requestSubmit(submitter), (skip = null));
    }
    // A cold `contextmenu` inside a widget that opens its own menu (the nearest `data-cm`: cdk MenuTrigger
    // `trigger="contextMenu"`) holds the browser's menu; the replayed handler opens the widget's. Elsewhere (a link's
    // "open in new tab", text selection) the browser's menu shows: nothing says a handler cancels it.
    else if (type == "invalid" || (type == "contextmenu" && target.closest?.("[data-cm]"))) replay = () => {};
    else if (type == "keydown") {
      // The keys the target's widget handles (the nearest `data-rk`: cdk composites, slider thumbs, spin fields) and the
      // boundaries around it (record `k`): held while the chunk loads, so a cold key never acts natively (a range input
      // stepping, the page scrolling) before its handler replays. A text field without its own `data-rk` (a row's
      // editor inside a grid) keeps its caret keys: the nearest match is the field, which lists none.
      const key = (event as KeyboardEvent).key,
        keys =
          target.closest?.("[data-rk],textarea,input:not([type=checkbox],[type=radio],[type=range])")?.getAttribute("data-rk") +
          " " +
          at.map((id) => parse().k?.[id]).join(" ");
      if ((" " + keys + " ").includes(" " + (key == " " ? "Space" : key) + " ")) event.preventDefault();
    }
    if (replay) event.preventDefault();
    const item: HeldEvent = [event, event.composedPath(), replay, [target.value, target.checked, d.activeElement]];
    rt ? rt.cold(item) : (q.push(item), booting || !(lazy && hover.test(type))) && boot().catch(fail);
  };
  const listen = (type: string, fn: (event: Event) => unknown, active?: boolean): void => d.addEventListener(type, fn, { capture: true, passive: !active });
  const im = window as Window & { __rvIM?: string };
  // Intent inside a listening record, or on a document click listener's match (`data-g`: the router's links); with held
  // hover events (records that listen to hover), always.
  const warm = (event: Event): unknown => {
    const t = event.target as Element;
    return (q.length || ids(t, "").length || t.closest?.(script.dataset.g!)) && boot().then((r) => r.w(t), fail);
  };
  let dwell: ReturnType<typeof setTimeout> | undefined;
  listen("pointerdown", (event) => ((im.__rvIM = (event as PointerEvent).pointerType || "mouse"), warm(event)));
  listen("keydown", (event) => {
    const e = event as KeyboardEvent;
    if (!(e.metaKey || e.ctrlKey || e.key == "Shift")) im.__rvIM = "keyboard";
    warm(event);
  });
  // Hover intent: a mouse / pen pointer rests 80 ms. Before the runtime boots, the held hover events the pointer left are
  // dropped first: nothing held and nothing listening around the target, nothing loads.
  listen("pointerover", (event) => {
    clearTimeout(dwell);
    (event as PointerEvent).pointerType == "touch" || (dwell = setTimeout(() => (booting || prune(), hovered(event.target) && warm(event)), 80));
  });
  (script.dataset.events || "click input change submit keydown pointerdown pointerup pointercancel mousedown mouseup focusin focusout")
    .split(" ")
    .map((type) => listen(type, on, !/^(touch|wheel|scroll)/.test(type)));
  listen("focusin", warm);
  listen("touchstart", warm);
  // Triggers: start now. (`data-boot="<ids>"`, ZERO ABI-SPLIT: `DERIVED_LOADER_VISIBLE` runs `derivedVisibleBoot` here instead.)
  if (script.hasAttribute("data-boot")) boot(1).catch(fail);
  // Fetch-ahead (`data-fo`, DERIVED-C; timing `data-fw`, ZERO ONDEMAND): the runtime + the page's live boundary chunks +
  // their static closures as low-priority modulepreloads in the first idle period after `load` (default) or right after it
  // (`load`), so the first event evaluates modules already in the module map; `intent`: none before the first intent.
  // None in the background under Save-Data / 2G (intent still fetches).
  const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  lazy ||
    net?.saveData ||
    /2g/.test(net?.effectiveType!) ||
    addEventListener("load", () => (fw ? ahead() : (self.requestIdleCallback || setTimeout)(() => ahead())));
}

/**
 * Lazy-part prefetch (IDLE-PREFETCH 2026-10-27): on a page whose tail lists lazy parts (`data-fl`: the chunks of the
 * `lazyComponent(() => import(…))` parts its fetch-ahead list reaches, with their static closures), the server ships
 * `DERIVED_LOADER_LATER` (`DERIVED_LOADER_VISIBLE_LATER`) = the loader with this function called in place of the fetch-ahead's
 * link loop (`build-loader.ts` splices it in with the loader's minified names: every other page's loader is unchanged).
 * It appends the fetch-ahead modulepreloads as the loader does (`priority`, default low); once each of them loaded or
 * failed, the next idle period appends the lazy parts' modulepreloads at low priority, so they never compete with the
 * code every first interaction needs, and a later open of a lazy part evaluates a module already fetched (no round trip).
 * Never under Save-Data / 2G. Fetched + compiled, never evaluated: the part's `lazyComponent` imports it on use.
 */
export function derivedFetchLater(script: HTMLScriptElement, fo: string, priority?: string): void {
  const d = document,
    net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection,
    add = (href: string, fetchPriority: string): Promise<unknown> =>
      new Promise((done) => d.head.append(Object.assign(d.createElement("link"), { rel: "modulepreload", href, fetchPriority, onload: done, onerror: done })));
  Promise.all(fo.split(" ").map((href) => add(href, priority || "low"))).then(
    () =>
      net?.saveData ||
      /2g/.test(net?.effectiveType!) ||
      (self.requestIdleCallback || setTimeout)(() => script.dataset.fl!.split(" ").map((href) => add(href, "low"))),
  );
}

/**
 * Visible-only boot (ZERO ABI-SPLIT 2026-10-27): on a page whose only triggers are `visible` ones the tail says
 * `data-boot="<ids>"`, and the server ships `DERIVED_LOADER_VISIBLE` = the loader with this function called in place of
 * its `data-boot` start (`build-loader.ts` splices it in with the loader's minified names: every other page's loader is
 * unchanged). The runtime starts when the first element of one of those boundaries (a `data-b` element, else the first
 * element after its `<!--b<id>-->` opener, before a `<!--/b-->`) intersects the viewport — the runtime's own `visible`
 * trigger (`dom-derived.ts` `trigger`) then fires at once —, or now when there is no such element.
 */
export function derivedVisibleBoot(script: HTMLScriptElement, boot: (bg?: unknown) => Promise<unknown>, fail: (error: unknown) => void): void {
  const d = document,
    io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && (io.disconnect(), boot(1).catch(fail)));
  for (const id of script.dataset.boot!.split(" ")) {
    let el: Node | null = d.querySelector('[data-b="' + id + '"]');
    if (!el) {
      const walk = d.createTreeWalker(d, 128);
      while ((el = walk.nextNode()) && (el as Comment).data != "b" + id);
      while (el && el.nodeType != 1 && (el = el.nextSibling) && (el as Comment).data != "/b");
    }
    el?.nodeType == 1 ? io.observe(el as Element) : boot(1).catch(fail);
  }
}

/**
 * Streamed segment add-on (DERIVED-C2), shipped once before a derived page's first streamed segment (`server-derived.ts`
 * `segments`). `$rD(id)` runs at the end of each segment: its `<template data-a>` (when the segment has content) replaces
 * what is between `<!--a<id>-->` and its `<!--/a-->` (the fallback), its patch (`<script type="rivet/boundaries"
 * data-patch>`: new records, wake lists, chunk names, the settled `Async` entry) is queued on `document.$rd` for a runtime
 * that starts later, and handed to a started one (`document.$rdp`). Bound by position (the template, the patch, this call's
 * own script), never by a document query an injected earlier copy would win.
 */
export function derivedStream(): void {
  const d = document as Document & { $rd?: BoundaryTail[]; $rdp?: (patch: BoundaryTail) => void };
  (window as Window & { $rD?: (id: number) => void }).$rD = (id: number) => {
    const s = d.currentScript!,
      p = s.previousElementSibling!,
      t = p.previousElementSibling as HTMLTemplateElement | null,
      x: BoundaryTail = JSON.parse(p.textContent!);
    p.remove();
    s.remove();
    if (t?.getAttribute("data-a") == (id as unknown as string)) {
      const walker = d.createTreeWalker(d.body, 128);
      let n: Node | null,
        depth = 0;
      while ((n = walker.nextNode()) && (n as Comment).data != "a" + id);
      for (let c = n && n.nextSibling; c;) {
        const next: ChildNode | null = c.nextSibling,
          v = c.nodeType == 8 ? (c as Comment).data : "";
        if (/^a\d+$/.test(v)) depth++;
        else if (v == "/a" && !depth--) {
          c.before(t.content);
          break;
        }
        c.remove();
        c = next;
      }
      t.remove();
    }
    (d.$rd ??= []).push(x);
    d.$rdp?.(x);
  };
}
