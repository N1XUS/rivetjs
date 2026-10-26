// ZERO CALLSITE (2026-10-26): the per-call-site context proof of the derived model. `boundaryFacts()` (facts-fixpoint.ts)
// calls `callSites()` when the build passes `contexts` options (vite.ts `derivedWalk`, modules walked with `refs: true`).
//
// A boundary instance adopts standalone (an independent record: the browser runs the component over its own nodes, with
// the props from its record and no owner above it) only when its render reads nothing an ancestor provides. The
// component-level verdict (`independent`) checks data props; this proof adds the contexts, per call site:
//
// - `touch(B)`: the context tokens a module-level binding may read or provide, closed over the module reference graph
//   (Rust `facts_refs.rs`: per top-level declaration, the bindings / imports it references as values, as JSX tags and as
//   the token argument of a context reader call) across modules (imports through re-exports and `export *`; a namespace
//   import reaches every declaration of its module). A token is a top-level `const X = createContext(…)`; a reference to
//   a module outside the walk counts as that module's pseudo-token unless the build says it holds no context
//   (`external`: the reactivity / runtime packages, assets, npm packages without an `@rivetjs/*` dependency); code the
//   graph cannot follow (`import(expression)`, `eval`, `require`, `new Function`, an export it cannot resolve) is TOP
//   (unprovable; a literal `import("…")` reaches that module); a token created at run time (`createContext` in a
//   function) is the `!dyn` pseudo-token; `catchError` / `ErrorBoundary` the `!err` one, which every unit touches (a
//   handler above catches what the unit throws); the runtime's `Suspense` / `Async` / `resource` / `lazy` the
//   `!suspense` one.
// - `prov(B)`: what a binding may provide — `touch` without the reads: a token passed straight to the reactivity
//   package's `useContext` or the cdk slots readers (`contextProps` / `slottedContext`, resolved through imports and
//   re-exports, not by name) is read, never provided (any other use of a token counts as a provision).
// - `above(site)`: what may be provided above a call site — the caller's own code (`prov` of its value references: hooks
//   it calls, `provide(…)`, not the components it renders), the components enclosing the site in the caller's JSX (their
//   `prov`; an unresolved one is TOP unless a runtime `For` / `Show` / `Index` / `Switch` / `Match`, `<X.Provider>` = X),
//   and `above` of every site of the caller, up to the page: a shell page (docs-kit frame) has its `_layout` files and
//   the frame hosts (`hosts`) above it — a host's provisions leave out the shell page modules it loads and their
//   generated wrappers (what a page provides sits below it); a route root, a component used as a value or one without a
//   resolved call site: TOP.
// - A site is proven when its call passes data only (`calls[].data`, no function) and `touch(callee) ∩ above(site)` is
//   empty (neither holding TOP). A dependent boundary (`dependentBecause` `context` / `call-site`) with a props object
//   parameter gets the proven sites (`site` / `sites`: its server `_rB` takes the props, `SITE`; the caller passes them
//   through `_rS`, which makes that instance independent and `CTXFREE`); an independent one whose every site is proven is
//   `free` (`CTXFREE`: the browser adopts it without its ancestors, `dom-derived.ts` `around`). Unproven: as before.
import type { BoundaryVerdict } from "./facts-fixpoint.ts";
import type { ModuleFacts } from "./index.ts";

/** The build's knowledge of what the walk does not see. */
export interface ContextOptions {
  /**
   * A module outside the walk that `file` imports (`specifier`): null when it holds no context an app's code could
   * provide or read (the reactivity / runtime packages, an asset, an npm package without an `@rivetjs/*` dependency),
   * else its pseudo-token (code touching the same one may read what the other provides).
   */
  external(file: string, specifier: string): string | null;
  /** Components (`file#Name`, or `file` for its default export) rendered above every shell page: the frame hosts. */
  hosts?: ReadonlySet<string>;
  /** Census: overlap results name the shared tokens. */
  debug?: boolean;
}

