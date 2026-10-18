// Client resume runtime. Loaded by the inline loader on first intent/interaction (or at idle when
// the page has client effects/events/client-only mounts). Never runs a server-rendered component:
// it decodes captures, revives signals, and activates bindings lazily when a signal they read
// first changes. A structural region is re-created through its DOM symbol (creation, not
// resumption); everything resumed inside it is disposed first.
import {
  signal,
  computed,
  effect,
  batch,
  createRoot,
  getOwner,
  runWithOwner,
  onCleanup,
  untrack,
  provide,
  _bindingEffect,
  _dispatch,
  _activating,
  catchError,
} from "@rivetjs/reactivity";
import { clientEvent, _matches, _warmLazy } from "./dom.ts";
import { _attrWrite, _delegateBelow } from "./dom-v2.ts";
import { _model } from "./dom-v2-controls.ts";
import { _takeover } from "./dom-v2-spread.ts";
import { _region, _ABSENT_STATE } from "./dom-adopt.ts";
import { createRouter } from "./dom-router.ts";
import { createDecoder, _placeholderContext } from "./resume-format.ts";
import { _rSyms } from "./resume-symbols.ts";
import { DEV } from "#dev";
import type { Context, Disposer, Owner, Signal } from "@rivetjs/reactivity";
import type { AdoptedBranch, AdoptedRow } from "./dom-adopt.ts";
import type {
  BindingEntry,
  BranchesSpec,
  RegionLocals,
  RegionProviders,
  RowReads,
  ClientEventEntry,
  EffectEntry,
  ColdEvent,
  HandlerEntry,
  Hit,
  LoaderApi,
  LoaderDocument,
  PackedBindings,
  ResumeInstance,
  ResumeRecords,
  ResumeState,
  RowsSpec,
  StatePatch,
  SymbolRef,
} from "./resume-format.ts";

// Packed repeated bindings (name "+", `PackedBindings` at [8]) → one entry per row and template binding, in order.
// Names held in the table (`...names` spreads: a number) are read back from it.
const unpack = (list: BindingEntry[], table: readonly unknown[]): BindingEntry[] => {
  let packed = false;
  for (const entry of list) {
    if (typeof entry[1] === "number") entry[1] = table[entry[1]] as string;
    else if (entry[1] === "+") packed = true;
  }
  if (!packed) return list;
  const out: BindingEntry[] = [];
  for (const entry of list) {
    if (entry[1] !== "+") {
      out.push(entry);
      continue;
    }
    const { i, d, ids, k, n, r, b, g } = entry[8] as PackedBindings;
    for (const item of b) if (typeof item[1] === "number") item[1] = table[item[1]] as string;
    for (let row = 0; row < k; row++) {
      const base = ids ? ids[row]! : i! + row * d!,
        // `g`: each row in its own region, shifted like its nodes.
        region = g ? entry[6] + base - (ids ? ids[0]! : i!) : entry[6];
      for (const [offset, name, symbol, refs, signals, chunks] of b)
        out.push([base + offset, name, symbol, refs.map((ref) => (ref < 0 ? r[row * n - 1 - ref]! : ref)), signals, chunks, region]);
    }
  }
  return out;
};

/** Client resume runtime; export it as the default of the app's resume entry module. */
export interface ResumeRuntime {
  readonly __brand: "rivet.resume";
}
/** A registered binding entry; activates once (on a dependency change or its mount trigger). */
interface Binding {
  entry: BindingEntry;
  active: boolean;
  /** Dev only: what activated it (`resume.region` cause). */
  cause?: string;
}
/** A resumed symbol: called with decoded captures, it returns the binding read / handler / effect. */
type SymbolFn = (...captures: unknown[]) => unknown;
/** Paired server markers of a text binding or region. */
interface Markers {
  start: Comment;
  end: Comment | null;
}

const primitive = (value: unknown): boolean => value == null || (typeof value !== "object" && typeof value !== "function");
// A resumed form control still shows the server-rendered state: `next` equals its `default*` property.
const keepLive = (el: Element, name: string, next: unknown): boolean =>
  (name === "value" ? (next == null ? "" : String(next)) : Boolean(next)) ===
  (el as unknown as Record<string, unknown>)["default" + name[0]!.toUpperCase() + name.slice(1)];
