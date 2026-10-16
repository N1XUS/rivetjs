// Inline resume loader (the stub). Serialized with String(loader) into the page, so it must be
// self-contained: no imports, no free variables beyond browser globals.
//
// Before interaction it only parses two attributes and adds capture listeners. Intent
// (pointer dwell, focus, touch) starts the runtime and prefetches handler chunks and the chunks of bindings
// the handler can update, with modulepreload; pointerdown/keydown evaluates them so the following
// click (and its DOM update) runs synchronously. Cold events are held here (click defaults, form state at
// dispatch) and queued; the runtime replays them in dispatch order once it and their chunks loaded
// (dom-resume `cold`). The loader module (`resume-loader-module.ts`, state `data-ld`, imported with the
// first intent / interaction, or after the first frame on pages with `data-preload`) does the rest:
// scheduled eager / idle / visible prefetches, the low-priority queue (chunk group / route siblings, lazy
// imports) and the idle evaluation of every prefetched module.
// Cold keydown on a `data-rk` widget prevents the listed keys' default while its chunk loads (variant
// `LOADER_KEYS`, used by pages that recorded a keydown handler; others ship `LOADER` without it).
import type { ColdEvent, Hit, LoaderApi, LoaderDocument, PreloadEntry, ResumeInstance, ResumeState } from "./resume-format.ts";

type Connection = { saveData?: boolean; effectiveType: string };

