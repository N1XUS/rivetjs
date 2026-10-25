// Lite resume runtime (ZERO R4, 2026-10-25; ownership §3.1): adopts boundaries whose compiled DOM module exports a
// residual `<Name>$a(node, rec)` — the boundary's handlers, live bindings and keyed state only, written against the
// server nodes by path (`_lw`). No templates, no probe / align / claim pass, no lists, no Async: those boundaries are
// ordinary (`dom-derived.ts`). The default export implements the loader's `DerivedRuntime` contract, so the inline
// loader (`resume-loader-derived.ts`) starts either runtime from `data-rt`. One `@rivetjs/reactivity` instance and one
// delegated event table (`dom-v2.ts` `_on`) shared with the full runtime: a lite unit and an ordinary unit on one page
// see the same batching, held-event order and document listeners.
//
// Fallback (one-way, per boundary): a residual that throws (`LiteMiss`: a node the path expected is missing, a value it
// cannot write, a cross-unit wake key) leaves that boundary to the full runtime: its root is disposed, the full runtime
// (`dom-derived.ts`, a dynamic import: the bundler's chunk, never fetched unless a fallback happens) starts with the
// lite-owned records marked done (`api.l`), and every later call of this instance forwards to it. A boundary never goes
// back to lite.
import { _bindingEffect1, createRoot, signal } from "@rivetjs/reactivity";
import type { Disposer, Signal } from "@rivetjs/reactivity";
import { _attrValue } from "./dom-attr.ts";
import { _delegateBelow, _on } from "./dom-events.ts";
import { _setProp } from "./dom-base.ts";
import type { DerivedLoaderApi, DerivedRuntime, HeldEvent } from "./dom-derived.ts";
import type { BoundaryTail } from "./resume-format.ts";
import { eachRecord } from "./resume-tail.ts";
import { DEV } from "#dev";

/**
 * A boundary record as a residual sees it: its id, its keyed values by key (absent key ⇒ the site's init, LIT) and the
 * page's wake lists (tail `w`: a key another boundary reads is not lite).
 */
export interface LiteRec {
  readonly id: number;
  readonly v: Record<string, unknown> | undefined;
  readonly w?: Record<string, number[]> | undefined;
}
/** The residual of a boundary (`<Name>$a`): binds its handlers, bindings and keyed state over the server nodes. */
export type LiteResidual = (node: Element | Comment, rec: LiteRec) => void;

const ATTR = 2;
// A residual cannot adopt this server markup (thrown; the boundary falls back to the full runtime).
const miss = (what: string): never => {
  throw Error("LiteMiss " + what);
};

/**
 * Walk from `n` by `path`: `f` firstChild, `n` nextSibling, `h` from a content opener `<!--[-->` to its balanced
 * `<!--]-->`. Throws `LiteMiss` when the walk leaves the server nodes (prod checks the end only).
 */
export function _lw(n: Node, path: string): Node {
  let x: Node | null = n;
  for (let i = 0; x && i < path.length; i++) {
    const c = path[i];
    if (c === "f") x = x.firstChild;
    else if (c === "n") x = x.nextSibling;
    else
      for (let depth = 0, s: Node | null = x.nextSibling; (x = s); s = s.nextSibling) {
        const d = s.nodeType === 8 ? (s as Comment).data : null;
        if (d === "[") depth++;
        else if (d === "]" && !depth--) break;
      }
  }
  return x ?? miss(path);
}

/**
 * A keyed signal of the boundary (`key` = the compiler's keyed site key, as `_sig`): the record's value, else `init`.
 * A key another boundary's binding reads (tail wake list) is not lite: `LiteMiss`.
 */
export function _ls<T>(r: LiteRec, key: string, init?: T): Signal<T> {
  if (r.w?.[r.id + "." + key]) miss(key);
  return signal((r.v && key in r.v ? r.v[key] : init) as T);
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
    const t = at.nodeType === 1 ? at.firstChild : at.nextSibling;
    v = t?.nodeType === 3 ? (t as Text).data : t === null || t.nodeType === 8 ? "" : miss(key);
    if (codec && ((v = +(v as string)), v !== v || (v as string) === "")) miss(key);
  } else {
    const el = at as Element;
    v = codec === 2 ? el.hasAttribute(name!) : (el.getAttribute(name!) ?? miss(key));
  }
  return signal(v as T);
}

// Delegated bubbling handler (shared table with the full runtime and client renders).
export const _le = (_r: LiteRec, el: Element, type: string, fn: (event: Event) => unknown): void => _on(el, type, fn);