// A resumed attribute binding over server markup (DOM v2 attribute semantics, `_attrWrite`; an empty HTML class
// removes the attribute). Its first run leaves live form state (`value` / `checked` / `selected` the user changed
// before the binding activated) alone while the value still is what the server rendered.
const bindAttr = (el: Element, name: string, read: () => unknown): void => {
  name = name === "className" ? "class" : name === "htmlFor" ? "for" : name;
  const lower = name.toLowerCase(),
    html = el.namespaceURI === "http://www.w3.org/1999/xhtml";
  let live = html && (lower === "value" || lower === "checked" || lower === "selected") && lower in el;
  _bindingEffect(() => {
    const value = read(),
      keep = live;
    live = false;
    if (keep && keepLive(el, lower, value)) return;
    if (html && lower === "class" && value === "") el.removeAttribute("class");
    else _attrWrite(el, name, value);
  });
};
const idle = (fn: () => void): unknown => (globalThis.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1)))(fn);
const ROOT = -1;
// A cold event replays after the defaults of the events dispatched behind it (the text typed after a
// keydown, a checkbox toggled after its keydown, a second file pick): its target shows the `value` /
// `checked` / `files` it had at dispatch (the loader's `live`) while the event's handlers (and the
// bindings they flush) run, so a binding re-applying stale state writes nothing the user would lose;
// the live state comes back after the event (microtask, before the next replay) unless a handler /
// binding changed it meanwhile (a radio: also the group radio the swap unchecked). A file input's `value`
// follows its `files` (and only takes "").
const shown = new WeakSet<Event>();
const show = (event: Event, live: unknown[]): void => {
  shown.add(event);
  // A cold `load` / `error` replayed from a server-rendered `<img>` can arrive without a target.
  if (!event.target) return;
  const el = event.target as HTMLInputElement & Record<string, unknown>,
    from = el.selectionStart,
    to = el.selectionEnd;
  ["value", "checked", "files"].forEach((key, i) => {
    const then = live[i],
      now = el[key];
    if (then === undefined || now === then || !(key in el) || (!i && el.type == "file")) return;
    // A radio checked by the swap unchecks its group's checked radio: that one comes back with the live state.
    const sibling =
      i == 1 && el.type == "radio" && el.name
        ? [...((el.form || el.getRootNode()) as ParentNode).querySelectorAll<HTMLInputElement>("input[type=radio]:checked")].find(
            (r) => r != el && r.name == el.name && r.form == el.form,
          )
        : null;
    el[key] = then;
    queueMicrotask(() => {
      if (el[key] !== then) return;
      el[key] = now;
      if (sibling && !now && !sibling.checked) sibling.checked = true;
      if (!i && from != null) el.setSelectionRange(from, to);
    });
  });
};
// A plain, uncancelled primary click on a link it would follow in this tab, or a real submit of a form
// it would submit in this tab (the loader's replay rule): cancel it, keep its replay (`h`), track
// whether a handler cancels it too (`p`), across the listeners still loading (`n`).
type Hold = { h: () => unknown; p: boolean; n: number };
const holds = new WeakMap<Event, Hold>();
// Native resubmit: requestSubmit keeps the submitter (name/value, formaction/formmethod/formenctype)
// and validation, but would dispatch `submit` again; a window capture listener stops that dispatch
// (no listener, the loader's included, sees it twice) while the default submission still proceeds.
const stop = (e: Event) => e.stopImmediatePropagation();
const cold = (e: Event): Hold | undefined => {
  const t = e.target as HTMLFormElement & Element,
    s = (e as SubmitEvent).submitter as HTMLButtonElement | null;
  let l: HTMLAnchorElement | null | undefined;
  const h = e.defaultPrevented
    ? 0
    : e.type == "submit"
      ? e.isTrusted &&
        !(s?.formTarget || t.target) &&
        (() => {
          addEventListener("submit", stop, true);
          t.requestSubmit(s?.form == t ? s : null);
          removeEventListener("submit", stop, true);
        })
      : !((e as MouseEvent).button || (e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey || (e as MouseEvent).shiftKey || (e as MouseEvent).altKey) &&
        (l = t.closest?.<HTMLAnchorElement>("a[href]:not([target],[download])")) &&
        (() => location.assign(l!.href));
  if (!h) return;
  const hold: Hold = { h, p: false, n: 0 };
  e.preventDefault();
  Object.defineProperties(e, { preventDefault: { value: () => (hold.p = true) }, defaultPrevented: { get: () => hold.p } });
  holds.set(e, hold);
  return hold;
};
// A mousedown's default focus target: the nearest focusable inclusive ancestor (the browser's own `tabIndex` says
// which: natively focusable elements report >= 0, `tabindex="-1"` ones carry the attribute; disabled controls and
// href-less links report 0 but take no focus), `[null]` when focus just leaves; undefined where the default does more
// than focus (text entry, selects, range thumbs, drags) or for another button.
const pressTarget = (event: Event): [HTMLElement | null] | undefined => {
  let el = event.target as HTMLElement | null;
  if (
    (event as MouseEvent).button ||
    (event as PointerEvent).isPrimary === false ||
    el?.closest?.(":read-write,select,[draggable=true]") ||
    (el as HTMLInputElement)?.type == "range"
  )
    return;
  while (el && (!(el.tabIndex >= 0 || el.hasAttribute?.("tabindex")) || el.matches?.(":disabled,a:not([href],[tabindex])"))) el = el.parentElement;
  return [el];
};
// Resumed handlers run from a delegated (document) listener or after their chunk loaded (dispatch
// over): shadow `currentTarget` with the handler's own target for the call, like a direct listener.
// A data property (as in dom-v2 `dispatch`): an accessor closure per call would be pinned by V8's map
// descriptors and retain the event path.
// Replayed (loader-canceled) events a handler canceled, and replayed `invalid`s whose default is scheduled (`dispatch`).
const canceled = new WeakSet<Event>(),
  invalids = new WeakSet<Event>(),
  // Cold keyboard replays (`dispatch`): elements a replayed handler moved focus away from → when; replayed key events seen.
  blurredAt = new WeakMap<Element, number>(),
  keyed = new WeakSet<Event>();
const KEY_EVENT = /^(?:key(?:down|press|up)|beforeinput)$/;
const at = (event: Event, current: EventTarget | null, fn: () => unknown, path?: EventTarget[]): unknown => {
  Object.defineProperty(event, "currentTarget", { configurable: true, value: current });
  // A clientEvent handler whose chunk loaded after the dispatch ended: `composedPath()` is empty by then, so the
  // handler sees the path recorded at event time (an outside-press check would take every press for outside).
  const late = path && event.eventPhase === 0;
  if (late) Object.defineProperty(event, "composedPath", { configurable: true, value: () => path });
  try {
    return fn();
  } finally {
    delete (event as { currentTarget?: unknown }).currentTarget;
    if (late) delete (event as { composedPath?: unknown }).composedPath;
  }
};

// Live props (LIVE-PROPS P3): a decoded forward box (`[key, …sources]`: the last source whose `key` is not
// `undefined`) and the props object rebuilt around them. Same brand + reading rule as `props.ts` `_members` (member
// capture prologues in symbol chunks); kept local so the resume runtime chunk does not import `props.ts` (rolldown
// would split it into a shared chunk: one more request before the first interaction).
const FORWARD: unique symbol = Symbol.for("rivet.forward") as never;
function liveProps(args: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i] as string,
      v = args[i + 1];
    const box = v !== null && typeof v === "object" ? (v as { [FORWARD]?: Record<string, unknown>[] })[FORWARD] : undefined;
    if (box)
      Object.defineProperty(out, key, {
        enumerable: true,
        configurable: true,
        get() {
          const name = box[0] as unknown as string;
          for (let s = box.length - 1; s > 0; s--) {
            const value = box[s]![name];
            if (value !== undefined) return value;
          }
          return undefined;
        },
      });
    else if (key === "__proto__") Object.defineProperty(out, key, { value: v, writable: true, enumerable: true, configurable: true });
    else out[key] = v;
  }
  return out;
}

