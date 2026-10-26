// Inline loader of the derived model (milestone M2 lane R, R2; spec docs/design/specs/2026-10-18-structural-resume-design.md
// §3.4). Serialized with String(fn) into the page right after the boundaries tail (`<script type="rivet/boundaries">`,
// `server-derived.ts` `derivedToString` / `renderDerived`), so it is self-contained: browser globals only.
//
// It reads nothing but the tail script's attributes until an event: `data-events` (delegated types, default
// "click input change submit keydown pointerdown pointerup mousedown mouseup focusin focusout": a cold press holds its
// pointer / mouse / focus events too, DERIVED-C), `data-rt` (the runtime URL: its default export is `dom-derived.ts`'s instance),
// `data-boot` (a boundary has a load / idle / visible trigger: start now). An event inside a boundary (`data-b`, or
// `<!--b<id>-->` openers before an ancestor) whose name listens to its type (tail v2 `n[i][2]`, D5 / ZERO R2; any other event acts
// natively: nothing listens there before the page adopts) goes to the runtime: when everything around its target is adopted now it
// runs live (`rt.on`); else it is held — click defaults (links, toggles, labels, summary, submit / reset), submit,
// invalid, the keys the boundary record lists (`k`) — and queued with its path and the target's form state, and the
// runtime replays it once the boundary chunks loaded (`rt.cold`). An event outside every listening boundary whose target is inside
// a `data-g` selector match goes to the document click listener's boundary (tail `g`, the router's links; M2-R5). Intent
// (pointerdown, focusin, touchstart) inside a listening boundary starts the runtime and
// loads the chunks of the listening boundaries around the target (`rt.w`). One chunk per
// boundary: tail `m`.
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
    parse = (): BoundaryTail => (tail ??= JSON.parse(script.textContent!));
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
  const api: DerivedLoaderApi = { q, m: retry, f: fail };
  const boot = (): Promise<DerivedRuntime> =>
    (booting ??= retry(script.dataset.rt!).then((module) => {
      rt = module.default as DerivedRuntime;
      rt.start(parse(), d, api);
      return rt;
    }));
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
    const at = ids(target, rt || q.length || type == "submit" || (target.form && !nc) ? "" : type);
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
    } else if (type == "invalid") replay = () => {};
    else if (type == "keydown") {
      // The keys the boundaries around the target handle (record `k`): held while the chunk loads.
      const key = (event as KeyboardEvent).key,
        keys = at.map((id) => parse().k?.[id]).join(" ");
      if ((" " + keys + " ").includes(" " + (key == " " ? "Space" : key) + " ")) event.preventDefault();
    }
    if (replay) event.preventDefault();
    const item: HeldEvent = [event, event.composedPath(), replay, [target.value, target.checked, d.activeElement]];
    rt ? rt.cold(item) : (q.push(item), boot().catch(fail));
  };
  const listen = (type: string, fn: (event: Event) => unknown, active?: boolean): void => d.addEventListener(type, fn, { capture: true, passive: !active });
  const im = window as Window & { __rvIM?: string };
  // Intent inside a listening record, or on a document click listener's match (`data-g`: the router's links).
  const warm = (event: Event): unknown =>
    (ids(event.target as Node, "").length || (event.target as Element).closest?.(script.dataset.g!)) && boot().then((r) => r.w(event.target), fail);
  listen("pointerdown", (event) => ((im.__rvIM = (event as PointerEvent).pointerType || "mouse"), warm(event)));
  listen("keydown", (event) => {
    const e = event as KeyboardEvent;
    if (!(e.metaKey || e.ctrlKey || e.key == "Shift")) im.__rvIM = "keyboard";
  });
  (script.dataset.events || "click input change submit keydown pointerdown pointerup mousedown mouseup focusin focusout")
    .split(" ")
    .map((type) => listen(type, on, !/^(touch|wheel|scroll)/.test(type)));
  listen("focusin", warm);
  listen("touchstart", warm);
  if (script.hasAttribute("data-boot")) boot().catch(fail);
  // Fetch-ahead (`data-fo`, DERIVED-C): after `load`, low-priority modulepreloads of the runtime + the page's boundary
  // chunks + their static closures (fetched and compiled, never evaluated): the first event evaluates modules already in
  // the module map instead of waiting on the import waterfall.
  const fo = script.dataset.fo;
  fo &&
    addEventListener("load", () =>
      fo.split(" ").map((href) => d.head.append(Object.assign(d.createElement("link"), { rel: "modulepreload", href, fetchPriority: "low" }))),
    );
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
