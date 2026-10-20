// Server reach (SERVER-REACH, spec docs/design/specs/2026-10-20-server-reach-design.md): which server-only modules each
// route's browser graph reaches, before the build. A page route that reaches one through its own module and plain
// helper modules becomes a document route (links load its document; its module leaves the client build); a component
// module on the way (shared, client-rendered on every client navigation to the routes using it), a layout or an error
// page reaching one is RV3011. Build-time only (Node): sources are read, compiled / type-stripped and parsed here.
import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { parseSync, transformWithOxc, type ResolvedConfig } from "vite";
import { compile } from "@rivetjs/compiler";
import { docsUrl } from "@rivetjs/compiler/codes";
import { isServerOnly, SERVER_ONLY_MARKER, type ServerOnlyPattern } from "@rivetjs/compiler/vite";
import type { RouteTable } from "./routes.ts";

/** Resolve a specifier for the browser graph: an absolute id (files: path, maybe `?query`), or undefined (virtual / unknown). */
export type ReachResolve = (specifier: string, importer: string) => Promise<string | undefined>;

/** `rivetRouter({ serverOnly })`. */
export type ServerOnlyOption = readonly ServerOnlyPattern[] | { modules?: readonly ServerOnlyPattern[]; reach?: "error" | "warn" };

export interface ReachOptions {
  root: string;
  /** Absolute routes directory. */
  routesDir: string;
  table: RouteTable;
  resolve: ReachResolve;
  /** Declared server-only modules (option + plugins); the marker and `*.server.*` always count. */
  serverOnly: readonly ServerOnlyPattern[];
  /** Components reaching a server-only module: build error (default) or warning (the page then renders as a document). */
  reach?: "error" | "warn";
  /** Absolute route module paths (compiled with `serverExports`: server exports and code only they use are no browser code). */
  routeModules: ReadonlySet<string>;
  /** Vite config (tsconfig options of the type stripping). */
  config?: ResolvedConfig;
}

/** One RV3011 report. */
export interface ReachProblem {
  readonly severity: "error" | "warning";
  /** What reaches it: a component module of page routes, a layout, an error / not-found page. */
  readonly kind: "component" | "layout" | "special";
  /** Display chain from the first component (or the layout / page) to the server-only module. */
  readonly chain: readonly string[];
  /** Route patterns (component: the page routes rendering it; layout: the routes under it). */
  readonly routes: readonly string[];
  /** Routes-relative page / layout files involved. */
  readonly files: readonly string[];
  /** Terminal text: `[rivet:router] RV3011 …` + `fix:` / `docs:` lines. */
  readonly message: string;
}

export interface Reach {
  /** Document routes: routes-relative page file → display chain to the server-only module it reaches. */
  readonly documents: ReadonlyMap<string, readonly string[]>;
  readonly problems: readonly ReachProblem[];
  /** Modules (absolute paths) only document pages reach: a server-only import from one gets the browser stand-in. */
  readonly documentOnly: ReadonlySet<string>;
  /** `importer \0 specifier` of each server-only import → its key (resolved id, else the specifier). */
  readonly targets: ReadonlyMap<string, string>;
  /** Server-only key → names imported from it (stand-in exports). */
  readonly names: ReadonlyMap<string, ReadonlySet<string>>;
  /** Server-only key → one display chain of importers (outermost first). */
  readonly chains: ReadonlyMap<string, readonly string[]>;
}

export const RV_REACH = "RV3011";
const SCANNED = /\.[cm]?[jt]sx?$/;
const COMPONENT = /\.[jt]sx$/;

interface Edge {
  readonly spec: string;
  readonly names: readonly string[];
}
// Browser imports per module, by mtime (dev re-runs read only changed files).
const edgeCache = new Map<string, { mtime: number; route: boolean; edges: readonly Edge[] }>();

function namesOf(entries: readonly { importName: { kind: string; name: string | null } }[]): string[] {
  return entries.map(({ importName }) => (importName.kind === "Name" ? importName.name! : importName.kind === "Default" ? "default" : "*"));
}