/** Why a site or a free candidate is not proven (census, `RIVET_CALLSITE_TRACE`). */
export type Unproven = "not-data" | "touch-top" | "above-top" | "overlap";

export interface CallSiteSite {
  caller: string;
  index: number;
  data: boolean;
  fn: boolean;
  around: (string | null)[];
  tags: string[];
}

export interface CallSiteInput {
  facts: Map<string, ModuleFacts>;
  target(file: string, spec: string): string | null;
  /** Callee component key (`file?name`) → its call sites. */
  sites: Map<string, CallSiteSite[]>;
  verdicts: Map<string, Map<string, BoundaryVerdict>>;
  isRoot(id: string): boolean;
  escaped: ReadonlySet<string>;
  shell(id: string): boolean;
  options: ContextOptions;
}

export interface CallSites {
  /** Component names of `file` independent at their proven sites only (`resume.site`). */
  site(file: string): string[];
  /** Proven call sites in `file`: `Caller:index` (`resume.sites`). */
  sites(file: string): string[];
  /** Independent component names of `file` whose every site is proven (`resume.free`). */
  free(file: string): string[];
  /** Census: per callee key, per site, the proof result. */
  trace: Map<string, (Unproven | "proven")[]>;
  /** Census: a path from a component to an unprovable binding (`file\0name` labels), or to a token of `tokenName`. */
  why(id: string, tokenName?: string): string[];
  whyAbove(id: string, tokenName?: string): string[];
}

const TOP = 0;
const RUNTIME_TAGS = new Set(["For", "Show", "Index", "Switch", "Match"]);
const ERR_NAMES = new Set(["catchError", "ErrorBoundary"]);
// Runtime names that provide / read the Suspense context (a pseudo-token of their own: the runtime is otherwise context-free).
const SLOTS = /[/\\]cdk[/\\]slots[/\\]index\.[jt]sx?$/;
const SLOT_READERS = new Set(["contextProps", "slottedContext"]);
const SUSPENSE_NAMES = new Set(["Suspense", "Async", "resource", "lazyComponent", "lazy"]);