// A delegated hit's handlers, each element's in order (capture-phase entries outermost first, then bubbling ones),
// until one stops propagation; whether one canceled the event.
const deliver = (rt: ResumeInstance, event: Event, targets: Hit[0], replaying?: boolean, live?: unknown[]): boolean => {
  let prevented = false;
  for (const [element, id, entry] of targets) {
    prevented = rt.dispatch(event, element, id, event.type, replaying, entry, live).prevented || prevented;
    if (event.cancelBubble) break;
  }
  return prevented;
};
/** Create the runtime. Context values used by captures are provided here by token id. */
export function createResume(options?: { contexts?: Array<[Context<unknown>, unknown]> }): ResumeRuntime;
/** Create the runtime instance a resume entry module exports as default. */
export function createResume({ contexts = [] }: { contexts?: Array<[Context<unknown>, unknown]> } = {}): ResumeRuntime {
  const byId = new Map(contexts.map(([token, value]) => [token.id, value]));
  let state: ResumeState,
    doc: Document,
    api: LoaderApi,
    decoder: ReturnType<typeof createDecoder>,
    root: Owner | null,
    comments: Map<number, Markers> | null | undefined,
    elements: Map<string, HTMLElement> | null | undefined;
  const stubs = new Map<number, Binding[]>(); // signal ref → [binding]
  const readers = new WeakMap<Signal<unknown>, Binding[]>(); // armed signal → its stubs (`rivet.warm`)
  let chained: WeakMap<Comment, number> | null = null; // id-less marker start → the id an earlier scan read (patch)
  let current: Event | null = null; // the event whose resumed handler is running
  // Cold events (held by the loader) replay in dispatch order: each waits for the previous one, whatever chunk lands
  // first; `held` counts those queued (a live event then queues too, behind them).
  let chain: Promise<unknown> = Promise.resolve(),
    held = 0,
    // Cold press bookkeeping: the last cold pointerdown press recorded (its mousedown links to it).
    down: Event | undefined;
  // Cold presses: a pointerdown and its mousedown, both queued (the pointerdown puts focus back, the mousedown follows).
  const linked = new WeakSet<Event>(),
    // A pressed element whose native focus move a replayed handler canceled → per canceled press (in replay = dispatch
    // order): the element focused at its dispatch, when it was undone, its dispatch time. A later-replayed press
    // dispatched before the undo puts focus back past it, walking strictly back in dispatch time (A B A canceled: the
    // second A's entry never leads back to B's, no cycle).
    undone = new WeakMap<Element, [was: Element | null, at: number, dispatched: number][]>();
  const pendingSignals: [ref: number, source: Signal<unknown>][] = [];
  const refRegions = new Map<Element, number>(); // ref() element → its region (reset the ref when the region dies)
  // `load` / `idle` clientEvent listeners wait for idle, unless an interaction comes first: its handlers
  // may dispatch document / window events (a toast queued by the first click), so they attach before.
  const eager: (() => void)[] = [];
  // Each drain that attached listeners says so (`rivet:attach`): a router `navigate()` / forms submit made before the
  // App's `rivet:go` listener attached asks again then (no polling).
  const drain = (): void => {
    if (!eager.length) return;
    while (eager.length) eager.shift()!();
    doc.dispatchEvent(new Event("rivet:attach"));
  };
  // Z1: the link intent that booted a lazy router page, while its pending listeners attach (`start`).
  let replayIntent: Event | null = null;
  const parents = new Map<number, number>(); // region id → parent region id
  const owners = new Map<number, { owner: Owner | null; dispose: Disposer }>(); // region id → { owner, dispose } of what was resumed inside it
  const dead = new Set<number>(); // regions whose server content was replaced
  const regionBindings = new Map<number, Binding>(); // region id → its binding (streamed boundaries continue through it)
  const catches = new Map<number, number>(); // ErrorBoundary content region → its site (re-created on a failure)
  const registered: Binding[] = []; // initial-state bindings, in order (speculative resume)
  // Dev (`dispose()`): the page stopped resuming; the root's disposer.
  let stopped = false,
    stopRoot: Disposer | undefined,
    // Dev: the cause the next activate() records (`resume.region`).
    cause: string | undefined;
  const report = (ref: SymbolRef, error: unknown): void => {
    // A deploy skew `symbol()` already handed to the loader's `fail`.
    if ((error as { skew?: string } | null)?.skew && (doc as LoaderDocument).$r) return;
    doc.dispatchEvent(new CustomEvent("rivet:resume-error", { detail: { symbol: named(ref), error } }));
    if (globalThis.console) console.error(error);
  };
  // Page symbols (`state.s`, streamed patches append): index → id / chunk index, decoded as far as first needed.
  const ids: string[] = [],
    homes: number[] = [];
  let listed = 0,
    home = -1,
    unit = "",
    component = "";
  const named = (ref: SymbolRef): string => {
    if (typeof ref === "string") return ref;
    for (const list = state.s; listed < list.length && ids.length <= ref; listed++) {
      const x = list[listed]!;
      if (typeof x === "number") {
        home = x;
        continue;
      }
      // `$a$b…`: a run of ids of the previous id's module + component.
      if (x[0] === "$" && !x.includes("#")) {
        for (const suffix of x.slice(1).split("$")) (ids.push(unit + "#" + component + "$" + suffix), homes.push(home));
        continue;
      }
      const id = x[0] === "#" ? unit + x : x,
        hash = id.indexOf("#"),
        dollar = id.lastIndexOf("$");
      unit = id.slice(0, hash);
      component = dollar > hash + 1 ? id.slice(hash + 1, dollar) : "";
      ids.push(id);
      homes.push(home);
    }
    return ids[ref]!;
  };
  const symbol = (ref: SymbolRef): SymbolFn => {
    const id = named(ref),
      at = typeof ref === "number" ? homes[ref] : undefined,
      module = at === undefined ? undefined : api.done[at];
    if (!module)
      throw new Error(
        DEV
          ? DEV.hint(
              "Resume symbol is not loaded: " +
                id +
                (at === undefined ? " (the page state lists no chunk for it)" : " (chunk " + state.c[at] + " has not loaded)"),
              "skew",
            )
          : "Resume symbol is not loaded: " + id,
      );
    // A placed symbol module registered its table by module id (`_rSym`, route mode); multi-module (chunk group) chunks
    // resolve ids themselves (`__rivet`: names may repeat across modules); else the chunk exports the symbol by name.
    const hash = id.indexOf("#"),
      table = _rSyms[id.slice(0, hash)];
    const fn = (table?.[id.slice(hash + 1)] ?? (module.__rivet ? (module.__rivet as (id: string) => unknown)(id) : module[id.slice(hash + 1)])) as
      SymbolFn | undefined;
    if (typeof fn == "function") return fn;
    // Deploy skew: the chunk (another build) has no such symbol — ids are content hashes, so the page's code is gone.
    // Never run another function: the loader's guarded `fail` (cancelable `rivet:resume-error` {skew}, then a reload).
    const error = Object.assign(new Error((DEV ? "Resume symbol is missing from its chunk (deploy skew): " : "Resume symbol is not loaded: ") + id), {
      skew: id,
    });
    (doc as LoaderDocument).$r?.f(error);
    throw error;
  };
  // `data-r` id → element, built by one document query on first use (a list's 1,000 row bindings would
  // otherwise query the whole document 1,000 times); reset with the markers when a streamed segment
  // lands. A miss or a disconnected element (replaced since) falls back to a query; a server element the page has
  // removed since (a filtered collection row) and no replacement: the binding writes the detached element (its
  // update is unobservable) instead of failing the dispatch.
  // Path-addressed list rows (state `w`, no `data-r`): each row's elements from its root (the element before its end
  // marker `<!--]-->`, or its anchor `data-r`) by child index, the tag checked; `pathIds` maps them back (`q`).
  let pathIds: WeakMap<Element, string> = new WeakMap();
  const build = (): Map<string, HTMLElement> => {
    if (!elements) {
      elements = new Map();
      // Ids are unique in server output; a duplicate is injected markup (sanitized HTML must strip
      // `data-r` / `data-rk`). The first in document order keeps the id (dev: warning).
      for (const el of doc.querySelectorAll<HTMLElement>("[data-r]"))
        if (!elements.has(el.dataset.r!)) elements.set(el.dataset.r!, el);
        else if (DEV) DEV.resumeDuplicate(el.dataset.r!);
      pathIds = new WeakMap();
      for (const [first, stride, count, paths, anchor] of state.w ?? []) {
        const steps = paths.map((path) => path.split(/[:.]/));
        for (let k = 0, row = first; k < count; k++, row += stride) {
          const root = anchor ? elements.get("" + (row + 1)) : markers().get(row)?.end?.previousElementSibling;
          if (root)
            for (let j = 0; j < steps.length; j++) {
              let node: Element | undefined = root;
              for (let i = 1; node && i < steps[j]!.length; i++) if (steps[j]![i]) node = node.children[+steps[j]![i]!];
              const id = "" + (row + 1 + j);
              if (node?.localName === steps[j]![0] && !elements.has(id)) (elements.set(id, node as HTMLElement), pathIds.set(node, id));
            }
        }
      }
    }
    return elements;
  };
  const element = (id: number | string): HTMLElement => {
    const elements = build();
    const known = elements.get((id = "" + id)),
      node = known?.isConnected ? known : (doc.querySelector<HTMLElement>('[data-r="' + id + '"]') ?? known);
    if (!node) throw new Error(DEV ? DEV.hint("Missing resumable element " + id, "drift") : "Missing resumable element " + id);
    elements.set(id, node);
    return node;
  };
  // A resumed binding inside ErrorBoundary content failed: re-create the boundary's site region in the browser (its DOM
  // ErrorBoundary renders the content again, catching the failure, and shows the fallback). False: no live boundary.
  const caught = (region: number | undefined, error: unknown): boolean => {
    for (let r = region; r !== ROOT && r !== undefined; r = parents.get(r)) {
      const binding = catches.has(r) ? regionBindings.get(catches.get(r)!) : undefined;
      if (!binding || isDead(r)) continue;
      if (DEV) cause = "an error in its ErrorBoundary content (" + String((error as Error)?.message ?? error) + ")";
      if (!binding.active) activate(binding);
      if (DEV) cause = undefined;
      return true;
    }
    return false;
  };
  const isDead = (region: number | undefined): boolean => {
    if (DEV && stopped) return true;
    for (let r = region; r !== ROOT && r !== undefined; r = parents.get(r)) if (dead.has(r)) return true;
    return false;
  };
  const ownerOf = (region: number | undefined): Owner | null => {
    if (region === ROOT || region === undefined) return root;
    let scope = owners.get(region);
    if (!scope) {
      // ErrorBoundary content: later failures of its resumed bindings (effect re-runs) go to the boundary.
      const created = runWithOwner(ownerOf(parents.get(region)), () =>
        createRoot(() => (catches.has(region) ? catchError(getOwner, (error) => caught(region, error) || report("", error))! : getOwner())),
      );
      owners.set(region, (scope = { owner: created.value, dispose: created.dispose }));
    }
    return scope.owner;
  };
  // Identified providers that enclosed a captured computed's creation on the server (entry `v`: its last capture,
  // `[token id, value, …]` outermost first): it is rebuilt under them, so context reads while it evaluates (a cdk
  // collection build pass running item bodies) see the server's values, not the resume root's defaults. One owner per
  // provider list (the decoder hands one list object per table entry), under the root.
  const scopes = new WeakMap<unknown[], Owner | null>();
  const within = (list: unknown[]): Owner | null => {
    let owner = scopes.get(list);
    if (owner === undefined) {
      const nest = (i: number): Owner | null =>
        i === list.length ? getOwner() : provide(_placeholderContext(list[i] as string), list[i + 1], () => nest(i + 2));
      scopes.set(list, (owner = runWithOwner(root, () => createRoot(() => nest(0))).value));
    }
    return owner;
  };
  // Row item / index consts of expanded list templates: refs ≤ -10 into state.k (a table ref, or [index]).
  const consts = new Map<number, () => unknown>();
  const konst = (ref: number): (() => unknown) => {
    let getter = consts.get(ref);
    if (!getter) {
      const entry = state.k![-10 - ref]!,
        value = Array.isArray(entry) ? entry[0] : decoder.get(entry);
      settle();
      consts.set(ref, (getter = () => value));
    }
    return getter;
  };
  const get = (ref: number): unknown => {
    if (ref <= -10) return konst(ref);
    const value = decoder.get(ref);
    settle();
    return value;
  };
  // Arms the signals decoded so far (also after a row const or a failed cell's accessor decoded, so a `set` in the same
  // handler already activates their bindings).
  function settle(): void {
    while (pendingSignals.length) {
      const [at, source] = pendingSignals.shift()!;
      // A signal created inside a decode that failed was rolled back (the retry made a new one, queued again): skip it.
      if (decoder.decoded(at) && decoder.get(at) === source) arm(at, source);
    }
  }
  const ready = (chunks: number[]): boolean => chunks.every((i) => api.done[i]);
  // Arms a revived signal (queued by the decoder, checked in `get`) or an identified context's signal (`start`: its table
  // entry is a context reference the decoder never holds).
  function arm(ref: number, source: Signal<unknown>): void {
    // A ref() holding a server element inside a region: removing the region (Show off, row dropped,
    // re-creation) resets it, like bindRef's unmount cleanup on client renders.
    const held = untrack(source) as Element | undefined;
    const region = held && refRegions.get(held);
    if (region !== undefined) runWithOwner(ownerOf(region), () => onCleanup(() => untrack(source) === held && source.set(undefined)));
    const bindings = stubs.get(ref);
    if (!bindings) return;
    readers.set(source, bindings);
    runWithOwner(root, () => {
      let first = true;
      effect(() => {
        source();
        if (first) return void (first = false);
        untrack(() => {
          if (DEV) cause = "the first change of signal #" + ref + " (now " + DEV.resumeValue(source()) + ")";
          for (const binding of bindings) if (!binding.active) activate(binding);
          if (DEV) cause = undefined;
        });
      });
    });
  }
  function activate(binding: Binding): void {
    const [node, , id, refs, , chunks, region] = binding.entry,
      name = binding.entry[1] as string | null; // `unpack` read table-held names back
    if (binding.active || isDead(region)) return;
    binding.active = true;
    if (DEV) binding.cause = cause ?? "speculative resume at idle";
    const [rows, branch] = slots(binding.entry);
    const run = () => {
      if (isDead(region)) return;
      if (name === "#") {
        // Replace this region's server content: dispose what was resumed inside, then create.
        // Rows of a keyed list belong to the enclosing region instead, so adopted rows live on.
        dead.add(node);
        owners.get(node)?.dispose();
      }
      runWithOwner(ownerOf(region), () => {
        const read = symbol(id)(...refs.map(get)) as () => unknown;
        if (name === null) bindText(node, read);
        else if (name === "#") {
          const range = markers().get(node);
          if (!range?.start || !range.end) throw new Error(DEV ? DEV.hint("Missing resumable region " + node, "drift") : "Missing resumable region " + node);
          // Show/Switch branches by slot (holes: Shows without one): the i-th Show/Switch the read creates directly keeps
          // slot i while its match (and read value) holds.
          let kept: (AdoptedBranch | undefined)[] | null = null;
          if (branch) {
            kept = [];
            for (const spec of Array.isArray(branch) ? branch : [branch]) {
              const marks = markers().get(spec.w)!;
              if (DEV && !marks?.end) throw new Error(DEV.hint("Missing resumable branch " + spec.w + " of region " + node, "drift"));
              if (spec.s) kept.length += spec.s;
              kept.push({
                key: spec.k,
                valued: spec.v !== undefined,
                value: spec.v === undefined ? undefined : get(spec.v),
                start: marks.start,
                end: marks.end!,
                dispose: kill(spec.w),
              });
            }
          }
          // `_regionState` values the server render created in this read: the re-created components continue from them.
          const locals = binding.entry[11] as RegionLocals | undefined;
          const adoptState = locals ? { values: locals.l.map((ref) => (ref === null ? _ABSENT_STATE : get(ref))), nested: locals.n } : null;
          // Identified providers that enclosed the site on the server: re-provided around the re-creation.
          // (a number: the table array holding the list, shared with other regions / a captured computed's capture)
          const listed = binding.entry[12] as RegionProviders | number | undefined,
            providers = (typeof listed === "number" ? (state.t[listed] as RegionProviders) : listed) ?? [];
          const provided = <T>(fn: () => T, i = 0): T => {
            if (i === providers.length) return fn();
            // A token no loaded module registered yet gets a placeholder: `resumableContext` adopts it
            // when the module loads later, so lazily loaded content inside still reads the value.
            const token = providers[i]!; // a table string's ref
            return provide(_placeholderContext(typeof token === "number" ? (state.t[token] as string) : token), get(providers[i + 1] as number), () =>
              provided(fn, i + 2),
            );
          };
          // Focus inside the server content (the trigger that was just pressed, say) moves to its
          // replacement with the same id, unless the new content moved focus itself.
          const focused = doc.activeElement;
          const keep =
            focused && focused !== doc.body && focused.id && range.start.compareDocumentPosition(focused) & 4 && range.end.compareDocumentPosition(focused) & 2
              ? focused.id
              : null;
          if (rows) {
            // A keyed list: its For adopts the server rows; only rows it drops or re-creates die.
            const adopted = rowList(rows).map(([row, item, flags], index): AdoptedRow => {
              const marks = markers().get(row)!;
              if (DEV && !marks?.end) throw new Error(DEV.hint("Missing resumable row " + row + " of region " + node, "drift"));
              return { item: get(item), index, flags, start: marks.start, end: marks.end!, dispose: kill(row) };
            });
            const reads = binding.entry[13] as RowReads | undefined;
            const took = provided(() => _region(range.start, range.end!, read, adopted, kept, adoptState, reads ? unchanged(reads) : null));
            if (!took) for (const row of adopted) row.dispose();
            if (DEV) DEV.resumeRegion(node, named(id), took ? "adopted" : "recreated", binding.cause!);
          } else provided(() => _region(range.start, range.end!, read, null, kept, adoptState));
          if (kept) for (const b of kept) if (b && !b.taken) b.dispose();
          if (DEV && !rows) DEV.resumeRegion(node, named(id), kept?.some((b) => b?.taken) ? "adopted" : "recreated", binding.cause!);
          if (keep && !focused!.isConnected && (doc.activeElement === doc.body || !doc.activeElement))
            (doc.getElementById(keep) as HTMLElement | null)?.focus({ preventScroll: true });
        } else {
          const target = element(node);
          // `...names`: a spread binding; its symbol binds the element itself, spread handlers (`@type`) too.
          if (!name.startsWith("...")) return bindAttr(target, name, read);
          const types: string[] = [];
          (read as unknown as (el: Element, names: string) => void)(
            target,
            name.replace(/ @(\S+)/g, (_, type: string) => (delete (state.e[node] ?? {})[type], types.push(type), "")),
          );
          // The spread (`_spread`, resumed) installed the takeover hook while binding.
          for (const type of types) _takeover?.add(target, type);
        }
      });
    };
    const go = () => {
      try {
        run();
      } catch (error) {
        if (!caught(region, error)) report(id, error);
      }
    };
    // A spread taking over the handler of the event being dispatched binds after that dispatch
    // (window bubble, or a task when propagation stops): its new listener must not run for it too.
    const type = current?.type;
    const start =
      type && name?.includes(" @" + type)
        ? () => {
            let done = false;
            const later = () => done || ((done = true), go());
            addEventListener(type, later, { once: true });
            setTimeout(later);
          }
        : go;
    if (ready(chunks)) start();
    else
      api
        .ensure(chunks)
        .then(go, (error: unknown) => report(id, error))
        // A layout animation around the update measures after it (`_activating`, `@rivetjs/motion/layout`).
        .finally(_activating.start?.());
  }
  // Region entry [13]: the signals the rows' own renders read. While each still holds its server value (the value it
  // decoded with: a signal never decoded was never written) the For keeps those rows; the returned check turns true once
  // one changes (the For then re-creates them). null: one is no signal, or changed already.
  const unchanged = (refs: RowReads): (() => boolean) | null => {
    const sources: Signal<unknown>[] = [],
      values: unknown[] = [];
    for (const ref of refs) {
      const entry = state.t[ref] as { s?: number } | null;
      if (entry === null || typeof entry !== "object" || entry.s === undefined) return null;
      const source = get(ref) as Signal<unknown>,
        value = get(entry.s);
      if (!Object.is(untrack(source), value)) return null;
      sources.push(source);
      values.push(value);
    }
    return () => {
      for (let i = 0; i < sources.length; i++) if (!Object.is(sources[i]!(), values[i])) return true;
      return false;
    };
  };
  // Resumed state of a row / branch region dies with it.
  const kill = (id: number) => () => {
    dead.add(id);
    owners.get(id)?.dispose();
  };
  // Region entry [8]: rows or branches (a spec, or an array of specs: objects, where row arrays hold numbers);
  // branches after rows sit at [10]. A branch spec always carries `k`; compact rows never do (their `w` is the
  // rows' reads flag, not a branch region).
  const slots = (entry: BindingEntry): [RowsSpec | undefined, BranchesSpec | undefined] => {
    const slot = entry[8];
    return slot && (Array.isArray(slot) ? typeof slot[0] === "object" : "k" in slot)
      ? [undefined, slot as BranchesSpec]
      : [slot as RowsSpec | undefined, entry[10] as BranchesSpec | undefined];
  };
  // List rows as [rowId, itemRef, flags]: flat triples, or the compact form of templated lists.
  // Flags: 1 = the row read its index, 2 = its own render read signals (re-created with the region, unless the entry's
  // row reads [13] all hold their server values: kept until one changes).
  const rowList = (rows: RowsSpec): [row: number, item: number, flags: number][] => {
    if (Array.isArray(rows)) {
      const out: [number, number, number][] = [];
      for (let i = 0; i < rows.length; i += 3) out.push([rows[i]!, rows[i + 1]!, rows[i + 2]!]);
      return out;
    }
    const items = (rows.a !== undefined ? state.t[rows.a] : rows.r) as number[];
    return items.map((item, k): [number, number, number] => [rows.ids ? rows.ids[k]! : rows.i! + k * rows.d!, item, (rows.x ?? 0) | (rows.w ? 2 : 0)]);
  };
  // Text markers `rN` … `/`; region markers `rN[` … `]`. Ends carry no id: markers nest, so each
  // end closes the innermost open marker. A start without N (`r`, `r[`) continues the stride of the two
  // starts before it in document order (the server wrote it so); a streamed segment's rescan reuses the ids
  // earlier scans read (`patch`). Streamed content starts with two explicit ids.
  function markers(): Map<number, Markers> {
    if (comments) return comments;
    comments = new Map();
    const open: number[] = [];
    // From the document, not its body: id-less starts count the head's markers too (the server wrote them).
    const walker = doc.createTreeWalker(doc, 128);
    let last = -1,
      step = 0;
    // Char-code scan, no regex: pages carry thousands of markers.
    for (let node: Comment | null; (node = walker.nextNode() as Comment | null);) {
      const data = node.data,
        code = data.charCodeAt(0);
      if (code === 114) {
        let id = 0,
          i = 1,
          digit;
        while ((digit = data.charCodeAt(i) - 48) >= 0 && digit <= 9) ((id = id * 10 + digit), i++);
        if (i === data.length || (i + 1 === data.length && data.charCodeAt(i) === 91)) {
          if (i > 1) ((step = last < 0 ? 0 : id - last), (last = id));
          else {
            const known = chained?.get(node);
            last = known === undefined ? last + step : known;
            id = last;
          }
          comments.set(id, { start: node, end: null });
          open.push(id);
        }
      } else if ((code === 47 || code === 93) && data.length === 1 && open.length) {
        const id = open.pop()!,
          pair = comments.get(id)!;
        pair.end = node;
        // C5: the HTML parser moved one marker of the pair (an implied `<tbody>` around rows directly
        // in a `<table>`, foster parenting, a parser-closed `<p>`): the range spans two parents.
        if (DEV && pair.start.parentNode !== node.parentNode)
          console.warn(
            DEV.hint(
              "Rivet resume: markers r" +
                id +
                " start and end under different parents (<" +
                (pair.start.parentNode as Element | null)?.localName +
                "> / <" +
                (node.parentNode as Element | null)?.localName +
                ">)",
              "parser",
            ),
          );
      }
    }
    return comments;
  }
  // A text site (`<!--rN-->text<!--/-->`) whose read starts returning an element (JSX behind a call)
  // upgrades in place: its markers are a child range under the binding's owner from then on.
  function bindText(node: number, read: () => unknown): void {
    const { start, end } = markers().get(node) ?? ({} as Partial<Markers>);
    if (!start || !end) throw new Error(DEV ? DEV.hint("Missing resumable text " + node, "drift") : "Missing resumable text " + node);
    let text = start.nextSibling !== end && start.nextSibling?.nodeType === 3 ? (start.nextSibling as Text) : null,
      upgraded = false;
    const owner = getOwner();
    effect(() => {
      if (upgraded) return;
      const value = read();
      if (!primitive(value)) {
        // The value just built is dropped (its scopes belong to this effect and go with its next
        // run); the child range, owned by the binding's owner, reads afresh and keeps its own.
        upgraded = true;
        text?.remove();
        untrack(() => runWithOwner(owner, () => _region(start, end, read)));
        return;
      }
      const next = value == null || typeof value === "boolean" ? "" : String(value);
      if (text) {
        if (text.data !== next) text.data = next;
      } else if (next) end.before((text = doc.createTextNode(next)));
    });
  }
  const run = (
    entry: [symbol: SymbolRef, refs: number[], when: unknown, chunks: number[], ...rest: unknown[]],
    region: number,
    fn: (value: never) => unknown,
  ): void => {
    const [id, refs, , chunks] = entry;
    const go = () => {
      if (isDead(region)) return;
      try {
        runWithOwner(ownerOf(region), () => fn(symbol(id)(...refs.map(get)) as never));
      } catch (error) {
        if (!caught(region, error)) report(id, error);
      }
    };
    if (ready(chunks)) go();
    else api.ensure(chunks).then(go, (error: unknown) => report(id, error));
  };
  function when(trigger: string | null | undefined, target: Element | null, fn: () => void): unknown {
    if (!trigger || trigger === "load" || trigger === "idle") return idle(fn);
    if (trigger === "interaction") {
      const once = () => {
        for (const type of ["pointerdown", "keydown"]) doc.removeEventListener(type, once, true);
        fn();
      };
      for (const type of ["pointerdown", "keydown"]) doc.addEventListener(type, once, { capture: true, passive: true });
      return;
    }
    if (trigger === "visible") {
      if (!target) return idle(fn);
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            fn();
          }
        },
        { rootMargin: "100% 0px" },
      );
      // A `display: contents` root (a framework island; the bridge writes the style inline) has no box: observe its element
      // descendants through nested contents wrappers, at most 48 (spread evenly, as the server samples visible chunks); the
      // first intersecting one fires. Only an inline style counts, so other `visible` targets never pay a style read.
      // Nothing with a box inside: idle.
      if ((target as HTMLElement).style?.display === "contents") {
        const boxes: Element[] = [];
        const walk = (parent: Element): void => {
          for (const kid of parent.children) {
            if ((kid as HTMLElement).style?.display === "contents") walk(kid);
            else boxes.push(kid);
          }
        };
        walk(target);
        if (!boxes.length) return idle(fn);
        const n = Math.min(boxes.length, 48);
        for (let i = 0; i < n; i++) observer.observe(boxes[Math.floor((i * boxes.length) / n)]!);
      } else observer.observe(target);
      return;
    }
    if (trigger.startsWith("media:")) {
      const query = matchMedia(trigger.slice(6));
      if (query.matches) return fn();
      const change = () => {
        if (!query.matches) return;
        query.removeEventListener("change", change);
        fn();
      };
      query.addEventListener("change", change);
      return;
    }
    throw new TypeError("Unknown when trigger: " + trigger);
  }
  // First element among a symbol's ref captures (ref-bound locals; `ref()` objects: signals holding one), for `visible` triggers.
  const refElement = (refs: number[]): HTMLElement | null => {
    type Entry = { r?: number; s?: number } | null | undefined;
    for (const ref of refs) {
      const entry = (state.t[(state.t[ref] as Entry)?.s!] ?? state.t[ref]) as Entry;
      if (entry?.r !== undefined) return element(entry.r);
    }
    return null;
  };
  // First element (or the end marker's parent) of a region, for `visible` mounts.
  const regionElement = (node: number): Element | null => {
    const { start, end } = markers().get(node) ?? ({} as Partial<Markers>);
    for (let n = start?.nextSibling; n && n !== end; n = n.nextSibling) if (n.nodeType === 1) return n as Element;
    return end?.parentElement ?? null;
  };
  // Speculative resume: at idle, activate the bindings a delegated handler or model can update (their
  // dependency refs are captured by one), so the first interaction only runs the handler and the
  // reactive update — not symbol decoding, list adoption and first-run compilation. Only bindings whose
  // activation keeps the server DOM: text bindings and keyed lists / branches that adopt it in place.
  // Per-row bindings stay lazy (O(rows) setup for a later, rarer interaction). Chunks are only
  // awaited when the loader is already fetching them (no new requests). Idle slices; a binding
  // activated in between (by its signal) is skipped.
  function speculate(): void {
    const reachable = new Set<number>(),
      rowIds = new Set<number>(),
      queue: Binding[] = [];
    for (const id in state.e) for (const type in state.e[id]) for (const ref of state.e[id]![type]![1]) reachable.add(ref);
    for (const id in state.m) reachable.add(state.m[id]![1]);
    for (const entry of state.b) {
      const [rows] = slots(entry);
      if (rows) for (const [row] of rowList(rows)) rowIds.add(row);
    }
    for (const binding of registered) {
      const entry = binding.entry;
      if (entry[7] || rowIds.has(entry[6]) || !entry[4].some((ref) => reachable.has(ref))) continue;
      const [rows, branch] = slots(entry);
      if (entry[1] === null || (entry[1] === "#" && (rows || branch))) queue.push(binding);
    }
    const loading = api.p;
    const step = (deadline?: IdleDeadline): void => {
      while (queue.length) {
        if (deadline && deadline.timeRemaining() < 2) return void idle(step);
        const binding = queue.shift()!,
          chunks = binding.entry[5];
        if (binding.active) continue;
        if (ready(chunks)) activate(binding);
        else if (loading && chunks.every((i) => loading[i]))
          api
            .ensure(chunks)
            .then(
              () => idle(() => activate(binding)),
              DEV ? (error: unknown) => console.warn("Rivet resume: speculative activation of " + named(binding.entry[2]) + " failed", error) : () => {},
            );
      }
    };
    if (queue.length) idle(step);
  }
  return {
    start(nextState: ResumeState, nextDoc: Document = document, nextApi?: LoaderApi) {
      if (state || (DEV && stopped)) return;
      state = nextState;
      doc = nextDoc;
      api = nextApi!;
      // Context values for captures and for regions created in the browser.
      const made = createRoot(() => {
        const nest = (i: number): Owner | null => (i === contexts.length ? getOwner() : provide(contexts[i]![0], contexts[i]![1], () => nest(i + 1)));
        return nest(0);
      });
      root = made.value;
      if (DEV) stopRoot = made.dispose;
      // `testing-resume.ts` (`serializeAndRevive`) keeps a document-free copy of these hooks, `named`, `symbol` and
      // `liveProps`: change both (tests/serialize-and-revive.test.ts guards entry kinds + messages).
      decoder = createDecoder(state.t, {
        settle,
        signal: (ref, options) => {
          const s = signal<unknown>(undefined, options);
          pendingSignals.push([ref, s]);
          return s;
        },
        computed: (id, captures, options, scoped) =>
          runWithOwner(scoped ? within(captures.pop() as unknown[]) : root, () => computed(symbol(id)(...captures) as () => unknown, options)),
        fn: (id, captures) => runWithOwner(root, () => symbol(id)(...captures)),
        custom: (kind, args) => {
          if (kind === "const") return () => args[0];
          // `.bind` of a resumable function (`_rBound`, Function Bridge T9): `[fn, self, ...args]`.
          if (kind === "bind") return (args[0] as (...a: unknown[]) => unknown).bind(args[1], ...args.slice(2));
          // A narrowed store (`_rStorePaths`, Function Bridge T12): `[root signal (pruned data), nodes, kept paths (dev)]` →
          // the store node; dev warns when browser code reads a path the page did not ship.
          if (kind === "store") {
            const node = { ...(args[1] as object), v: args[0] };
            if (DEV && args[2]) DEV.resumeStore(node, args[2] as string[]);
            return node;
          }
          // A registered context token held as a value (`clearContexts`): the token itself (adopted when registered later).
          if (kind === "ctx") return _placeholderContext(args[0] as string);
          // Live props (`_rProps` / props helpers): a forwarded getter `[key, …sources]` (last defined value wins) …
          if (kind === "m") return { [FORWARD]: args };
          // … and the props object holding them (`[key, value | forward, …]`, key order kept).
          if (kind === "props") return liveProps(args);
          // `href` is the resume-only createRouter option, hidden from its public signature.
          // A server router's same-origin location, root-relative (`ResumableOptions.origin`).
          if (kind === "href") return new URL(args[0] as string, location.href).href;
          if (kind === "router") return runWithOwner(root, () => createRouter({ href: args[0] as Signal<string> } as { window?: Window }));
          // A server ErrorBoundary's reset: re-create its region (the DOM boundary renders children).
          if (kind === "reset")
            return () => {
              if (DEV) cause = "an ErrorBoundary reset";
              const reset = regionBindings.has(args[0] as number) && activate(regionBindings.get(args[0] as number)!);
              if (DEV) cause = undefined;
              return reset;
            };
          throw new TypeError("Unknown resume entry kind " + kind);
        },
        context: (id) => {
          if (!byId.has(id)) throw new Error(DEV ? DEV.hint("Missing resume context: " + id, "context") : "Missing resume context: " + id);
          return byId.get(id);
        },
        ref: (id, region) => {
          const el = element(id);
          if (region !== undefined) refRegions.set(el, region);
          return el;
        },
      });
      // Lazy components (routes, deferred views) load at idle; navigation then renders synchronously.
      _warmLazy(idle);
      // Dev: chunk loads the loader's idle warm-up would swallow are logged.
      if (DEV && api?.p) DEV.resumeChunks(api.p, state.c);
      // Pair the server markers at idle too, so the first region activation skips the document scan.
      idle(markers);
      state.b = unpack(state.b, state.t);
      register(state);
      speculate();
      // `rivet.warm` (router live pages, on form intent): load the chunks of the not yet active bindings that read a
      // signal, so they activate synchronously when it changes (no round trip after the answer). Nothing runs.
      (globalThis as Record<symbol, unknown>)[Symbol.for("rivet.warm")] = (source: Signal<unknown>): void => {
        const chunks: number[] = [];
        for (const binding of readers.get(source) ?? []) if (!binding.active) for (const c of binding.entry[5]) if (!api.done[c]) chunks.push(c);
        if (chunks.length) api.ensure(chunks).catch(() => {});
      };
      // Signals provided as identified contexts (e.g. the router's navigation state) arm the
      // bindings that read them, like revived signals do.
      for (const [token, value] of contexts)
        if (typeof (value as Signal<unknown>)?.set === "function")
          state.t.forEach((entry, ref) => (entry as { x?: string } | null)?.x === token.id && arm(ref, value as Signal<unknown>));
      // Booted by link intent on a lazy router page (Z1): attach its listeners now and let them see that intent
      // (route data + page prefetch), so the click that follows finds an armed router.
      // Only those document / window listeners see it, called with the intent itself: a copy dispatched
      // through the DOM would reach every handler on its path a second time (a combobox button's focus).
      const intent = api?.i;
      if (intent && state.n && /^(pointerover|focusin)$/.test(intent.type)) ((replayIntent = intent), drain(), (replayIntent = null));
      // Cold events the loader held before this started, in dispatch order.
      for (const item of api.q?.splice(0) ?? []) this.cold(item);
    },
    /** Streamed segment state (already merged into state by the stream add-on): register its entries. */
    patch(delta: StatePatch) {
      // The rescan may no longer see the starts an id-less one continued (a re-created region): keep what this scan read.
      if (comments) for (const [id, pair] of comments) if (pair.start.data.length < 3) (chained ??= new WeakMap()).set(pair.start, id);
      comments = elements = null;
      if (DEV && api?.p) DEV.resumeChunks(api.p, state.c);
      register({ b: unpack(delta.b ?? [], state.t), fx: delta.fx ?? [], ce: delta.ce ?? [], a: delta.a }, true);
    },
    /** Whether a region's server content was replaced (a streamed segment for it is dropped). */
    dead: (region: number) => isDead(region),
    /** Path-addressed row elements (state `w`): the element of an id, or the id of an element (the loader's `$rw`). */
    q: (x: number | Element): Element | string | undefined => (typeof x == "number" ? build().get("" + x) : (build(), pathIds.get(x))),
    on(event: Event, hit: Hit): boolean {
      if (held || !ready(hit[1])) return false;
      deliver(this, event, hit[0]);
      return true;
    },
    cold([event, hit, replay, live]: ColdEvent) {
      held++;
      // A press starts with a primary mouse / pen pointerdown (touch moves focus at its compatibility mousedown, after
      // the finger lifts); its mousedown has the same target.
      if (event.type === "pointerdown") down = (event as PointerEvent).pointerType !== "touch" ? event : undefined;
      else if (event.type === "mousedown" && down?.target === event.target) (linked.add(down).add(event), (down = undefined));
      chain = chain
        .then(() => api.ensure(hit[1]))
        .then(
          () => {
            // Events its handlers dispatch (a `focus()`'s focusin, a link's synthetic click) are nested: they run
            // now, as on a live page, not behind the cold events still queued (whose count is set aside meanwhile).
            // So are those of the microtasks they queue (a deferred `focus()`'s focusin — a live page runs it before the
            // next event, CDK-LEFT calendar), so the count returns in a microtask. The held default's replay follows it
            // (its `change` queues behind the cold events dispatched after it), after the microtask restoring the live
            // form state (a replayed toggle starts from it).
            const queued = --held;
            held = 0;
            // A cold press's default focus move (the mousedown's) ran natively at dispatch (the browser's mouse focus:
            // no focus-visible ring), before the handlers loaded. Natively they run first: a pointerdown handler
            // focusing the target (RA usePress, a menu trigger's press start), a canceling mousedown one (a radio
            // label) or RA `preventFocus` (`preventFocusOnPress`: swallows the coming move, refocuses the active
            // element) act on it. So focus goes back to the element focused at dispatch while the default's target
            // (`body` when nothing focusable was pressed) still holds it — once per press, at its first cold event (a
            // linked pointerdown: the mousedown then must not undo what its handlers focused) — the handlers run, and
            // the default's focus follows at the press's last cold event unless one canceled it, as a mouse focus
            // (`focusVisible: false`: a script focus after a focused text field would match `:focus-visible`; a held
            // default + script focus turned Chrome's heuristic on for every later script focus of the page). A canceled
            // press records its target as undone: a later press dispatched meanwhile puts focus back past it (`undone`).
            // Not for text entry / selects (caret, picker: the native default stays) or touch pointerdowns.
            const type = event.type,
              press = (type === "mousedown" || (type === "pointerdown" && (event as PointerEvent).pointerType !== "touch")) && pressTarget(event),
              pair = linked.has(event);
            if (press && !(pair && type === "mousedown") && doc.activeElement === (press[0] ?? doc.body)) {
              let was = live[3] as HTMLElement | null,
                ts = event.timeStamp,
                u: [Element | null, number, number] | undefined;
              while (was && (u = undone.get(was)?.findLast((e) => e[2] < ts && event.timeStamp < e[1]))) ((was = u[0] as HTMLElement | null), (ts = u[2]));
              was && was !== doc.body ? was.focus({ preventScroll: true }) : press[0]?.blur();
            }
            const kept = deliver(this, event, hit[0], !!replay || !!press, live);
            queueMicrotask(() => {
              held += queued;
              // An unpaired pointerdown's default focus follows even when canceled (only a canceled mousedown keeps
              // focus where it was).
              if (press && !(pair && type === "pointerdown"))
                if (!kept || type === "pointerdown")
                  press[0] ? press[0].focus({ preventScroll: true, focusVisible: false } as FocusOptions) : (doc.activeElement as HTMLElement | null)?.blur?.();
                else if (press[0]) {
                  const list = undone.get(press[0]) ?? [];
                  (undone.set(press[0], list), list.push([live[3] as Element | null, performance.now(), event.timeStamp]));
                }
              kept || (replay && replay());
            });
          },
          (error: unknown) => (held--, api.f!(error)),
        );
    },
    /** Run the element's handler (or model sync) for a delegated event; requires loaded chunks. `entry`: the
     * handler the loader resolved at event time (a spread taking the handler over meanwhile must not orphan it). */
    dispatch(event: Event, target: Element & { __rivetModel?: boolean }, id: string, type: string, replaying = false, entry?: HandlerEntry, live?: unknown[]) {
      let prevented = false;
      // A cold key event replays where focus is now when a replayed handler moved focus after the event's dispatch
      // (typed "8" "0" "0" on a cold time field: "8" moves focus to the minute segment, so the zeros are the minute's,
      // as on a live page; all were dispatched at the hour segment). Handlers on the focused element's path run with
      // `target` = it; the loader's own walk over the old path stops (cancelBubble).
      if (live && KEY_EVENT.test(type) && !keyed.has(event)) {
        keyed.add(event);
        const focus = doc.activeElement,
          from = event.target as Element,
          moved = blurredAt.get(from);
        if (focus && focus !== from && focus !== doc.body && moved !== undefined && event.timeStamp < moved) {
          const path: [Element, string, HandlerEntry][] = [],
            caps: typeof path = [];
          for (let node: Node | null = focus; node; node = node.parentNode ?? (node as unknown as ShadowRoot).host ?? null) {
            const at = (node as Element).getAttribute?.("data-r") ?? (state.w ? (build(), pathIds.get(node as Element)) : undefined);
            const handlers = at && !/\D/.test(at) ? state.e[at] : undefined;
            if (handlers?.[type + "!"]) caps.unshift([node as Element, at!, handlers[type + "!"]!]);
            if (handlers?.[type]) path.push([node as Element, at!, handlers[type]!]);
          }
          const all = caps.concat(path);
          if (all.every((hit) => ready(hit[2][2]))) {
            Object.defineProperty(event, "target", { configurable: true, value: focus });
            try {
              for (const [element, at, handler] of all) {
                prevented = this.dispatch(event, element, at, type, replaying, handler).prevented || prevented;
                if (event.cancelBubble) break;
              }
            } finally {
              delete (event as { target?: unknown }).target;
            }
            event.stopPropagation();
            return { prevented };
          }
        }
      }
      // Never throws (C7): the loader replays cold events on one promise chain, and a throw there would
      // skip the next event's handlers and reload the page. Failures report like a handler's.
      try {
        drain();
        if (live && !shown.has(event)) show(event, live);
        // Replay of an event the loader already cancelled: the handler sees its own preventDefault only.
        if (replaying) {
          Object.defineProperties(event, {
            preventDefault: { value: () => ((prevented = true), canceled.add(event)), configurable: true },
            defaultPrevented: { get: () => prevented, configurable: true },
          });
          // The loader cancels a cold `invalid` (its native default cannot wait for the chunk): unless a handler
          // canceled it, its default follows once every target's handler ran — the form's first invalid control
          // takes focus (no bubble). A cold submit click replays before the form's invalid handler loaded.
          if (type === "invalid" && !canceled.has(event) && !invalids.has(event)) {
            invalids.add(event);
            queueMicrotask(() => {
              const control = event.target as HTMLInputElement;
              if (!canceled.has(event) && [...(control.form?.elements ?? [])].find((e) => !(e as HTMLInputElement).validity?.valid) === control)
                control.focus();
            });
          }
        }
        const model = state.m[id];
        if (model && type === (model[0] === "value" ? "input" : "change") && !target.__rivetModel) {
          target.__rivetModel = true;
          const signalValue = get(model[1]) as Signal<string>;
          runWithOwner(root, () => {
            if (!(event as InputEvent).isComposing) signalValue.set((target as HTMLInputElement)[model[0]] as string);
            _model(target as HTMLInputElement, model[0] as "value", signalValue);
          });
        }
      } catch (error) {
        report("model:" + id, error);
      }
      const handler = entry ?? state.e[id]?.[type];
      if (handler) {
        const [symbolId, refs] = handler;
        const resumed = () => {
          const fn = symbol(symbolId)(...refs.map(get)) as ((this: Element, event: Event) => unknown) | null | undefined;
          if (fn != null) at(event, target, () => fn.call(target, event));
        };
        const call = () => {
          // Cold events (`live`: replayed by the loader's chain): a handler moving focus (sync or in a microtask) retargets the key events queued before (above).
          const before = live ? doc.activeElement : null;
          if (before) queueMicrotask(() => doc.activeElement !== before && blurredAt.set(before, performance.now()));
          current = event;
          try {
            // A live event (chunk loaded, still in its task): `_dispatch` (a trusted mouse click flushes one task
            // later; failures of that flush report here too). A cold replay (`live`) runs after its chunk loaded,
            // outside the click's task: it flushes now, inside the `show` window its bindings rely on.
            if (live) batch(() => runWithOwner(root, resumed));
            else _dispatch(root, resumed, target, event, (error) => report(symbolId, error));
          } catch (error) {
            report(symbolId, error);
          }
          current = null;
        };
        // A descendant on the event's path took this type over (an activated spread listens on the element
        // itself): the loader's capture-phase walk would run this bubbling handler before the descendant's own
        // listener. Run it after that listener instead, unless it stopped propagation (bubbling order, K3-rt-1).
        // Client-rendered descendants (delegated `_on` handlers, e.g. rows a list re-created) handle a live bubbling
        // event first, as natively; their stopPropagation skips this handler.
        const bubbling = event.eventPhase === 1 && handler !== state.e[id]?.[type + "!"];
        if (bubbling && _delegateBelow(event, target)) return { prevented: prevented || (!replaying && event.defaultPrevented) };
        if (!(bubbling && _takeover && _takeover.defer(event, target, type, call))) call();
      }
      return { prevented: prevented || (!replaying && event.defaultPrevented) };
    },
    // Dev server (a resumed page switching to client rendering on a hot update): dispose what resumed,
    // and never start (or activate anything) afterwards. Production builds have no `dispose`.
    ...(DEV
      ? {
          dispose(): void {
            if (stopped) return;
            stopped = true;
            for (const scope of owners.values()) scope.dispose();
            stopRoot?.();
          },
        }
      : {}),
  } satisfies ResumeInstance as unknown as ResumeRuntime;
  // `late`: a streamed patch after start — its server values may be stale for signals the page already
  // revived (and maybe changed), so those bindings activate now.
  function register({ b, fx, ce, a }: Pick<ResumeRecords, "b" | "fx" | "ce" | "a">, late = false): void {
    for (const entry of b) {
      if (entry[1] === "#") parents.set(entry[0], entry[6]);
      const [rows, branch] = slots(entry);
      if (rows) for (const [row] of rowList(rows)) parents.set(row, entry[6]);
      if (branch) for (const spec of Array.isArray(branch) ? branch : [branch]) parents.set(spec.w, entry[6]);
      const binding = { entry, active: false };
      if (!late) registered.push(binding);
      if (entry[1] === "#") regionBindings.set(entry[0], binding);
      for (const ref of entry[4]) (stubs.get(ref) ?? stubs.set(ref, []).get(ref)!).push(binding);
      if (entry[1] === "#" && entry[7])
        when(entry[7], regionElement(entry[0]), () => {
          if (DEV) cause = "its mount trigger (" + entry[7] + ")";
          activate(binding);
          if (DEV) cause = undefined;
        });
      else if (late && entry[4].some((ref) => decoder.decoded(ref))) {
        if (DEV) cause = "a streamed segment reading signals the page already revived";
        activate(binding);
        if (DEV) cause = undefined;
      }
    }
    // Streamed boundaries [marker, fallback region, region, status]: the fallback dies with its swap;
    // a continued boundary re-creates its region (its DOM Async loads in the browser).
    for (const [, fallback, region, status] of a ?? []) {
      parents.set(fallback, region);
      if (status === 3) catches.set(fallback, region);
      else if (status === 1) dead.add(fallback);
      else if (status === 2) {
        const binding = regionBindings.get(region);
        if (binding)
          when("load", null, () => {
            if (DEV) cause = "a streamed boundary continued in the browser";
            activate(binding);
            if (DEV) cause = undefined;
          });
      }
    }
    for (const entry of fx) {
      const [, refs, trigger, , region] = entry;
      const target = refElement(refs);
      when(trigger ?? (target ? "visible" : "idle"), target, () =>
        run(entry, region, (fn: () => unknown) =>
          effect(() => {
            const cleanup = fn();
            if (typeof cleanup === "function") onCleanup(cleanup as Disposer);
          }),
        ),
      );
    }
    for (const [id, refs, target, type, options, chunks, region] of ce) {
      const resolved = (target === "w" ? globalThis : target === "d" ? doc : Array.isArray(target) ? element(target[1]) : target) as
        Window | Document | Element | `media:${string}`;
      // The listener attaches at `when` (`load`: idle, or the first delegated dispatch); the handler chunk loads on the first event.
      const trigger = options?.when ?? "load";
      const attach = () => {
        if (isDead(region)) return;
        const handle = (event: Event, current: EventTarget | null) => {
          const path = ready(chunks) ? undefined : event.composedPath();
          return run([id, refs, null, chunks], region, (handler: (event: Event) => unknown) => at(event, current, () => handler(event), path));
        };
        if (DEV && options?.match) DEV.selector(options.match);
        const replay = replayIntent?.type === type && (target === "d" || target === "w") && (!options?.match || _matches(replayIntent, options.match));
        // A `once` listener the replayed boot intent reaches is consumed by it: never attached.
        if (!(replay && options?.once))
          runWithOwner(ownerOf(region), () =>
            clientEvent(
              resolved,
              type,
              (event) => {
                const current = event.currentTarget;
                // A link click or form submit while the handler's chunk loads (a router's interception, a
                // forms enhancement): hold it, let the handler see the event once loaded, then follow the
                // link / resubmit unless it cancels. Cold listeners of one event share the hold; the last to settle replays.
                if (ready(chunks) || options?.passive || (type != "click" && type != "submit")) return handle(event, current);
                const h = holds.get(event) ?? cold(event);
                if (!h) return handle(event, current);
                h.n++;
                api
                  .ensure(chunks)
                  .then(
                    () => handle(event, current),
                    (error: unknown) => report(id, error),
                  )
                  .then(() => --h.n || h.p || h.h());
              },
              {
                passive: options?.passive,
                capture: options?.capture,
                once: options?.once,
                // `match`: events outside a matching element neither run the handler nor load its chunk.
                match: options?.match,
              },
            ),
          );
        if (replay) handle(replayIntent!, resolved as EventTarget);
      };
      if (trigger === "load" || trigger === "idle") (eager.push(attach), idle(drain));
      else when(trigger, (resolved as Node)?.nodeType === 1 ? (resolved as Element) : null, attach);
    }
  }
}
