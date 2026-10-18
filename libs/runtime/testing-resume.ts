// Resumability unit tests without a browser (`@rivetjs/runtime/testing/resume`, Function Bridge T30; answers Qwik #5515).
// Dev-only: nothing in the runtime imports this entry. `serializeAndRevive(make)` runs `make` where a component body runs
// (inside the server recorder: compiled `_rFn` / `_rCell` / `_rStorePaths` / `reconstruct` sites register only during a
// render), encodes its result as the captures of one client effect — the same recorder, table, reach graph and chunk
// lists a page capture gets — then decodes it in this process the way `dom-resume` does: the symbols through their
// compiled browser chunks (the test register's `?rivet-resume=chunk` modules, or `symbols` overrides), `resume-builtins`
// only when the state lists it. Errors are the runtime's own: the encoder's refusals as a page render throws them, the
// browser decoder's skew / missing-symbol errors with the same messages (development hints included).
// Keep the decoder hooks below in sync with dom-resume.ts `start()` (its `createDecoder` hooks, `named`, `symbol`,
// `liveProps`): a copy, so the runtime entry pays nothing for this helper; tests/serialize-and-revive.test.ts guards the
// entry kinds and error messages against dom-resume.ts.
import { signal, computed, createRoot, getOwner, provide, runWithOwner } from "@rivetjs/reactivity";
import type { Owner } from "@rivetjs/reactivity";
import { resumableToString, _rEffect } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { createDecoder, _placeholderContext } from "@rivetjs/runtime/resume-format";
import type { ResumeState, SymbolRef } from "@rivetjs/runtime/resume-format";
import { DEV } from "#dev";
import { _rSyms } from "@rivetjs/runtime/resume-symbols";

export interface SerializeAndReviveOptions {
  /**
   * Browser chunks by resume module id (`src/cart.tsx`, the id prefix before `#`): a compiled symbol module namespace
   * (what `_compileSymbolModule` emits; e.g. the next deploy's chunk to test skew). Modules not listed load through the
   * test register (`?rivet-resume=chunk` of the module the server imported with `?rivet-resume=server`).
   */
  symbols?: Record<string, Record<string, unknown>>;
  /**
   * Browser globals defined on `globalThis` while the value decodes — when revivers run (`static [revive]`,
   * `registerClass` hooks, built-in entries such as same-origin URLs reading `location`) — and restored right after:
   * nothing leaks past the call. A `reconstruct` factory and a revived function run later, when the test calls them,
   * and see the test's own globals then. Default: none.
   */
  platform?: Record<string, unknown>;
  /** Called with the page's parsed resume state (wire form) before it decodes: assert what is (not) shipped. */
  state?: (state: ResumeState) => void;
  /** Context values for `context` entries (`resumableContext` tokens), as `createResume({ contexts })` gets them. */
  contexts?: Array<[{ id?: string }, unknown]>;
}

// The effect symbol the value is captured by: refusals read "Cannot resume serializeAndRevive#value: …" (development:
// "… capture `value` …"), where a page names its handler symbol.
const FX = "serializeAndRevive#value";
const CHUNK = "rivet-test:";
const BUILTINS = "rivet-test:builtins";
/** Resume modules the test register compiled for the server (module id → file URL, symbol id → capture names). */
interface Registry {
  modules: Map<string, string>;
  captures: Map<string, readonly string[]>;
}
const registry = (): Registry =>
  ((globalThis as { [key: symbol]: Registry })[Symbol.for("rivet.testing.resume")] ??= { modules: new Map(), captures: new Map() });

/**
 * Encode `make()`'s result as a resumed page would and decode it as the browser would; resolves to the revived value.
 * `make` returns the value itself (call a PascalCase function of a resume-compiled module that builds and returns it):
 * captures register only while a component-like function runs inside the recorder, and a component returning JSX
 * gives markup, not a value.
 */
