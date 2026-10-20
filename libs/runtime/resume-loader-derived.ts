// Inline loader of the derived model (milestone M2 lane R, R2; spec docs/design/specs/2026-10-18-structural-resume-design.md
// §3.4). Serialized with String(fn) into the page right after the boundaries tail (`<script type="rivet/boundaries">`,
// `server-derived.ts` `derivedToString` / `renderDerived`), so it is self-contained: browser globals only.
//
// It reads nothing but the tail script's attributes until an event: `data-events` (delegated types, default
// "click input change submit keydown"), `data-rt` (the runtime URL: its default export is `dom-derived.ts`'s instance),
// `data-boot` (a boundary has a load / idle / visible trigger: start now). An event inside a boundary (`data-b`, or
// `<!--b<id>-->` openers before an ancestor) goes to the runtime: when everything around its target is adopted now it
// runs live (`rt.on`); else it is held — click defaults (links, toggles, labels, summary, submit / reset), submit,
// invalid, the keys the boundary record lists (`k`) — and queued with its path and the target's form state, and the
// runtime replays it once the boundary chunks loaded (`rt.cold`). An event outside every boundary whose target is inside
// a `data-g` selector match goes to the document click listener's boundary (tail `g`, the router's links; M2-R5). Intent
// (pointerdown, focusin, touchstart) starts the runtime and loads the target boundary's chunk (`rt.w`). One chunk per
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
  // The boundary ids around a node, innermost first.
  const ids = (node: Node | null): string[] => {
    const out: string[] = [];
    for (let n = node; n && n.nodeType != 9; n = n.parentNode) {
      const b = (n as Element).getAttribute?.("data-b");
      if (b) out.push(b);
      for (let s = n.previousSibling, depth = 0; s; s = s.previousSibling)
        if (s.nodeType == 8) {
          const x = (s as Comment).data;
          x == "/b" ? depth++ : /^b\d+$/.test(x) && (depth ? depth-- : out.push(x.slice(1)));
        }
    }
    return out;
  };
  const on = (event: Event): unknown => {
    const type = event.type,
      target = event.target as HTMLInputElement;
    // A replay's own click / submit (resume-loader.ts `on`).
    if (target == skip) return (type != "click" || skip!.localName == "a" || event.stopImmediatePropagation(), (skip = null));
    const at = ids(target);
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
      if (
        el?.localName == "a"
          ? !el.target && !el.hasAttribute("download")
          : /^(checkbox|radio|summary|label)$/.test(kind) || (el?.form && /^(submit|image|reset)$/.test(kind))
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
    const item: HeldEvent = [event, event.composedPath(), replay, [target.value, target.checked]];
    rt ? rt.cold(item) : (q.push(item), boot().catch(fail));
  };
  const listen = (type: string, fn: (event: Event) => unknown, active?: boolean): void => d.addEventListener(type, fn, { capture: true, passive: !active });
  const im = window as Window & { __rvIM?: string };
  const warm = (event: Event): unknown => ids(event.target as Node).length && boot().then((r) => r.w(event.target), fail);
  listen("pointerdown", (event) => ((im.__rvIM = (event as PointerEvent).pointerType || "mouse"), warm(event)));
  listen("keydown", (event) => {
    const e = event as KeyboardEvent;
    if (!(e.metaKey || e.ctrlKey || e.key == "Shift")) im.__rvIM = "keyboard";
  });
  (script.dataset.events || "click input change submit keydown").split(" ").map((type) => listen(type, on, !/^(touch|wheel|scroll)/.test(type)));
  listen("focusin", warm);
  listen("touchstart", warm);
  if (script.hasAttribute("data-boot")) boot().catch(fail);
}
