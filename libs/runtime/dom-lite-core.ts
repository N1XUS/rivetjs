// Lite runtime core (RT-DIET, 2026-10-26): the nano signal + binding graph of the lite world, its delegated events and the
// server-node walk, shared by the lite runtime instance (`dom-lite.ts`) and the binding leaves residuals import through it
// (`dom-lite-attr.ts`, `dom-lite-list.ts`, `dom-lite-model.ts`: each its own module, so a page's lite runtime chunk carries
// only what that build's residuals use, not the union every page of the site uses).
import type { Signal } from "@rivetjs/reactivity";

// ---- nano reactivity (closed world: residual state only) ----
export interface Eff {
  f: () => void;
  d: Set<Set<Eff>>;
  /** Released (a removed list row's binding): never runs again. */
  x?: 1;
  /** A disposer (`onRelease`): runs when released (a conditional subtree releases what its current branch bound). */
  r?: () => void;
}
let observer: Eff | null = null,
  depth = 0,
  // Effects created by the running residual (released when it throws).
  made: Eff[] | null = null,
  // A first mouse click's flush, deferred one task (`_dispatch`: Chrome's first-click frame stall).
  held = false;
const pending = new Set<Eff>(),
  settled = new WeakSet<object>();
let port: MessagePort | undefined;
function run(e: Eff): void {
  for (const s of e.d) s.delete(e);
  e.d.clear();
  if (e.x) return;
  const previous = observer;
  observer = e;
  try {
    e.f();
  } finally {
    observer = previous;
  }
}
function flush(): void {
  held = false;
  for (const e of pending) (pending.delete(e), run(e));
}
export const effect = (f: () => void): void => {
  const e: Eff = { f, d: new Set() };
  made?.push(e);
  run(e);
};
export const release = (effects: Eff[]): void => {
  for (const e of effects) {
    e.x = 1;
    e.r?.();
    for (const s of e.d) s.delete(e);
  }
};
/** Run `r` when the bindings being made now are released (JS-DIET-2: a conditional subtree's later branches). */
export const onRelease = (r: () => void): void => void made?.push({ f: r, d: new Set(), r });
/** Run `fn` reading nothing (no dependency for the running binding). */
export function untracked<T>(fn: () => T): T {
  const previous = observer;
  observer = null;
  try {
    return fn();
  } finally {
    observer = previous;
  }
}
/** Run `fn` collecting the bindings it makes into `list` (also into the enclosing collection: a failing adopt releases them). */
export function own<T>(list: Eff[], fn: () => T): T {
  const outer = made;
  made = list;
  try {
    return fn();
  } finally {
    made = outer;
    outer?.push(...list);
  }
}
/** A signal of the lite world (the `@rivetjs/reactivity` `Signal` API: call to read, `set`, untracked `update`). */
export function signal<T>(value: T): Signal<T> {
  const o = new Set<Eff>(),
    get = (() => (observer && (o.add(observer), observer.d.add(o)), value)) as Signal<T>;
  get.set = (next: T): T => {
    if (held && !depth) flush();
    if (!Object.is(value, next)) {
      value = next;
      for (const e of o) pending.add(e);
      depth || flush();
    }
    return value;
  };
  get.update = (fn: (value: T) => T): T => untracked(() => get.set(fn(value)));
  return get;
}

// ---- delegated events: one listener per type, handlers on the nodes (`dom-events.ts` fields) ----
export const types = new Set<string>();
export type On = (el: Element, type: string, fn: ((event: Event) => unknown) | null) => void;
// Run the handlers on `path` (the propagation path fixed at dispatch), batched; the first trusted mouse click per document
// whose handlers queued work flushes one task later (as reactivity `_dispatch`).
export function delegate(event: Event, path: EventTarget[] = event.composedPath()): void {
  if (held) flush();
  const key = "$r" + event.type,
    view = (event as UIEvent).view;
  depth++;
  try {
    for (const node of path) {
      const handler = (node as unknown as Record<string, ((event: Event) => unknown) | undefined>)[key];
      if (handler) {
        Object.defineProperty(event, "currentTarget", { configurable: true, value: node });
        handler.call(node, event);
        if (event.cancelBubble) {
          event.stopImmediatePropagation();
          break;
        }
      }
    }
  } finally {
    depth--;
    delete (event as { currentTarget?: unknown }).currentTarget;
    if (pending.size)
      if (event.isTrusted && event.type == "click" && (event as PointerEvent).pointerType == "mouse" && view && !settled.has(view)) {
        settled.add(view);
        held = true;
        if (!port) {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => held && flush();
          port = channel.port2;
        }
        port.postMessage(0);
      } else flush();
  }
}
// The default a replay dispatches (`dom-lite.ts` `replay`: the loader's `requestSubmit()`, a link's re-dispatched click)
// reaches native listeners and the browser, not the handlers that ran on the held event (RESUME-FIX A1).
let ran: Event | undefined;
export const dispatch = (event: Event): void => void (event == ran || delegate(event));
/** The event a replay dispatches as a held event's default (`dom-lite.ts`): its handlers ran already. */
export const defaulted = (event: Event): void => void (ran = event);
// A full runtime on the page (R5: it adopts this residual; or the lite runtime handed over) owns the delegation
// (`dom-derived.ts` sets `$$rvOn` = `dom-events.ts` `_on`): one document listener per type, never two.
export function on(el: Element, type: string, fn: ((event: Event) => unknown) | null): void {
  const d = el.ownerDocument as Document & { $$rvOn?: On },
    full = d.$$rvOn;
  if (full) return full(el, type, fn);
  (((el as unknown as Record<string, unknown>)["$r" + type] = fn), ((el as unknown as { $$o: null }).$$o = null));
  types.has(type) || (types.add(type), d.addEventListener(type, dispatch));
}

// A residual cannot adopt this server markup (thrown; the boundary falls back to the full runtime).
export const miss = (what: string): never => {
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
    if (c == "f") x = x.firstChild;
    else if (c == "n") x = x.nextSibling;
    else
      for (let depth = 0, s: Node | null = x.nextSibling; (x = s); s = s.nextSibling) {
        const d = s.nodeType == 8 ? (s as Comment).data : "";
        // Openers: content `[`, list rows `r[` / `r<i>[`.
        if (d.endsWith("[")) depth++;
        else if (d == "]" && !depth--) break;
      }
  }
  return x ?? miss(path);
}