const scalar = (v: unknown): string =>
  v == null || typeof v === "boolean" ? "" : typeof v === "object" || typeof v === "function" || typeof v === "symbol" ? miss("text") : String(v);
const text = (t: Text, fn: () => unknown): void => {
  const s = scalar(fn());
  if (t.data !== s) t.data = s;
};
/**
 * A dynamic text slot: `at` = its content opener `<!--[-->` (server `<!--[-->text<!--]-->`), or the element whose sole
 * child it is (`<span>text</span>`); an empty value has no Text node on the server: one is inserted. Scalars only (a node
 * / array / accessor value is ordinary content: `LiteMiss`).
 */
export function _lt(at: Node, fn: () => unknown): void {
  const sole = at.nodeType === 1;
  let t = sole ? at.firstChild : at.nextSibling;
  if (!t || t.nodeType !== 3) (sole ? at : at.parentNode!).insertBefore((t = at.ownerDocument!.createTextNode("")), sole ? null : t);
  _bindingEffect1(text, t as Text, fn);
}
/** A dynamic attribute (same write rules as a client render: booleans, URL checks, form properties). */
export const _la = (el: Element, name: string, fn: () => unknown): void => _attrValue(el, name, fn);
const prop = (el: Element, name: string, fn: () => unknown): void => _setProp(el, name, fn());
/** A dynamic DOM property (`prop:x`; same name / URL checks as a client render). */
export const _lp = (el: Element, name: string, fn: () => unknown): void => _bindingEffect1(prop, el, name, fn);

// ---- the runtime instance (loader contract `DerivedRuntime`) ----
/** The loader API the full runtime gets from a lite fallback: + the lite-owned record ids and the fallen ones. */
interface HandOff extends DerivedLoaderApi {
  l: Map<number, Disposer>;
  x: number[];
}
type Rec = [id: number, name: string, flags: number, rec: LiteRec, state: number /* 0 cold, 1 adopted, 2 fallback */];
let tail: BoundaryTail, doc: Document, api: DerivedLoaderApi, full: DerivedRuntime | undefined, handing: Promise<DerivedRuntime> | undefined;
const recs = new Map<number, Rec>(),
  modules = new Map<string, Record<string, unknown> | Promise<unknown>>(),
  owned = new Map<number, Disposer>(),
  // Boundary name → its chunk URL (tail v2 names table `n` → `u`).
  chunks = new Map<string, string>(),
  pending: HeldEvent[] = [];
