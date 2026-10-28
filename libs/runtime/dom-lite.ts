// Lite resume runtime (ZERO R4, 2026-10-25; nano since RT-DIET 2026-10-26): adopts boundaries whose compiled DOM module
// exports a residual `<Name>$a(node, rec)` — the boundary's handlers, live bindings and keyed state only, written against
// the server nodes by path (`_lw`). No probe / align / claim pass, no Async: those boundaries are ordinary
// (`dom-derived.ts`). Keyed lists (`_lf`, `dom-lite-list.ts`) build new rows from a data spec, never a template string. The default export implements the loader's `DerivedRuntime` contract, so the inline
// loader (`resume-loader-derived.ts`) starts either runtime from `data-rt`.
//
// Closed world (RT-DIET): a residual reaches only its keyed / never-written signals, globals and copied data constants
// (`derived_lite.rs`: no module binding but a data literal, no component, no context), so its state never meets
// `@rivetjs/reactivity`. This module carries its own signal + binding core (a few hundred bytes: `Signal` API, Object.is
// writes, untracked `update`, dynamic dependencies, batched handlers, the first-mouse-click deferred flush of
// `_dispatch`) and its own delegated listener per type over the same `$$<type>` / `$$o` node fields as `dom-events.ts`.
// A lite page ships neither the reactivity graph nor the DOM ABI.
//
// Module split (RT-DIET): core (`dom-lite-core.ts`: signal / effect / owner lists / delegation / `_lw`) + leaves
// `dom-lite-attr.ts` (`_lk` / `_lq` / `_lb`), `dom-lite-write.ts` (`_la` / `_lp`, pulls `dom-attr.ts` / `dom-base.ts`),
// `dom-lite-list.ts` (`_lf`), `dom-lite-model.ts` (`_lm`), re-exported here: chunks follow modules, so a page's lite
// runtime chunk carries only the leaves its residuals import (union absorption otherwise grew every lite page).
//
// Fallback (one-way, per boundary): a residual that throws (`LiteMiss`: a node the path expected is missing, a value it
// cannot write, a cross-unit wake key) leaves that boundary to the full runtime: its bindings are released, the full
// runtime (`dom-lite-full.ts`, a dynamic import: never fetched unless a fallback happens) starts with the lite-owned
// records marked done (`api.l`), this module's document listeners hand over to the full runtime's delegation (`_on`:
// one table again, handlers stay on their nodes), and every later call of this instance forwards to it. A boundary
// never goes back to lite.
import type { Signal } from "@rivetjs/reactivity";
import type { DerivedLoaderApi, DerivedRuntime, HeldEvent } from "./dom-derived.ts";
import type { BoundaryTail } from "./resume-format.ts";
import { eachRecord } from "./resume-tail.ts";
import { DEV } from "#dev";
import { type Eff, _lw, defaulted, delegate, dispatch, effect, miss, type On, on, own, release, signal, types } from "./dom-lite-core.ts";

export { signal, _lw } from "./dom-lite-core.ts";
export { _lb, _lk, _lq, _lv } from "./dom-lite-attr.ts";
export { _la, _lp } from "./dom-lite-write.ts";
export { _lf, type LiteSpec } from "./dom-lite-list.ts";
export { _lo } from "./dom-lite-cond.ts";
export { _lm } from "./dom-lite-model.ts";

/**
 * A boundary record as a residual sees it: its id, its keyed values by key (absent key ⇒ the site's init, LIT), the
 * page's wake lists (tail `w`: a key another boundary reads is not lite) and its recorded props (JS-DIET-2: an
 * `INDEPENDENT` record's props are data; a residual whose live bindings / handlers read props declares
 * `const props = r.p`; `{}` when the record has none).
 */
export interface LiteRec {
  readonly id: number;
  readonly v: Record<string, unknown> | undefined;
  readonly w?: Record<string, number[]> | undefined;
  readonly p?: Record<string, unknown>;
}
/** The residual of a boundary (`<Name>$a`): binds its handlers, bindings and keyed state over the server nodes. */
export type LiteResidual = (node: Element | Comment, rec: LiteRec) => void;