export function callSites(input: CallSiteInput): CallSites {
  const { facts, target, options } = input;
  // ---- Tokens: interned ids (0 = TOP).
  const tokenIds = new Map<string, number>([["⊤", TOP]]);
  const names: string[] = ["⊤"];
  const token = (name: string): number => {
    let id = tokenIds.get(name);
    if (id === undefined) (tokenIds.set(name, (id = tokenIds.size)), (names[id] = name));
    return id;
  };
  const ERR = token("!err"),
    DYN = token("!dyn"),
    SUSPENSE = token("!suspense");
  // ---- Binding graph: one node per top-level declaration entry (all names of a destructuring share it).
  // `readEdges`: bindings passed straight to a context reader (`useContext(X)`): what the code reads, never provides.
  type GNode = { edges: number[]; deepEdges: number[]; readEdges: number[]; own: Set<number> };
  const nodes: GNode[] = [];
  const byName = new Map<string, number>(); // file \0 name → node
  const newNode = (): number => (nodes.push({ edges: [], deepEdges: [], readEdges: [], own: new Set() }), nodes.length - 1);
  const nodeFile: string[] = []; // node → its module (declaration and module nodes)
  const moduleNode = new Map<string, number>(); // file → node reaching every declaration (namespace imports)
  for (const [file, f] of facts) {
    const refs = f.refs;
    if (!refs) continue;
    const all = newNode();
    moduleNode.set(file, all);
    nodeFile[all] = file;
    for (const decl of refs.decls) {
      const n = newNode();
      nodeFile[n] = file;
      nodes[all]!.edges.push(n);
      for (const name of decl.names) {
        byName.set(file + "\0" + name, n);
        if (refs.tokens.has(name)) nodes[n]!.own.add(token(file + "#" + name));
      }
      if (decl.flags & 1) nodes[n]!.own.add(TOP);
      if (decl.flags & 2) nodes[n]!.own.add(DYN);
    }
  }
  // A reference `name` in `file` → the node it reaches (or a set of own tokens for an outside module), memoised.
  const exportedNode = (file: string, name: string, seen: Set<string>): number | null => {
    const f = facts.get(file);
    if (!f || seen.has(file + "\0" + name)) return null;
    seen.add(file + "\0" + name);
    const direct = f.exports.get(name);
    if (direct !== undefined) return localNode(file, direct, seen);
    const re = f.reexports.get(name);
    if (re) {
      const to = target(file, re.from);
      if (!to || !facts.has(to)) return outside(file, re.from);
      return re.imported === "*" ? (moduleNode.get(to) ?? null) : exportedNode(to, re.imported, seen);
    }
    if (name === "default" && f.defaultName) return localNode(file, f.defaultName, seen);
    if (byName.has(file + "\0" + name)) return byName.get(file + "\0" + name)!;
    let unwalked: number | null = null;
    for (const from of f.stars) {
      const to = target(file, from);
      if (!to || !facts.has(to)) {
        // `export * from` a module outside the walk: the name may come from there.
        const o = outside(file, from);
        if (o !== empty) unwalked = o;
        continue;
      }
      const hit = exportedNode(to, name, seen);
      if (hit !== null) return hit;
    }
    return unwalked;
  };
  // A module outside the walk: its pseudo-token's node, or the empty node (it holds no context).
  const outside = (file: string, from: string): number => {
    const pseudo = options.external(file, from);
    return pseudo === null ? empty : leafOf(token(pseudo));
  };
  // (`external` pseudo-tokens and TOP of unresolvable names become nodes holding them.)
  const leaf = new Map<number, number>();
  const empty = newNode();
  const leafOf = (t: number): number => {
    let n = leaf.get(t);
    if (n === undefined) (leaf.set(t, (n = newNode())), nodes[n]!.own.add(t));
    return n;
  };
  const localNode = (file: string, name: string, seen: Set<string>): number | null => {
    const own = byName.get(file + "\0" + name);
    if (own !== undefined) return own;
    const f = facts.get(file)!;
    const imported = f.imports.get(name);
    const namespace = f.refs?.namespaces.get(name);
    const from = imported?.from ?? namespace;
    if (from === undefined) return null;
    const to = target(file, from);
    if (to && facts.has(to)) {
      if (namespace !== undefined) return moduleNode.get(to) ?? leafOf(TOP);
      return exportedNode(to, imported!.imported, seen) ?? leafOf(TOP);
    }
    const pseudo = options.external(file, from);
    if (imported && from.startsWith("@rivetjs/")) {
      if (ERR_NAMES.has(imported.imported)) return leafOf(ERR);
      if (SUSPENSE_NAMES.has(imported.imported) && from.startsWith("@rivetjs/runtime")) return leafOf(SUSPENSE);
    }
    return pseudo === null ? empty : leafOf(token(pseudo));
  };
  const refNode = (file: string, name: string): number | null => {
    const n = localNode(file, name, new Set());
    // A walked module's binding that resolves nowhere (an unparsed or missing export): unprovable.
    if (n === null && facts.get(file)?.refs && !byName.has(file + "\0" + name)) {
      const f = facts.get(file)!;
      const from = f.imports.get(name)?.from ?? f.refs!.namespaces.get(name);
      if (from !== undefined) {
        const to = target(file, from);
        if (to && facts.has(to)) return leafOf(TOP);
      }
    }
    return n;
  };
  // `import("spec")`: every declaration of a walked module, else the outside module's node.
  const dynamicNode = (file: string, spec: string): number => {
    const to = target(file, spec);
    return to && facts.has(to) ? (moduleNode.get(to) ?? leafOf(TOP)) : outside(file, spec);
  };
  // A context reader callee: the reactivity package's `useContext` or the cdk slots readers (`contextProps`,
  // `slottedContext`: they only read the token they get), through imports / re-exports (not `export *`).
  const fromReactivity = (spec: string) => spec === "@rivetjs/reactivity" || spec.startsWith("@rivetjs/reactivity/");
  const isReader = (file: string, name: string, depth: number): boolean => {
    const f = facts.get(file);
    if (!f || depth > 16) return false;
    const imported = f.imports.get(name);
    if (imported) {
      if (fromReactivity(imported.from)) return imported.imported === "useContext";
      const to = target(file, imported.from);
      return !!to && exportedReader(to, imported.imported, depth + 1);
    }
    return SLOTS.test(file) && SLOT_READERS.has(name) && byName.has(file + "\0" + name);
  };
  const exportedReader = (file: string, name: string, depth: number): boolean => {
    const f = facts.get(file);
    if (!f || depth > 16) return false;
    const direct = f.exports.get(name);
    if (direct !== undefined) return isReader(file, direct, depth);
    const re = f.reexports.get(name);
    if (!re || re.imported === "*") return false;
    if (fromReactivity(re.from)) return re.imported === "useContext";
    const to = target(file, re.from);
    return !!to && exportedReader(to, re.imported, depth + 1);
  };
  // Edges: values (`edges`) and JSX tags (`deepEdges`); groups link their names both ways.
  for (const [file, f] of facts) {
    const refs = f.refs;
    if (!refs) continue;
    for (const decl of refs.decls) {
      const n = byName.get(file + "\0" + decl.names[0]!)!;
      for (const name of decl.values) {
        const to = refNode(file, name);
        if (to !== null && to !== n) nodes[n]!.edges.push(to);
      }
      for (const name of decl.jsx) {
        const to = refNode(file, name);
        if (to !== null && to !== n) nodes[n]!.deepEdges.push(to);
      }
      for (const spec of decl.dynamic) nodes[n]!.edges.push(dynamicNode(file, spec));
      for (const [name, callee] of decl.reads) {
        const to = refNode(file, name);
        if (to !== null && to !== n) (isReader(file, callee, 0) ? nodes[n]!.readEdges : nodes[n]!.edges).push(to);
      }
    }
    for (const group of refs.groups) {
      const g = newNode();
      if (group.flags & 1) nodes[g]!.own.add(TOP);
      for (const spec of group.dynamic) nodes[g]!.edges.push(dynamicNode(file, spec));
      for (const name of group.values) {
        const to = refNode(file, name);
        if (to === null) continue;
        nodes[g]!.edges.push(to);
        nodes[to]!.edges.push(g);
      }
    }
  }
  // ---- Closures per node: SCCs (iterative Tarjan), unions in reverse topological order. `deep` = all a binding may
  // read or provide (edges, JSX tags, reads); `prov` = what it may provide (reads left out).
  const closure = (succ: (v: number) => number[]): ((n: number) => Set<number>) => {
    const count = nodes.length;
    const index = new Int32Array(count).fill(-1),
      low = new Int32Array(count),
      comp = new Int32Array(count).fill(-1);
    const onStack = new Uint8Array(count);
    const stack: number[] = [];
    const compTouch: Set<number>[] = [];
    let counter = 0;
    for (let root = 0; root < count; root++) {
      if (index[root] !== -1) continue;
      const work: [number, number][] = [[root, 0]];
      index[root] = low[root] = counter++;
      stack.push(root);
      onStack[root] = 1;
      while (work.length) {
        const top = work[work.length - 1]!;
        const [v, i] = top;
        const s = succ(v);
        if (i < s.length) {
          top[1]++;
          const w = s[i]!;
          if (index[w] === -1) {
            index[w] = low[w] = counter++;
            stack.push(w);
            onStack[w] = 1;
            work.push([w, 0]);
          } else if (onStack[w]) low[v] = Math.min(low[v]!, index[w]!);
          continue;
        }
        work.pop();
        if (work.length) {
          const u = work[work.length - 1]![0];
          low[u] = Math.min(low[u]!, low[v]!);
        }
        if (low[v] === index[v]) {
          const c = compTouch.length;
          const set = new Set<number>();
          const members: number[] = [];
          for (let w; (w = stack.pop()!) !== undefined;) {
            onStack[w] = 0;
            comp[w] = c;
            members.push(w);
            if (w === v) break;
          }
          for (const w of members) {
            for (const t of nodes[w]!.own) set.add(t);
            for (const x of succ(w)) if (comp[x] !== c && comp[x]! >= 0) for (const t of compTouch[comp[x]!]!) set.add(t);
          }
          compTouch.push(set);
        }
      }
    }
    return (n) => compTouch[comp[n]!]!;
  };
  const succAll = (v: number): number[] => {
    const n = nodes[v]!;
    return n.deepEdges.length || n.readEdges.length ? n.edges.concat(n.deepEdges, n.readEdges) : n.edges;
  };
  const succProv = (v: number): number[] => {
    const n = nodes[v]!;
    return n.deepEdges.length ? n.edges.concat(n.deepEdges) : n.edges;
  };
  const deep = closure(succAll);
  const prov = closure(succProv);
  // The caller's own provisions: its value references (deep), its own flags — not the components it renders.
  const local = (n: number): Set<number> => {
    const node = nodes[n]!;
    const out = new Set(node.own);
    for (const e of node.edges) for (const t of prov(e)) out.add(t);
    return out;
  };
  // ---- Components → nodes.
  const nodeOf = (id: string): number | null => {
    const at = id.lastIndexOf("?");
    return byName.get(id.slice(0, at) + "\0" + id.slice(at + 1)) ?? null;
  };
  const TOPSET = new Set([TOP]);
  const touchOf = (id: string): Set<number> => {
    const n = nodeOf(id);
    return n === null ? TOPSET : deep(n);
  };
  // What a component may provide to what it encloses (its context reads left out).
  const provOf = (id: string): Set<number> => {
    const n = nodeOf(id);
    return n === null ? TOPSET : prov(n);
  };
  const localOf = new Map<string, Set<number>>();
  const providedBy = (id: string): Set<number> => {
    let s = localOf.get(id);
    if (!s) {
      const n = nodeOf(id);
      localOf.set(id, (s = n === null ? TOPSET : local(n)));
    }
    return s;
  };
  // An enclosing component in the caller's JSX: all it touches; unresolved: `<X.Provider>` = X, a runtime structural
  // component nothing, anything else TOP.
  const aroundOf = (caller: string, key: string | null, tag: string): Set<number> => {
    if (key !== null) return provOf(key);
    const file = caller.slice(0, caller.lastIndexOf("?"));
    const f = facts.get(file);
    if (!f) return TOPSET;
    if (tag.endsWith(".Provider")) {
      const head = tag.slice(0, tag.indexOf("."));
      const n = refNode(file, head);
      return n === null ? TOPSET : prov(n);
    }
    const imported = f.imports.get(tag);
    if (imported && imported.from.startsWith("@rivetjs/runtime") && RUNTIME_TAGS.has(imported.imported)) return new Set();
    return TOPSET;
  };
  // Layout files above a shell page (`_layout.tsx` of each folder from its routes root down).
  const layouts = new Map<string, string[]>();
  const layoutFiles = [...facts.keys()].filter((file) => /(^|[/\\])_layout\.[jt]sx$/.test(file));
  const hostKeys: string[] = [];
  for (const h of options.hosts ?? []) {
    const hash = h.indexOf("#");
    const file = hash < 0 ? h : h.slice(0, hash);
    const name = hash < 0 ? (facts.get(file)?.defaultName ?? "default") : h.slice(hash + 1);
    hostKeys.push(file + "?" + name);
  }
  // A frame host renders the shell pages it loads (docs-kit `frames` registry): what those pages provide sits below
  // the page, not above it. A host's provisions leave out the shell page modules and the modules importing one (the
  // generated frame wrappers: the page inside its `_layout` files, which `hostSet` adds per page).
  const pageFiles = new Set<string>();
  for (const [file, f] of facts) for (const [name] of f.boundaries) if (input.shell(file + "?" + name)) pageFiles.add(file);
  const wrapperFiles = new Set<string>();
  for (const [file, f] of facts)
    for (const [, imported] of f.imports) {
      const to = target(file, imported.from);
      if (to && pageFiles.has(to)) wrapperFiles.add(file);
    }
  const hostProv = new Map<string, Set<number>>();
  const hostProvOf = (id: string): Set<number> => {
    let out = hostProv.get(id);
    if (out) return out;
    hostProv.set(id, (out = new Set()));
    const start = nodeOf(id);
    if (start === null) return (out.add(TOP), out);
    const seen = new Uint8Array(nodes.length);
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const v = queue.pop()!;
      for (const t of nodes[v]!.own) out.add(t);
      for (const w of succProv(v)) {
        if (seen[w]) continue;
        seen[w] = 1;
        const file = nodeFile[w];
        if (file !== undefined && w !== start && (pageFiles.has(file) || wrapperFiles.has(file))) continue;
        queue.push(w);
      }
    }
    return out;
  };
  const hostSet = (file: string): Set<number> => {
    let list = layouts.get(file);
    if (!list) {
      const at = file.lastIndexOf("/routes/");
      const base = at < 0 ? null : file.slice(0, at + 8);
      list = base === null ? [] : layoutFiles.filter((l) => l.startsWith(base) && file.startsWith(l.slice(0, l.lastIndexOf("/") + 1)) && l !== file);
      layouts.set(file, list);
    }
    const out = new Set<number>();
    for (const l of list) for (const [name] of facts.get(l)!.boundaries) for (const t of provOf(l + "?" + name)) out.add(t);
    for (const h of hostKeys) for (const t of hostProvOf(h)) out.add(t);
    return out;
  };
  // ---- above(component): least fixpoint over its call sites (monotone unions); roots / values / unknown: TOP.
  const above = new Map<string, Set<number>>();
  const keys: string[] = [];
  for (const [file, byNameV] of input.verdicts) for (const name of byNameV.keys()) keys.push(file + "?" + name);
  for (const id of keys) {
    const list = input.sites.get(id);
    const at = id.lastIndexOf("?");
    if (input.isRoot(id) || input.escaped.has(id)) above.set(id, new Set(TOPSET));
    else if (!list) above.set(id, input.shell(id) && options.hosts ? hostSet(id.slice(0, at)) : new Set(TOPSET));
    else above.set(id, new Set());
  }
  const siteAbove = (s: CallSiteSite): Set<number> => {
    const out = new Set(providedBy(s.caller));
    s.around.forEach((key, i) => {
      for (const t of aroundOf(s.caller, key, s.tags[i] ?? "")) out.add(t);
    });
    const up = above.get(s.caller);
    if (up) for (const t of up) out.add(t);
    else out.add(TOP);
    return out;
  };
  for (let changed = true; changed;) {
    changed = false;
    for (const id of keys) {
      const list = input.sites.get(id);
      if (!list) continue;
      const set = above.get(id)!;
      if (set.has(TOP)) continue;
      const before = set.size;
      for (const s of list) for (const t of siteAbove(s)) set.add(t);
      if (set.size !== before) changed = true;
    }
  }
  // ---- Verdicts.
  const trace = new Map<string, (Unproven | "proven")[]>();
  const prove = (callee: string, s: CallSiteSite): Unproven | "proven" => {
    if (!s.data || s.fn) return "not-data";
    const touch = touchOf(callee);
    if (touch.has(TOP)) return "touch-top";
    const over = siteAbove(s);
    if (over.has(TOP)) return "above-top";
    if (over.has(ERR)) return "overlap";
    for (const t of touch)
      if (over.has(t))
        return options.debug
          ? (("overlap " +
              [...touch]
                .filter((x) => over.has(x))
                .map((x) => names[x])
                .join(" ")) as Unproven)
          : "overlap";
    return "proven";
  };
  const siteNames = new Map<string, string[]>(),
    siteMarks = new Map<string, string[]>(),
    freeNames = new Map<string, string[]>();
  const add = (map: Map<string, string[]>, file: string, value: string) => {
    const list = map.get(file);
    if (list) list.push(value);
    else map.set(file, [value]);
  };
  for (const [file, byNameV] of input.verdicts) {
    const f = facts.get(file)!;
    for (const [name, v] of byNameV) {
      const id = file + "?" + name;
      const list = input.sites.get(id);
      if (!v.interactive || !list || input.isRoot(id)) continue;
      const c = f.boundaries.get(name);
      const results = list.map((s) => prove(id, s));
      trace.set(id, results);
      if (v.independent) {
        if (results.every((r) => r === "proven")) add(freeNames, file, name);
        continue;
      }
      if (c?.params !== "object" || (v.dependentBecause !== "context" && v.dependentBecause !== "call-site")) continue;
      let any = false;
      list.forEach((s, i) => {
        if (results[i] !== "proven") return;
        any = true;
        add(siteMarks, s.caller.slice(0, s.caller.lastIndexOf("?")), s.caller.slice(s.caller.lastIndexOf("?") + 1) + ":" + s.index);
      });
      if (any) add(siteNames, file, name);
    }
  }
  const label = new Map<number, string>();
  for (const [k, n] of byName) if (!label.has(n)) label.set(n, k.replace("\0", "#"));
  for (const [t, n] of leaf) for (const [name, id] of tokenIds) if (id === t) label.set(n, "leaf:" + name);
  const why = (id: string, tokenName?: string, provides = false): string[] => {
    const succ = provides ? succProv : succAll;
    const start = nodeOf(id);
    if (start === null) return ["no node"];
    const want = tokenName === undefined ? TOP : tokenIds.get(tokenName);
    const prev = new Map<number, number>([[start, -1]]);
    const queue = [start];
    while (queue.length) {
      const v = queue.shift()!;
      if (nodes[v]!.own.has(want!)) {
        const out: string[] = [];
        for (let x = v; x !== -1; x = prev.get(x)!) out.push(label.get(x) ?? "#" + x);
        return out.reverse();
      }
      for (const w of succ(v)) if (!prev.has(w)) (prev.set(w, v), queue.push(w));
    }
    return [];
  };
  // Census: why `above(id)` holds TOP (first reason up the call chain).
  const whyAbove = (id: string, tokenName?: string, depth = 0): string[] => {
    const want = tokenName === undefined ? TOP : (tokenIds.get(tokenName) ?? -1);
    if (depth > 30) return ["deep"];
    if (input.isRoot(id)) return ["root " + id];
    if (input.escaped.has(id)) return ["escaped " + id];
    const list = input.sites.get(id);
    if (!list) {
      const file = id.slice(0, id.lastIndexOf("?"));
      const hit = (layouts.get(file) ?? []).flatMap((l) => [...facts.get(l)!.boundaries.keys()].map((n) => l + "?" + n)).find((h) => provOf(h).has(want));
      const host = hostKeys.find((h) => hostProvOf(h).has(want));
      return [(input.shell(id) ? "shell-host " : "no-site ") + id, ...(hit ? ["layout " + hit, ...why(hit, tokenName, true)] : host ? ["host " + host] : [])];
    }
    for (const s of list) {
      if (providedBy(s.caller).has(want)) return ["local " + s.caller, ...why(s.caller, tokenName, true)];
      for (let i = 0; i < s.around.length; i++)
        if (aroundOf(s.caller, s.around[i]!, s.tags[i] ?? "").has(want))
          return ["around " + s.tags[i] + " in " + s.caller, ...(s.around[i] ? why(s.around[i]!, tokenName, true) : [])];
      if (above.get(s.caller)?.has(want)) return ["up " + s.caller, ...whyAbove(s.caller, tokenName, depth + 1)];
    }
    return ["?"];
  };

  return {
    whyAbove,
    why,
    site: (file) => siteNames.get(file) ?? [],
    sites: (file) => siteMarks.get(file) ?? [],
    free: (file) => freeNames.get(file) ?? [],
    trace,
  };
}