const exportOf = (name: string): string => name.slice(name.lastIndexOf("#") + 1) + "$a";
const report = (error: unknown): void => api.f(error);
// The boundary ids around `node`, outermost first (`data-b` ancestors, balanced `<!--b<id>-->` openers before them).
function around(node: Node | null): Rec[] {
  const out: Rec[] = [];
  for (let n = node; n && n.nodeType !== 9; n = n.parentNode) {
    const b = (n as Element).getAttribute?.("data-b");
    b && out.push(recs.get(+b)!);
    for (let s = n.previousSibling, depth = 0; s; s = s.previousSibling)
      if (s.nodeType === 8) {
        const d = (s as Comment).data;
        d === "/b" ? depth++ : /^b\d+$/.test(d) && (depth ? depth-- : out.push(recs.get(+d.slice(1))!));
      }
  }
  return out.filter(Boolean).reverse();
}
const load = (r: Rec): Record<string, unknown> | Promise<unknown> => {
  const url = chunks.get(r[1]);
  let m = modules.get(r[1]);
  if (!m) {
    if (!url) return miss(r[1]);
    modules.set(r[1], (m = api.m(url).then((module) => (modules.set(r[1], module), module))));
  }
  return m;
};
const nodeOf = (r: Rec): Element | Comment | null => {
  if (r[2] & ATTR) return doc.querySelector('[data-b="' + r[0] + '"]');
  const walk = doc.createTreeWalker(doc.body, 128);
  for (let n: Node | null; (n = walk.nextNode());) if ((n as Comment).data === "b" + r[0]) return n as Comment;
  return null;
};
// Adopt `r` with its loaded module: true when done (or left to the full runtime), else the module promise.
function adopt(r: Rec): true | Promise<unknown> {
  if (r[4]) return true;
  const m = load(r);
  if (m instanceof Promise) return m;
  try {
    const residual = m[exportOf(r[1])] as LiteResidual | undefined,
      node = nodeOf(r);
    if (!residual || !node) miss(r[1]);
    createRoot((dispose) => {
      owned.set(r[0], dispose);
      try {
        residual!(node!, r[3]);
      } catch (error) {
        owned.delete(r[0]);
        dispose();
        throw error;
      }
    });
    r[4] = 1;
  } catch (error) {
    // Left to the full runtime (which reports what it cannot adopt either).
    if (DEV) console.warn("Rivet resume: lite residual of " + r[1] + " (b" + r[0] + ") fell back", error);
    r[4] = 2;
    fallback().catch(report);
  }
  return true;
}
// Units around `target`: true when all are adopted now, else a promise for the next module.
function ready(target: EventTarget | null): true | Promise<unknown> {
  for (const r of around(target as Node | null)) {
    const step = adopt(r);
    if (step !== true) return step;
  }
  return true;
}
// Hand the page to the full runtime (one-way): lite-owned records stay done there; queued events go with it.
function fallback(): Promise<DerivedRuntime> {
  return (handing ??= import("./dom-derived.ts").then((module) => {
    const rt = module.default as DerivedRuntime;
    rt.start(tail, doc, { ...api, q: pending.splice(0), l: owned, x: [...recs.values()].filter((r) => r[4] > 1).map((r) => r[0]) } as HandOff);
    return (full = rt);
  }));
}
// A held event: its delegated handlers over its path, with the target's form state at dispatch; its default replays
// unless a handler canceled it (no cold-press focus emulation: residuals bind no pointer / focus handlers).
function replay([event, path, again, state]: HeldEvent): void {
  let canceled = false;
  const target = event.target as HTMLInputElement,
    control = target && "value" in target && target.localName !== "button" && !/^(focus|blur)/.test(event.type),
    now = control ? [target.value, target.checked] : null;
  Object.defineProperty(event, "composedPath", { configurable: true, value: () => path });
  Object.defineProperty(event, "defaultPrevented", { configurable: true, get: () => canceled });
  Object.defineProperty(event, "preventDefault", { configurable: true, value: () => void (canceled = true) });
  if (now && (now[0] !== state[0] || now[1] !== state[1])) ((target.value = state[0] as string), (target.checked = state[1] as boolean));
  try {
    _delegateBelow(event, doc);
  } finally {
    delete (event as { composedPath?: unknown }).composedPath;
    delete (event as { defaultPrevented?: unknown }).defaultPrevented;
    delete (event as { preventDefault?: unknown }).preventDefault;
    if (now && (target.value !== now[0] || target.checked !== now[1])) ((target.value = now[0] as string), (target.checked = now[1] as boolean));
  }
  canceled || again?.();
}
async function drain(): Promise<void> {
  while (pending.length) {
    const item = pending[0]!;
    try {
      for (let step = ready(item[0].target); step !== true; step = ready(item[0].target)) await step;
      // A fallback took the queue (the full runtime's `start` replays it); what came in meanwhile follows it.
      if (handing) return void (await handing, pending.splice(0).forEach((held) => full!.cold(held)));
      replay(item);
    } catch (error) {
      report(error);
    }
    pending.shift();
  }
}
// Bubbling types the loader holds by default: registered on the document first (same order as the full runtime).
const DELEGATED = ["click", "input", "change", "submit", "keydown", "pointerdown", "pointerup", "mousedown", "mouseup", "focusin", "focusout"];
const runtime: DerivedRuntime = {
  start(t, d, loader) {
    tail = t;
    doc = d;
    api = loader;
    const probe = d.createElement("i");
    for (const type of DELEGATED) _on(probe, type, null);
    const n = t.n;
    for (const [name, url] of n) if (url >= 0) chunks.set(name, t.u![url]!);
    eachRecord(t, (id, _parent, flags, name, signals) => {
      const v: Record<string, unknown> = {};
      for (let i = 0; i < signals.length; i += 2) v[signals[i] as string] = signals[i + 1];
      recs.set(id, [id, n[name]![0], flags, { id, v, w: t.w }, 0]);
    });
    for (const item of loader.q.splice(0)) runtime.cold(item);
  },
  on(event) {
    if (full) return full.on(event);
    if (pending.length || handing) return false;
    const step = ready(event.target);
    if (step === true) return !full;
    step.catch(() => {});
    return false;
  },
  cold(item) {
    if (full) return full.cold(item);
    if (pending.push(item) === 1) void drain();
  },
  w(target) {
    if (full) return full.w(target);
    for (const r of around(target as Node | null)) if (!r[4]) void Promise.resolve(load(r)).catch(report);
  },
  m(id) {
    if (full) return full.m(id);
    const r = recs.get(id);
    const step = r ? adopt(r) : true;
    return step === true ? Promise.resolve() : step.then(() => runtime.m(id));
  },
};
export default runtime;