/** Build flag (replaced by build-loader.ts): the cold-key branch, shipped only to pages with keydown handlers. */
declare const RIVET_KEYS: boolean;
export function loader(): void {
  // The page state is the element right before this script (the server writes them together): never a
  // document query, which would trust a `rivet/state` script injected earlier in the body (U2).
  const d = document as LoaderDocument,
    script = d.currentScript?.previousElementSibling as HTMLScriptElement | null | undefined;
  if (!script) return;
  let memo: [target?: EventTarget | null, type?: string, hit?: Hit] = [],
    state: ResumeState,
    rt: ResumeInstance,
    booting: Promise<ResumeInstance> | undefined,
    more: Promise<unknown> | undefined,
    // The element a replay re-dispatches on (its own event is not handled again).
    skip: Element | null | undefined,
    dwell: ReturnType<typeof setTimeout> | undefined,
    scrolled = 0;
  const done: LoaderApi["done"] = {},
    loading: Record<number, Promise<unknown>> = {},
    // Hinted URLs: 1 (2: a static import of a hinted chunk, never evaluated on its own).
    hinted: Record<string, number> = {},
    // Cold events before the runtime started (it replays them first, in order); work for the loader module before it ran.
    cold: ColdEvent[] = [],
    used: [chunks: number[], intent?: 1][] = [],
    plans: (string | PreloadEntry | null)[][] = [],
    net = (navigator as Navigator & { connection?: Connection }).connection,
    lean = net && (net.saveData || /2g/.test(net.effectiveType));
  // Run fn once no scroll happened for 150 ms.
  const calm = (fn: () => void): unknown => (performance.now() - scrolled < 150 ? setTimeout(calm, 150, fn) : fn());
  // Parse once (plus patches streamed so far, through the stream add-on).
  const parse = (): ResumeState => {
    if (state) return state;
    state = JSON.parse(script.textContent!);
    // Compact row templates: the expand add-on (`resume-expand.ts`, before the state script on pages with them).
    d.$rx?.(state, state.b);
    d.$rp?.(state);
    return state;
  };
  // Reload unless prevented, at most once per page URL within 10 s (a broken or CSP-blocked chunk must
  // not loop). Without sessionStorage: only a page that was not itself reloaded.
  const fail = (error: unknown): void => {
    if (d.dispatchEvent(new CustomEvent("rivet:resume-error", { detail: error, cancelable: true }))) {
      const key = "rivet:reload:" + location.href,
        now = Date.now();
      try {
        if (now - +sessionStorage[key] < 1e4) return;
        sessionStorage[key] = now;
      } catch {
        if ((performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type == "reload") return;
      }
      location.reload();
    }
  };
  // A failed module URL stays failed in the module map (and possibly in caches): retry once under a new URL.
  const retry = (url: string): Promise<Record<string, unknown>> => import(url).catch(() => import(url + (url.includes("?") ? "&" : "?") + "r=" + Date.now()));
  // The runtime is hinted like an interaction's chunk: with `data-deps`, its import closure comes in one round trip too.
  const boot = (): Promise<ResumeInstance> =>
    (booting ??= (add(parse().rt!, 1), retry(state.rt!)).then((module) => {
      rt = module.default as ResumeInstance;
      rt.start(state, d, api);
      return rt;
    }));
  const ensure = (chunks: number[]): Promise<unknown> =>
    Promise.all(chunks.map((i) => (loading[i] ??= retry(state.c[i]!).then((module) => (done[i] = module)))));
  // The loader module (manifest `loader`, state `data-ld`); a failed one only costs its prefetching.
  const load = (): unknown =>
    script.dataset.ld && (more ??= retry(script.dataset.ld).then((module) => (module.default as (api: LoaderApi) => void)(api))).catch(() => {});
  // Chunks an interaction (intent: and its extras) used: the loader module prefetches their siblings / lazy imports.
  const use = (chunks: number[], intent?: 1): unknown => (api.u ? api.u(chunks, intent) : used.push([chunks, intent]));
  const api: LoaderApi = {
    done,
    ensure,
    p: loading,
    q: cold,
    f: fail,
    a: add,
    h: hinted,
    c: idle,
    b: boot,
    P: parse,
    x: script,
    U: used,
    S: plans,
    n: lean,
    m: retry,
  };
  // `dep`: a static import of a hinted chunk: fetched with it, never evaluated on its own (its importer evaluates it,
  // in module order).
  function add(url: string, urgent?: number, dep?: number): void {
    if (hinted[url]) return;
    hinted[url] = dep ? 2 : 1;
    const link = d.createElement("link");
    link.rel = "modulepreload";
    link.href = url;
    if (!urgent) link.fetchPriority = "low";
    // The loader module evaluates it in a later idle slice (never during scroll), so the interaction that needs it finds
    // it ready and runs synchronously (one loaded before the module ran: at its start).
    link.onload = link.onerror = (event: Event | string) => api.w?.(url, (event as Event).type == "load", urgent, dep);
    d.head.append(link);
    // An interaction's chunk: its static import closure (`<chunk>.deps.js`, `data-deps` builds) at once, one round trip
    // after the chunk's own request instead of the waterfall `import()` walks. Only before the runtime started (after
    // it, the planner's preloads brought the shared closure: the extra requests only compete) and not over HTTP/1.1
    // (six connections: the extra requests queue ahead of the chunks).
    if (
      urgent &&
      !dep &&
      !rt &&
      script!.dataset.deps != null &&
      !/1\./.test((performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming)?.nextHopProtocol)
    )
      retry(url.slice(0, -3) + ".deps.js").then(
        (module) => (module.default as string[]).map((next) => add(next, 1, 1)),
        () => {},
      );
  }
  const hint = (url: string): void => add(url, 1);
  // Elements with a handler (or model) for the type: capture-phase entries (`type!`) outermost
  // first, then bubbling ones innermost first, as the event passes through them: [[element, id,
  // entry]…, chunks, extra chunks]. With type undefined (intent), the nearest element with any
  // handler; chunks then include the extras.
  const find = (event: Event, type?: string): Hit | undefined => {
    // pointerover / pointerdown (and keydown) of one target share a lookup.
    if (event.target == memo[0] && type == memo[1]) return memo[2];
    memo = [event.target, type];
    let hit: Hit | undefined, a: HTMLAnchorElement | null | undefined;
    const caps: Hit[0] = [];
    // Non-bubbling events (pointerenter, mouseleave, focus, scroll…) belong to their target only
    // (capture-phase entries of ancestors still run).
    for (const node of event.composedPath() as Element[]) {
      // Ids are digits: anything else (`constructor`, `__proto__` in crafted markup) is no table key. Path-addressed
      // row elements carry none: the rows add-on (`$rw`) reads theirs from the row markers.
      const id = (node.getAttribute?.("data-r") ?? d.$rw?.(node)) as string;
      if (/\D/.test(id)) continue;
      const s = parse(),
        handlers = s.e[id],
        model = s.m[id],
        own = (event.bubbles || node == event.target) && (!type ? Object.values(handlers || {}) : handlers?.[type] && [handlers[type]]),
        cap = type && handlers?.[type + "!"],
        modeled = model && (!type || type === (model[0] == "value" ? "input" : "change"));
      if (own || modeled || cap) {
        hit ||= [[], [], []];
        if (own || modeled) hit[0].push([node, id, (own || [])[0]]);
        if (cap) caps.unshift([node, id, cap]);
        const all = (own || []).concat(cap ? [cap] : []);
        for (const h of all) hit[1].push(...h[2]);
        hit[2].push(...all.flatMap((h) => h[3] || []).concat((modeled && model![2]) || []));
        if (!type) break;
      }
    }
    if (hit) hit[0] = caps.concat(hit[0]);
    // A root-relative link (`<Link>` renders those) with no handler of its own, on a page whose document
    // `click` listeners load on interaction (`n`: the router's link interception): intent prefetches them,
    // a click boots them (held, then replayed below). The target entry only makes the runtime attach them.
    else if ((a = (event.target as Element).closest?.("a[href^='/']") as HTMLAnchorElement) && parse().n) hit = [[[a]], state.n!, []] as unknown as Hit;
    return (memo[2] = hit);
  };
  // composedPath() is only valid during dispatch, so resolve the target before any delay.
  const prefetch = (hit: Hit, event?: Event): void => {
    if (hit[3]) return;
    hit[3] = 1;
    // Intent boots the runtime (chunks stay prefetch-only until pointerdown / keydown). On a lazy router page
    // (`n`) the runtime then attaches the router's listeners and replays the intent (`api.i`) to them.
    ((api.i = event), boot().catch(fail), load());
    for (const i of hit[1].concat(hit[2])) if (!state.x?.includes(i)) hint(state.c[i]!);
    use(hit[1].concat(hit[2]), 1);
  };
  const intent = (event: Event): void => {
    const hit = find(event);
    if (hit) prefetch(hit, event);
  };
  const evaluate = (event: Event): void => {
    const hit = find(event);
    if (hit && !(rt && hit[1].concat(hit[2]).every((i) => done[i]))) {
      prefetch(hit);
      Promise.all([boot(), ensure(hit[1].concat(hit[2]))]).catch(fail);
    }
  };
  const on = (event: Event): unknown => {
    const type = event.type;
    // A replay's own click / submit (once: a replayed toggle's input / change still dispatch). A held click default
    // (toggle, label, summary, submit button) replays for its default only: every listener saw the click already (live
    // ones at dispatch, delegated ones in `run`), so none sees it again — a live ancestor (an activated spread: RA
    // useToggle's label preventDefault) would cancel the toggle its replayed descendant stopped. A followed link's click
    // goes on (a router loaded meanwhile may route it), so does a replayed submit (the submission page listeners see).
    if (event.target == skip) return (type != "click" || skip!.localName == "a" || event.stopImmediatePropagation(), (skip = null));
    const hit = find(event, type);
    if (!hit) return;
    // Used chunks boost their chunk group / route siblings (loader module: low priority, scroll-guarded).
    use(hit[1]);
    // Live: the runtime runs the handlers now (nothing cold queued, chunks evaluated).
    if (rt?.on(event, hit)) return;
    let replay: (() => void) | undefined;
    const target = event.target as HTMLInputElement;
    if (
      type == "click" &&
      !(event as MouseEvent).button &&
      !(event as MouseEvent).metaKey &&
      !(event as MouseEvent).ctrlKey &&
      !(event as MouseEvent).shiftKey &&
      !(event as MouseEvent).altKey
    ) {
      // The click's activation target: a link it would follow in this tab, or a control whose default
      // (toggle, submit, reset, details open) would otherwise land before the handler can cancel it (C8):
      // held, then replayed with a click the loader skips. A `<label>` too: its native activation would click
      // the control before a handler that cancels the label click (RA useToggle) loads — toggling twice.
      const el = (event.composedPath() as (HTMLInputElement & HTMLAnchorElement)[]).find((n) => n.matches?.("a[href],button,input,summary,label"))!,
        kind = el && (el.type || el.localName);
      // A followed link replays as a click too: a listener loaded meanwhile (the router) may route it.
      if (
        el?.localName == "a"
          ? !el.target && !el.hasAttribute("download")
          : /^(checkbox|radio|summary|label)$/.test(kind) || (el?.form && /^(submit|image|reset)$/.test(kind))
      )
        // Replayed as a copy of the user's click (same pointer type, detail, coordinates; `el.click()` would be a
        // `detail: 0`, `pointerType: ""` click that cdk focus-visible / usePress count as a virtual click: keyboard
        // modality, a focus ring after a mouse click).
        // (Native event classes never throw here; a throwing custom constructor would leave `skip` set.)
        replay = () => ((skip = el), el.dispatchEvent(new (event.constructor as typeof MouseEvent)(type, event)), (skip = null));
    } else if (type == "submit") {
      const form = event.target as HTMLFormElement,
        submitter = (event as SubmitEvent).submitter;
      replay = () => ((skip = form), form.requestSubmit(submitter), (skip = null));
    } else if (type == "invalid") {
      // Native validation UI cannot wait for the handler (focusing a hidden control logs an error):
      // a queued `invalid` is canceled now; its handler reports when it replays (sees its own cancel).
      replay = () => {};
    } else if (RIVET_KEYS && type == "keydown") {
      // Composite widgets list the keys they handle (`data-rk="ArrowDown ArrowUp Space"`): held while
      // the chunk loads, so a cold arrow key never scrolls the page; the handler then runs as usual.
      const keys = target.closest?.("[data-rk]")?.getAttribute("data-rk"),
        key = (event as KeyboardEvent).key;
      if (keys && (" " + keys + " ").includes(" " + (key == " " ? "Space" : key) + " ")) event.preventDefault();
    }
    if (replay) event.preventDefault();
    // The target's form state at dispatch: later events' defaults (typed text, a toggle) land before this
    // one replays, so the runtime shows its handlers (and bindings) the state they would have seen (a
    // file input's `files` too: two quick picks replay each with its own selection). And the focused element: a cold
    // press's focus move lands natively (the browser's own mouse focus, no focus-visible), the runtime moves focus back
    // when a replayed handler canceled it (dom-resume `cold`).
    const item: ColdEvent = [event, hit, replay, [target.value, target.checked, target.files, d.activeElement]];
    // The runtime replays it once it and the chunks loaded (dom-resume `cold`), after every earlier cold event.
    // Before it started: its chunks load meanwhile (the runtime then waits for them, in order; it reports a failure).
    rt ? rt.cold(item) : (cold.push(item), boot().catch(fail), ensure(hit[1]).catch(() => {}));
    load();
  };
  // Intent listeners are passive; delegated handler types pass `active` unless scroll-blocking.
  const listen = (type: string, fn: (event: Event) => unknown, active?: boolean): void => d.addEventListener(type, fn, { capture: true, passive: !active });
  // Passive only where it matters (scroll-blocking touch / wheel); a loaded handler of any other
  // event can cancel it (mousedown keeping focus in a combobox, beforeinput, dragstart…).
  const handle = (type: string): unknown => type && listen(type, on, !/^(touch|wheel|mousewheel|scroll)/.test(type));
  // The last input modality before any chunk ran (`window.__rvIM`: a pointer type, or "keyboard" for RA's valid keys —
  // no Meta / Control chord, no lone modifier; Alt counts, as RA on macOS): cdk focus-visible adopts it when its
  // listeners install with the first chunk, so a cold pointer press does not count as keyboard modality (resume fuzz
  // T31 cold modality pins). Registered before the delegated handler listeners: a live handler installing focus-visible
  // during this very event must see it.
  const im = window as Window & { __rvIM?: string };
  listen("pointerdown", (event) => ((im.__rvIM = (event as PointerEvent).pointerType || "mouse"), evaluate(event)));
  listen("keydown", (event) => {
    const e = event as KeyboardEvent;
    // A lone Meta / Control keydown carries its own modifier flag; a lone Shift does not (Shift+Tab counts).
    if (!(e.metaKey || e.ctrlKey || e.key == "Shift")) im.__rvIM = "keyboard";
    evaluate(event);
  });
  (script.dataset.events || "").split(" ").map(handle);
  listen("pointerover", (event) => {
    clearTimeout(dwell);
    const hit = find(event);
    if (hit) dwell = setTimeout(prefetch, 60, hit, event);
  });
  listen("pointerout", () => clearTimeout(dwell));
  listen("scroll", () => (scrolled = performance.now()));
  listen("focusin", intent);
  listen("touchstart", intent);
  function idle(fn: () => void): unknown {
    return (window.requestIdleCallback || setTimeout)(() => calm(fn));
  }
  // Scheduled preloads (`data-preload`, streamed patches' `p`): the loader module, imported after the first frame.
  const schedule = (plan: (string | PreloadEntry | null)[]): unknown =>
    lean || (api.s ? api.s(plan) : (plans.push(plan), requestAnimationFrame(() => setTimeout(load))));
  if (script.dataset.preload) schedule(JSON.parse(script.dataset.preload));
  // A lazy router's fetch-only chunks (`data-fo`): the loader module hints them once the page loaded.
  if (script.dataset.fo) addEventListener("load", load);
  const start = () => idle(() => boot().catch(fail));
  if (script.hasAttribute("data-boot")) start();
  // Streamed boundaries (resume-stream add-on): parse, expand, listen, schedule, boot, runtime.
  d.$r = { p: parse, l: handle, s: schedule, b: start, r: () => rt, f: fail, x: script };
}