/**
 * A keyed signal of the boundary (`key` = the compiler's keyed site key, as `_sig`): the record's value, else `init`; no
 * `init` argument (a non-literal init the browser cannot re-run): the record must have the key, else `LiteMiss`. A key
 * another boundary's binding reads (tail wake list) is not lite: `LiteMiss`.
 */
export function _ls<T>(r: LiteRec, key: string, init?: T): Signal<T> {
  if (r.w?.[r.id + "." + key]) miss(key);
  return signal((r.v && key in r.v ? r.v[key] : arguments.length > 2 ? init : miss(key)) as T);
}

/**
 * A keyed signal whose initial value the page already shows (ZERO X9: the compiler's `domRead` facts; the server leaves
 * the key out of the record while unwritten, `_rSig` flag `DOMREAD`): the record's value when it has the key, else read
 * from the server nodes — `at` addressed as `_lt` / `_la` address them, `codec` 0 the text there, 1 that text as a number,
 * 2 attribute `name` present, 3 attribute `name`'s value. An unreadable value (no text node, `NaN`, attribute absent) or a
 * wake-listed key: `LiteMiss` (the boundary falls back to its ordinary component).
 */
export function _lr<T>(r: LiteRec, key: string, at: Node, codec: 0 | 1 | 2 | 3, name?: string): Signal<T> {
  if (r.w?.[r.id + "." + key]) miss(key);
  if (r.v && key in r.v) return signal(r.v[key] as T);
  let v: unknown;
  if (codec < 2) {
    const t = at.nodeType == 1 ? at.firstChild : at.nextSibling;
    v = t?.nodeType == 3 ? (t as Text).data : t === null || t.nodeType == 8 ? "" : miss(key);
    if (codec && ((v = +(v as string)), v !== v || (v as string) === "")) miss(key);
  } else {
    const el = at as Element;
    v = codec == 2 ? el.hasAttribute(name!) : (el.getAttribute(name!) ?? miss(key));
  }
  return signal(v as T);
}

/** A delegated bubbling handler (the page's one listener per type). */
export const _le = (_r: LiteRec, el: Element, type: string, fn: (event: Event) => unknown): void => on(el, type, fn);

/**
 * A dynamic text slot: `at` = its content opener `<!--[-->` (server `<!--[-->text<!--]-->`), or the element whose sole
 * child it is (`<span>text</span>`); an empty value has no Text node on the server: one is inserted. Scalars only (a node
 * / array / accessor value is ordinary content: `LiteMiss`).
 */
export function _lt(at: Node, fn: () => unknown): void {
  const sole = at.nodeType == 1;
  let t = sole ? at.firstChild : at.nextSibling;
  if (!t || t.nodeType != 3) t = (sole ? at : at.parentNode!).insertBefore(at.ownerDocument!.createTextNode(""), sole ? null : t);
  effect(() => {
    const v = fn(),
      s = v == null || typeof v == "boolean" ? "" : typeof v == "object" || typeof v == "function" || typeof v == "symbol" ? miss("text") : String(v);
    if ((t as Text).data !== s) (t as Text).data = s;
  });
}
/** A `computed` of the lite world (eager: recomputed when what it read changes). */
export function _lc<T>(fn: () => T): () => T {
  const s = signal(undefined as T);
  effect(() => s.set(fn()));
  return s;
}

// ---- the runtime instance (loader contract `DerivedRuntime`) ----
/** The loader API the full runtime gets from a lite fallback: + the lite-owned record ids and the fallen ones. */
interface HandOff extends DerivedLoaderApi {
  l: Map<number, unknown>;
  x: number[];
}
type Rec = [id: number, name: number, flags: number, rec: LiteRec, state: number /* 0 cold, 1 adopted, 2 fallback */];
let doc: Document, tail: BoundaryTail, api: DerivedLoaderApi, full: DerivedRuntime | undefined, handing: Promise<DerivedRuntime> | undefined;
// RT-DIET2 mixed lite (tail `l`): name index → its lite entry's URL index; the other records only the full runtime adopts.
let mixed: Record<number, number> | undefined;
const recs = new Map<number, Rec>(),
  // Boundary name index → its chunk module (tail v2 names table `n` → `u`).
  modules = new Map<number, Record<string, unknown> | Promise<unknown>>(),
  queue: HeldEvent[] = [];