export async function serializeAndRevive<T>(make: () => T, options: SerializeAndReviveOptions = {}): Promise<T> {
  const { modules, captures } = registry();
  const manifest = {
    runtime: CHUNK + "runtime",
    builtins: BUILTINS,
    // Every symbol's chunk is its module (one chunk per resume module, as the Vite plugin's default chunking).
    symbols: new Proxy({}, { get: (_, id) => (typeof id === "string" ? CHUNK + id.slice(0, id.indexOf("#")) : undefined) }),
    captures: new Proxy({}, { get: (_, id) => (id === FX ? ["value"] : typeof id === "string" ? captures.get(id) : undefined) }),
  } as ResumeManifest;
  const html = await resumableToString(
    () => {
      _rEffect(FX, [make()]);
      return "" as never;
    },
    { manifest },
  );
  const script = /<script type="rivet\/state"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!script) throw new Error("serializeAndRevive: the render wrote no resume state");
  const state = JSON.parse(script[1]!) as ResumeState;
  options.state?.(state);
  return browser(() => revive_(state, modules, options));
}

// The browser half runs with its own `registerClass` registry (resume-format `_CLASSES`), as a separate page would: the
// browser modules register their classes there (an id the server half registered for its own copy of the class is not
// a conflict), and revivers are looked up there. Swapped in for chunk evaluation + decode only.
const CLASSES = Symbol.for("rivet.classes"),
  BROWSER_CLASSES = Symbol.for("rivet.testing.browserClasses");
async function browser<T>(run: () => Promise<T>): Promise<T> {
  const g = globalThis as { [key: symbol]: unknown };
  const server = g[CLASSES];
  g[CLASSES] = g[BROWSER_CLASSES];
  try {
    return await run();
  } finally {
    g[BROWSER_CLASSES] = g[CLASSES];
    g[CLASSES] = server;
  }
}

async function revive_<T>(state: ResumeState, modules: Map<string, string>, options: SerializeAndReviveOptions): Promise<T> {
  // The chunks the page lists (the effect's `needs`): symbol modules, and the built-in decoders when an entry needs them.
  const loaded: (Record<string, unknown> | undefined)[] = [];
  for (const [i, url] of state.c.entries()) {
    if (url === BUILTINS) await import("@rivetjs/runtime/resume-builtins");
    else if (url.startsWith(CHUNK)) {
      const module = url.slice(CHUNK.length);
      const file = modules.get(module);
      loaded[i] = options.symbols?.[module] ?? (file ? ((await import(file + "?rivet-resume=chunk")) as Record<string, unknown>) : undefined);
    }
  }
  // The value's effect, by symbol: effects `make()` registered itself (a resume-compiled `clientEffect` in a component it
  // calls) come first in `fx`.
  const { ids } = names(state);
  const effect = state.fx.find(([ref]) => (typeof ref === "string" ? ref : ids[ref]) === FX);
  if (!effect) throw new Error("serializeAndRevive: the page state has no " + FX + " effect");
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(options.platform ?? {})) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true, enumerable: false });
  }
  try {
    const decoder = createDecoder(state.t, hooks(state, loaded, options.contexts ?? []));
    return decoder.get((effect[1] as number[])[0]!) as T;
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  }
}