/** Browser imports of one module: route modules after the server split, `.tsx` as the compiler emits them, `.ts` type-stripped. */
async function edgesOf(file: string, route: boolean, config: ResolvedConfig | undefined): Promise<readonly Edge[]> {
  let mtime: number;
  try {
    mtime = statSync(file).mtimeMs;
  } catch {
    return [];
  }
  const cached = edgeCache.get(file);
  if (cached && cached.mtime === mtime && cached.route === route) return cached.edges;
  const source = readFileSync(file, "utf8");
  let code: string | undefined;
  if (route || COMPONENT.test(file)) {
    const result = compile(source, { target: "dom", filename: file, ...(route ? { serverExports: true } : {}) });
    // A module that does not compile fails the real build with its own diagnostic; scan its imports as written.
    if (!result.diagnostics.length) code = result.code;
  }
  if (code === undefined && /\.[cm]?[jt]sx?$/.test(file) && !/\.[cm]?js$/.test(file))
    code = (await transformWithOxc(source, file, { jsx: "preserve" } as never, undefined, config).catch(() => ({ code: source }))).code;
  const parsed = parseSync(file.replace(/\.[^./\\]+$/, ".jsx"), code ?? source);
  const edges: Edge[] = [];
  const text = code ?? source;
  for (const item of parsed.module.staticImports) {
    // Type-only entries survive only where stripping failed: never browser imports.
    const entries = item.entries.filter((entry) => !entry.isType);
    if (item.entries.length && !entries.length) continue;
    edges.push({ spec: item.moduleRequest.value, names: namesOf(entries) });
  }
  for (const item of parsed.module.staticExports)
    for (const entry of item.entries)
      if (entry.moduleRequest && !entry.isType)
        edges.push({ spec: entry.moduleRequest.value, names: entry.importName.kind === "Name" ? [entry.importName.name!] : ["*"] });
  for (const item of parsed.module.dynamicImports) {
    const literal = /^\s*(["'`])([^"'`$]*)\1\s*$/.exec(text.slice(item.moduleRequest.start, item.moduleRequest.end));
    if (literal) edges.push({ spec: literal[2]!, names: ["*"] });
  }
  edgeCache.set(file, { mtime, route, edges });
  return edges;
}

/** Display path: root-relative inside the root, else `<package name>/<path in the package>`. */
function displayer(root: string): (id: string) => string {
  const packages = new Map<string, string | null>();
  const packageOf = (dir: string): { dir: string; name: string } | null => {
    for (let at = dir; ; at = dirname(at)) {
      let name = packages.get(at);
      if (name === undefined) {
        try {
          name = (JSON.parse(readFileSync(join(at, "package.json"), "utf8")) as { name?: string }).name ?? null;
        } catch {
          name = null;
        }
        packages.set(at, name);
      }
      if (name) return { dir: at, name };
      if (dirname(at) === at) return null;
    }
  };
  return (id) => {
    if (!isAbsolute(id)) return id;
    const rel = relative(root, id);
    if (!rel.startsWith("..") && !isAbsolute(rel)) return rel.split(sep).join("/");
    const pkg = packageOf(dirname(id));
    return pkg ? pkg.name + "/" + relative(pkg.dir, id).split(sep).join("/") : id;
  };
}

const list = (routes: readonly string[]): string => (routes.length <= 5 ? routes.join(", ") : routes.slice(0, 5).join(", ") + ` and ${routes.length - 5} more`);

/** Walk every route's browser graph and classify the routes (see the module comment). */
export async function analyzeReach(options: ReachOptions): Promise<Reach> {
  const { root, routesDir, table, serverOnly, routeModules } = options;
  const show = displayer(root);
  const abs = (file: string) => join(routesDir, file);
  // Graph: module → its browser edges (resolved); server-only targets are leaves keyed by resolved id, else specifier.
  type Target = { key: string; serverOnly: boolean; spec: string; names: readonly string[] };
  const graph = new Map<string, Target[]>();
  const resolved = new Map<string, string | undefined>();
  const resolveCached = async (spec: string, importer: string) => {
    const key = importer + "\0" + spec;
    if (!resolved.has(key)) resolved.set(key, await options.resolve(spec, importer).catch(() => undefined));
    return resolved.get(key);
  };
  const scannable = (id: string) => isAbsolute(id) && !id.includes("?") && !id.includes("\0") && SCANNED.test(id) && !id.split(sep).includes("node_modules");
  const visit = async (seeds: readonly string[]) => {
    const queue = seeds.filter((seed) => !graph.has(seed));
    for (const seed of queue) graph.set(seed, []);
    while (queue.length) {
      const file = queue.shift()!;
      const targets: Target[] = [];
      for (const edge of await edgesOf(file, routeModules.has(file), options.config)) {
        const id = await resolveCached(edge.spec, file);
        const clean = id?.split("?")[0];
        if (isServerOnly(serverOnly, edge.spec, clean)) {
          targets.push({ key: id === undefined || id.startsWith("\0") ? edge.spec : clean!, serverOnly: true, spec: edge.spec, names: edge.names });
          continue;
        }
        if (!id || !scannable(id)) continue;
        targets.push({ key: id, serverOnly: false, spec: edge.spec, names: edge.names });
        if (!graph.has(id)) (graph.set(id, []), queue.push(id));
      }
      graph.set(file, targets);
    }
  };
  const pages = [...new Set(table.routes.flatMap((route) => (route.page ? [route.page] : [])))];
  const layouts = [...new Set(table.routes.flatMap((route) => route.layouts.flatMap((layout) => (layout.page ? [layout.page] : []))))];
  const specials = [
    ...new Set(
      [
        table.notFound,
        table.error,
        ...(table.notFounds ?? []).map((entry) => entry.page),
        ...table.routes.flatMap((route) => [route.notFound, route.error]),
      ].filter((file): file is string => !!file),
    ),
  ];
  await visit([...pages, ...layouts, ...specials].map(abs));

  // Fixpoints (monotone booleans over a graph with cycles): reaches a server-only module; reaches one through a component.
  const reaches = new Set<string>(),
    viaComponent = new Set<string>();
  for (let changed = true; changed;) {
    changed = false;
    for (const [file, targets] of graph) {
      if (!reaches.has(file) && targets.some((t) => t.serverOnly || reaches.has(t.key))) (reaches.add(file), (changed = true));
      if (!viaComponent.has(file) && targets.some((t) => !t.serverOnly && ((COMPONENT.test(t.key) && reaches.has(t.key)) || viaComponent.has(t.key))))
        (viaComponent.add(file), (changed = true));
    }
  }
  // Shortest display chain from `from` to a server-only module; `component`: through a component module (not `from`).
  const chainFrom = (from: string, component: boolean): string[] => {
    type State = { file: string; passed: boolean; back: State | null; leaf?: string };
    const seen = new Set<string>([from + "\0" + !component]);
    const queue: State[] = [{ file: from, passed: !component, back: null }];
    while (queue.length) {
      const state = queue.shift()!;
      for (const target of graph.get(state.file) ?? []) {
        if (target.serverOnly) {
          if (!state.passed) continue;
          const files: string[] = [];
          for (let at: State | null = state; at; at = at.back) files.unshift(at.file);
          // Component chains start at the first component (the page and its helpers are the routes' own).
          const first = component ? files.findIndex((file, i) => i > 0 && COMPONENT.test(file)) : 0;
          return [...files.slice(Math.max(first, 0)).map(show), target.key.startsWith("/") ? show(target.key) : target.key];
        }
        const passed = state.passed || COMPONENT.test(target.key);
        const key = target.key + "\0" + passed;
        if (seen.has(key) || !reaches.has(target.key)) continue;
        seen.add(key);
        queue.push({ file: target.key, passed, back: state });
      }
    }
    return [show(from)];
  };
  const reachMode = options.reach ?? "error";
  const documents = new Map<string, readonly string[]>();
  const problems: ReachProblem[] = [];
  const byChain = new Map<string, { chain: string[]; routes: Set<string>; files: Set<string> }>();
  const patternsOf = (page: string) => table.routes.filter((route) => route.page === page).map((route) => route.pattern);
  for (const page of pages) {
    const file = abs(page);
    if (!reaches.has(file)) continue;
    const targets = graph.get(file) ?? [];
    // `import "@rivetjs/router/server-only"` in the page module: the page itself is server-rendered only.
    const declared = targets.some((t) => t.serverOnly && t.spec === SERVER_ONLY_MARKER);
    const component = !declared && targets.some((t) => !t.serverOnly && ((COMPONENT.test(t.key) && reaches.has(t.key)) || viaComponent.has(t.key)));
    if (component) {
      const chain = chainFrom(file, true);
      const key = chain.join("\0");
      let group = byChain.get(key);
      if (!group) byChain.set(key, (group = { chain, routes: new Set(), files: new Set() }));
      for (const pattern of patternsOf(page)) group.routes.add(pattern);
      group.files.add(page);
      if (reachMode === "error") continue;
    }
    documents.set(page, chainFrom(file, false));
  }
  const docs = "\n  docs: " + docsUrl(RV_REACH);
  for (const { chain, routes, files } of byChain.values()) {
    const severity = reachMode === "warn" ? "warning" : "error";
    const what = routes.size === 1 ? "client-navigated page route" : "client-navigated page routes";
    problems.push({
      severity,
      kind: "component",
      chain,
      routes: [...routes],
      files: [...files],
      message:
        `[rivet:router] ${RV_REACH} ${chain.join(" → ")} (server-only), rendered by ${list([...routes])} (${what})` +
        (severity === "warning" ? "; rendered as document routes (links load their documents)" : "") +
        "\n  fix: pass the data to the component as props (inlined at build time, or read in the page's `load(…)`), keep server-only modules out of components, or make the page a document route (`import \"" +
        SERVER_ONLY_MARKER +
        '"` in the page module); `rivetRouter({ serverOnly: { reach: "warn" } })` turns this into a warning (those pages render as document routes)' +
        docs,
    });
  }
  for (const [kind, files] of [
    ["layout", layouts],
    ["special", specials],
  ] as const)
    for (const page of files) {
      const file = abs(page);
      if (!reaches.has(file)) continue;
      const chain = chainFrom(file, false);
      const folder = dirname(page) === "." ? "" : "/" + dirname(page).split(sep).join("/");
      const routes =
        kind === "layout"
          ? table.routes.filter((route) => route.page && route.layouts.some((layout) => layout.page === page)).map((route) => route.pattern)
          : table.routes.filter((route) => route.notFound === page || route.error === page).map((route) => route.pattern);
      problems.push({
        severity: "error",
        kind,
        chain,
        routes,
        files: [page],
        message:
          `[rivet:router] ${RV_REACH} ${chain.join(" → ")} (server-only), rendered by ${kind === "layout" ? `the layout of every page under ${folder || "/"}` : "an error / not-found page"} (client-rendered on navigation and resume)` +
          "\n  fix: read the data in the layout's `load(…)` (or a server-only helper called from it) and render it from props; layouts and error pages cannot be document routes" +
          docs,
      });
    }
  // Browser graphs: modules of client-rendered routes (non-document pages, layouts, error pages) vs. document pages only.
  const closure = (seeds: readonly string[]) => {
    const out = new Set<string>();
    for (const stack = [...seeds]; stack.length;) {
      const file = stack.pop()!;
      if (out.has(file)) continue;
      out.add(file);
      for (const target of graph.get(file) ?? []) if (!target.serverOnly) stack.push(target.key);
    }
    return out;
  };
  const navigable = closure([...pages.filter((page) => !documents.has(page)), ...layouts, ...specials].map(abs));
  const documentOnly = new Set([...closure([...documents.keys()].map(abs))].filter((file) => !navigable.has(file)));
  const targets = new Map<string, string>(),
    names = new Map<string, Set<string>>(),
    chains = new Map<string, readonly string[]>();
  for (const [file, edges] of graph)
    for (const target of edges) {
      if (!target.serverOnly) continue;
      targets.set(file + "\0" + target.spec, target.key);
      let set = names.get(target.key);
      if (!set) names.set(target.key, (set = new Set()));
      for (const name of target.names) set.add(name);
    }
  // Stand-in messages: the first document page's chain to each server-only module it reaches.
  for (const page of documents.keys()) {
    const file = abs(page);
    for (const reached of closure([file]))
      for (const target of graph.get(reached) ?? [])
        if (target.serverOnly && !chains.has(target.key) && documentOnly.has(reached)) {
          const chain = chainFrom(file, false);
          chains.set(
            target.key,
            chain[chain.length - 1] === (target.key.startsWith("/") ? show(target.key) : target.key) ? chain.slice(0, -1) : [show(file), show(reached)],
          );
        }
  }
  return { documents, problems, documentOnly, targets, names, chains };
}

/** Normalize `rivetRouter({ serverOnly })`. */
export function serverOnlyOption(option: ServerOnlyOption | undefined): { modules: readonly ServerOnlyPattern[]; reach: "error" | "warn" } {
  if (option === undefined) return { modules: [], reach: "error" };
  const modules = Array.isArray(option) ? option : ((option as { modules?: readonly ServerOnlyPattern[] }).modules ?? []);
  const reach = Array.isArray(option) ? "error" : ((option as { reach?: "error" | "warn" }).reach ?? "error");
  if (!modules.every((pattern) => typeof pattern === "string" || pattern instanceof RegExp))
    throw new Error("rivetRouter: serverOnly modules must be module ids (strings) or RegExps");
  if (reach !== "error" && reach !== "warn") throw new Error(`rivetRouter: serverOnly.reach must be "error" or "warn" (got ${JSON.stringify(reach)})`);
  return { modules, reach };
}