const report = (error: unknown): void => api.f(error);
// A replay is running: the events it dispatches (a replayed click's `input` / `change`) act live, never held behind it.
let replaying = 0;
// The records around `node`, outermost first (the loader's walk: `data-b` ancestors, balanced `<!--b<id>-->` openers);
// mixed: those listening to `type` (the full runtime's `around`: a context-free unit adopts alone), and none of them a
// record without a lite entry or a document click listener's match (`data-g`: the router's links) — else null (the full
// runtime's).
const around = (node: EventTarget | null, type = ""): Rec[] | null => {
  const out = api
    .i(node as Node | null, mixed ? type : "")
    .reverse()
    .map((id) => recs.get(+id)!)
    .filter(Boolean);
  return mixed && (out.some((r) => !(r[1] in mixed!)) || tail.g?.some((g) => (node as Element | null)?.closest?.(g[1]))) ? null : out;
};
const load = (r: Rec): Record<string, unknown> | Promise<unknown> => {
  let m = modules.get(r[1]);
  if (!m) {
    const url = tail.u![mixed ? mixed[r[1]]! : tail.n[r[1]]![1]] ?? miss("" + r[1]);
    modules.set(r[1], (m = api.m(url).then((module) => (modules.set(r[1], module), module))));
  }
  return m;
};
const nodeOf = (r: Rec): Element | Comment | null => {
  if (r[2] & 2 /* ATTR */) return doc.querySelector('[data-b="' + r[0] + '"]');
  const walk = doc.createTreeWalker(doc.body, 128);
  for (let n: Node | null; (n = walk.nextNode());) if ((n as Comment).data == "b" + r[0]) return n as Comment;
  return null;
};
// Adopt `r` with its loaded module: true when done (or left to the full runtime), else the module promise.
function adopt(r: Rec): true | Promise<unknown> {
  if (r[4]) return true;
  const m = load(r);
  if (m instanceof Promise) return m;
  const mine: Eff[] = [];
  try {
    const name = tail.n[r[1]]![0],
      residual = m[name.slice(name.lastIndexOf("#") + 1) + "$a"] as LiteResidual | undefined,
      node = nodeOf(r);
    // `BROWSER` (2048, ruling R-22): the record must render in the browser (the full runtime does).
    if (r[2] & 2048 || !residual || !node) miss(name);
    own(mine, () => residual!(node!, r[3]));
    r[4] = 1;
  } catch (error) {
    // Left to the full runtime (which reports what it cannot adopt either); what the residual bound is released.
    if (DEV) console.warn("Rivet resume: lite residual of " + tail.n[r[1]]![0] + " (b" + r[0] + ") fell back", error);
    release(mine);
    r[4] = 2;
    fallback().catch(report);
  }
  return true;
}
// Units around `target`: true when all are adopted now (or the full runtime takes the page), else a promise for the next
// module.
function ready(target: EventTarget | null, type?: string): true | Promise<unknown> {
  const rs = around(target, type);
  if (!rs) return (fallback().catch(report), true);
  for (const r of rs) {
    const step = adopt(r);
    if (step !== true) return step;
  }
  return true;
}
// Hand the page to the full runtime (one-way): lite-owned records stay done there; queued events go with it.
function fallback(): Promise<DerivedRuntime> {
  // Mixed: the ordinary full runtime (tail `F`: its URL, then its fetch-ahead list, all imported at once — no import
  // waterfall), over the ordinary chunks of `n` / `u`; else the lite graph's copy (`dom-lite-full.ts`).
  return (handing ??= (tail.F ? Promise.all(tail.F.split(" ").map(api.m)).then((all) => all[0]) : import("./dom-lite-full.ts")).then((module) => {
    for (const type of types) doc.removeEventListener(type, dispatch);
    const rt = module.default as DerivedRuntime,
      l = new Map<number, unknown>(),
      x: number[] = [],
      probe = doc.createElement("i");
    for (const r of recs.values()) r[4] == 1 ? l.set(r[0], 0) : r[4] && x.push(r[0]);
    rt.start(tail, doc, { ...api, q: queue.splice(0), l, x } as HandOff);
    // The lite-bound types go on the full runtime's delegation (its `start` registered its default types already).
    for (const type of types) (doc as Document & { $$rvOn: On }).$$rvOn(probe, type, null);
    return (full = rt);
  }));
}
// A held event: its delegated handlers over its path, with the target's form state at dispatch; its default replays
// unless a handler canceled it (no cold-press focus emulation: residuals bind no pointer / focus handlers).
function replay([event, path, again, state]: HeldEvent): void {
  let canceled = false;
  const target = event.target as HTMLInputElement,
    control = target && "value" in target && target.localName != "button" && !/^(focus|blur)/.test(event.type),
    now = control ? [target.value, target.checked] : null;
  Object.defineProperty(event, "composedPath", { configurable: true, value: () => path });
  Object.defineProperty(event, "defaultPrevented", { configurable: true, get: () => canceled });
  Object.defineProperty(event, "preventDefault", { configurable: true, value: () => void (canceled = true) });
  const restore = (v: unknown[]): unknown => (
    target.value === v[0] || (target.value = v[0] as string),
    target.checked === v[1] || (target.checked = v[1] as boolean)
  );
  now && restore(state);
  replaying = 1;
  try {
    event.bubbles && types.has(event.type) && delegate(event, path);
  } finally {
    delete (event as { composedPath?: unknown }).composedPath;
    delete (event as { defaultPrevented?: unknown }).defaultPrevented;
    delete (event as { preventDefault?: unknown }).preventDefault;
    now && restore(now);
  }
  // Its default: the first event of its type the window's capture phase sees (`defaulted`; what that one's activation
  // fires — a label's click on its control, a submit button's submit — is live).
  const type = event.type,
    mark = (e: Event): void => (removeEventListener(type, mark, true), defaulted(e));
  try {
    canceled || (addEventListener(type, mark, true), again?.());
  } finally {
    replaying = 0;
    removeEventListener(type, mark, true);
  }
}
async function drain(): Promise<void> {
  while (queue.length) {
    const item = queue[0]!;
    try {
      for (let step = ready(item[0].target, item[0].type); step !== true; step = ready(item[0].target, item[0].type)) await step;
      // A fallback took the queue (the full runtime's `start` replays it); what came in meanwhile follows it.
      if (handing) return void (await handing, queue.splice(0).forEach((held) => full!.cold(held)));
      replay(item);
    } catch (error) {
      report(error);
    }
    queue.shift();
  }
}
const runtime: DerivedRuntime = {
  start(t, d, loader) {
    tail = t;
    doc = d;
    api = loader;
    mixed = t.l;
    eachRecord(t, (id, _parent, flags, name, signals, props) => {
      const v: Record<string, unknown> = {};
      for (let i = 0; i < signals.length; i += 2) v[signals[i] as string] = signals[i + 1];
      recs.set(id, [id, name, flags, { id, v, w: t.w, p: (props ?? {}) as Record<string, unknown> }, 0]);
    });
    for (const item of loader.q.splice(0)) runtime.cold(item);
  },
  on(event) {
    if (full) return full.on(event);
    if ((queue.length && !replaying) || handing) return false;
    const step = ready(event.target, event.type);
    if (step === true) return !handing;
    step.catch(() => {});
    return false;
  },
  cold(item) {
    if (full) return full.cold(item);
    if (queue.push(item) == 1) void drain();
  },
  w(target) {
    if (full) return full.w(target);
    const rs = around(target);
    if (!rs) return void fallback().then((rt) => rt.w(target), report);
    for (const r of rs) if (!r[4]) void Promise.resolve(load(r)).catch(report);
  },
  m(id) {
    if (full) return full.m(id);
    const r = recs.get(id);
    const step = r ? adopt(r) : true;
    return step === true ? Promise.resolve() : step.then(() => runtime.m(id));
  },
};
export default runtime;