// `state.s` → symbol ids + chunk indexes (dom-resume `named`: `#…` continues the previous module, `$a$b` its component).
function names(state: ResumeState): { ids: string[]; homes: number[] } {
  const ids: string[] = [],
    homes: number[] = [];
  let home = -1,
    unit = "",
    component = "";
  for (const x of state.s) {
    if (typeof x === "number") {
      home = x;
      continue;
    }
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
  return { ids, homes };
}

// dom-resume's decoder hooks, minus the document: no element refs, routers or ErrorBoundary resets (a value holding one
// throws, naming it).
function hooks(state: ResumeState, loaded: (Record<string, unknown> | undefined)[], contexts: Array<[{ id?: string }, unknown]>) {
  const root = createRoot(() => getOwner()).value;
  const byId = new Map(contexts.map(([token, value]) => [token.id, value]));
  const { ids, homes } = names(state);
  // dom-resume `symbol`: same errors (a missing chunk / a chunk without the id = deploy skew, `error.skew`).
  const symbol = (ref: SymbolRef): ((...captures: unknown[]) => unknown) => {
    const id = typeof ref === "string" ? ref : ids[ref]!,
      at = typeof ref === "number" ? homes[ref] : undefined,
      module = at === undefined ? undefined : loaded[at];
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
    const hash = id.indexOf("#"),
      table = _rSyms[id.slice(0, hash)];
    const fn = (table?.[id.slice(hash + 1)] ?? (module.__rivet ? (module.__rivet as (id: string) => unknown)(id) : module[id.slice(hash + 1)])) as
      ((...c: unknown[]) => unknown) | undefined;
    if (typeof fn == "function") return fn;
    throw Object.assign(new Error((DEV ? "Resume symbol is missing from its chunk (deploy skew): " : "Resume symbol is not loaded: ") + id), { skew: id });
  };
  const within = (list: unknown[]): Owner | null => {
    const nest = (i: number): Owner | null =>
      i === list.length ? getOwner() : provide(_placeholderContext(list[i] as string), list[i + 1], () => nest(i + 2));
    return runWithOwner(root, () => createRoot(() => nest(0))).value;
  };
  const unsupported = (kind: string): never => {
    throw new TypeError("serializeAndRevive: a `" + kind + "` entry needs a document (resume it in a browser test)");
  };
  return {
    signal: (_: number, options: Parameters<typeof signal>[1]) => signal<unknown>(undefined, options),
    computed: (id: SymbolRef, captures: unknown[], options: Parameters<typeof computed>[1], scoped?: 1) =>
      runWithOwner(scoped ? within(captures.pop() as unknown[]) : root, () => computed(symbol(id)(...captures) as () => unknown, options)),
    fn: (id: SymbolRef, captures: unknown[]) => runWithOwner(root, () => symbol(id)(...captures)),
    custom: (kind: string, args: unknown[]) => {
      if (kind === "const") return () => args[0];
      if (kind === "bind") return (args[0] as (...a: unknown[]) => unknown).bind(args[1], ...args.slice(2));
      if (kind === "store") {
        const node = { ...(args[1] as object), v: args[0] };
        if (DEV && args[2]) DEV.resumeStore(node, args[2] as string[]);
        return node;
      }
      if (kind === "ctx") return _placeholderContext(args[0] as string);
      if (kind === "m") return { [Symbol.for("rivet.forward")]: args };
      if (kind === "props") return props(args);
      if (kind === "href") return new URL(args[0] as string, (globalThis as { location?: Location }).location?.href ?? "http://localhost/").href;
      if (kind === "router" || kind === "reset") return unsupported(kind);
      throw new TypeError("Unknown resume entry kind " + kind);
    },
    context: (id: string) => {
      if (!byId.has(id)) throw new Error(DEV ? DEV.hint("Missing resume context: " + id, "context") : "Missing resume context: " + id);
      return byId.get(id);
    },
    ref: () => unsupported("ref"),
  } as Parameters<typeof createDecoder>[1];
}

// dom-resume `liveProps`: a props object whose forwarded keys read the last defined source.
function props(args: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i] as string,
      v = args[i + 1];
    const box = v !== null && typeof v === "object" ? (v as { [key: symbol]: Record<string, unknown>[] | undefined })[Symbol.for("rivet.forward")] : undefined;
    if (box)
      Object.defineProperty(out, key, {
        enumerable: true,
        configurable: true,
        get() {
          const name = box[0] as unknown as string;
          for (let s = box.length - 1; s > 0; s--) if (box[s]![name] !== undefined) return box[s]![name];
          return undefined;
        },
      });
    else if (key === "__proto__") Object.defineProperty(out, key, { value: v, writable: true, enumerable: true, configurable: true });
    else out[key] = v;
  }
  return out;
}

/** A plain value (no compiled sites: data, signals, classes registered at module load) through the same round trip. */
export const serializeValue = <T>(value: T, options?: SerializeAndReviveOptions): Promise<T> => serializeAndRevive(() => value, options);

/**
 * Import a `.tsx` / `.jsx` module compiled in resume mode: `"server"` (default; build the values to revive with it) or
 * `"browser"`, the copy the revived values come from (its classes, its module functions), evaluated in the browser half.
 */
export const importResume = <M = Record<string, unknown>>(url: string | URL, side: "server" | "browser" = "server"): Promise<M> => {
  const target = new URL(url);
  target.searchParams.set("rivet-resume", side === "server" ? "server" : "dom");
  const href = target.href;
  return side === "server" ? (import(href) as Promise<M>) : browser(() => import(href) as Promise<M>);
};
