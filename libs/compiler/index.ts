// Rivet JSX compiler: JSX/TSX lowering (server and DOM targets) and the derived resume model (boundaries, keyed
// state). Parsing and lowering run in the Rust/oxc WebAssembly module (./wasm.ts).
import { call, CompilerPanic } from "./wasm.ts";

export { CompilerPanic, hasDerivedModel } from "./wasm.ts";
export { RUNTIME_ABI } from "./abi.ts";
export { CODES, RESERVED, codeInfo, docsUrl, type CodeInfo, type ReservedRange, type Severity } from "./codes.ts";

/** A compiler error (`diagnostics`, fails the build). */
export interface Diagnostic {
  category: "error";
  /** Stable `RVnnnn` code (registry: `codes.json`, docs URL: `docsUrl(code)`). */
  code: string;
  /** Every compiler diagnostic fails the build (diagnostics suppress output). */
  severity: "error";
  message: string;
  filename: string;
  line?: number;
  column?: number;
}

/** A compiler warning (`warnings`, T10 fix 2): reported, never suppresses the code (RV2104: keyed state in a loop). */
export interface CompileWarning {
  category: "warning";
  code: string;
  severity: "warning";
  message: string;
  filename: string;
  line?: number;
  column?: number;
}

/** Options of `compile()`: target, resume, i18n variants, scoped styles, source maps. */
export interface CompileOptions {
  target?: "server" | "dom";
  filename?: string;
  /** Server list-mount plans for `.map` rows (default true). */
  serverListMounts?: boolean;
  /** Resume (the derived model); `module` is the boundary name prefix (defaults to the filename). */
  resume?: ResumeOptions | null;
  /** Also return a source map of `code` to `source` (`map`). The emitted code is unchanged. */
  sourceMap?: boolean;
  /**
   * Static-call hook (i18n): calls of `export` imported from `module` resolve at compile time from the
   * table registered under `id` (see `registerTable`). Server output carries every variant; DOM
   * output inlines `variants[variant]`.
   */
  staticCalls?: StaticCall[];
  /** Variant names (locales), in table order. */
  variants?: string[];
  /** DOM target: the variant index to inline. */
  variant?: number;
  /** Time zone passed to date formatting in generated message code. */
  timeZone?: string;
  /** Dev build: unknown prefixed keys warn at runtime. */
  dev?: boolean;
  /**
   * Scoped styles: top-level `const s = css\`…\`` blocks (`css` from `@rivetjs/runtime/css`) become
   * frozen class maps, `s.key` folds to the scoped name (static `class` attributes stay static
   * fragments) and the rewritten CSS comes back as `css`. Absent: css`` is left untouched.
   */
  styles?: StylesOptions;
  /**
   * Route module: server exports (module-scope `const`s initialized by a `@rivetjs/router` wrapper call —
   * `load`, `guard`, `actions`, `entries`, `headers`, `onRequest`, `onGet`, `onPost`, `onPut`, `onPatch`, `onDelete`,
   * `onOptions`; names are free — and re-exports from server-only modules) are checked, and removed from the DOM
   * target together with the code and imports only they use. Untagged exports named like the former magic
   * exports (`serverLoad`, `onGet`, …) are RV3010.
   */
  serverExports?: boolean;
  /**
   * Resume: `@rivetjs/*` packages compiled like application code (source packages, `"rivet": {
   * "source": true }`, e.g. `@rivetjs/cdk`). The resume analysis treats their components like local components;
   * other `@rivetjs/*` components are framework components. Non-`@rivetjs` packages
   * are always user components. `rivet()` (vite.ts) passes the source packages a module imports.
   */
  sourcePackages?: string[];
}

/**
 * Resume options of `compile()` / `check()` — the derived model (plan `docs/design/plans/2026-10-18-derived-client.md`):
 * the server target is plain server output plus boundary / keyed-state calls (`_rB` / `_rBOut` / `_rBEnd` / `_rBAttr` /
 * `_rSig` / `_rSigStore` from `@rivetjs/runtime/server-derived`) — values only on the wire; the DOM target is plain DOM
 * output with each boundary body wrapped `return _b("<module>#Name", () => …)` and keyed state `_sig` / `_sigStore` (same
 * names and keys as the server, `@rivetjs/runtime/dom-derived`).
 */
export interface ResumeOptions {
  /** Boundary name prefix (defaults to the filename). */
  module?: string;
  /**
   * The build's cross-module verdict (`boundaryFacts()` in `facts-fixpoint.ts`) — names of this module's
   * components that are interactive (their subtree, through rendered components, holds a resume site). Absent: the
   * compiler closes over the module alone (own sites + rendered components of the same module).
   */
  boundaries?: string[];
  /** Names of this module's components the build proved independent (every input is data). */
  independent?: string[];
  /**
   * Derived model: names of this module's boundaries without a change source of their own (`BoundaryVerdict.conditional`):
   * their `_rB` carries `COND`, so the server keeps the record only for a live instance.
   */
  conditional?: string[];
  /**
   * ZERO CALLSITE: names of this module's dependent boundaries independent at proven call sites only (`SITE`: their
   * server `_rB` takes the props; a proven site passes them through `_rS`).
   */
  site?: string[];
  /** ZERO CALLSITE: this module's proven call sites, `"<Caller>:<call index>"` (index in the caller's `calls`). */
  sites?: string[];
  /** ZERO CALLSITE: names of this module's independent boundaries whose every call site is proven (`CTXFREE`). */
  free?: string[];
  /**
   * ZERO A1: names of this module's components no adopt walk reaches (`BoundaryVerdict.adopted` false: not a boundary,
   * rendered only by components that are not adopted, never used as a value). Their server output carries no
   * `<!--[-->…<!--]-->` slot markers (nothing in the browser walks it).
   */
  static?: string[];
}

/** Scoped style options of `compile()` for css`` blocks. */
export interface StylesOptions {
  /** Hash scope of the module's class names (root-relative module id). */
  scope: string;
  /** `readable` (default) `<local>_<hash5>`; `short` `r<hash6>`. */
  names?: "readable" | "short";
  /** Cascade layer wrapping the module's CSS (default `components`; `false`/`null`: unlayered). */
  layer?: string | false | null;
}

/** A call the compiler resolves at build time against a registered table (i18n `t()`). */
export interface StaticCall {
  /** Registered table id. */
  id: string;
  /** Module specifier the binding is imported from; its `/runtime` subpath supplies message helpers. */
  module: string;
  export: string;
  /** Allow `` t(`prefix.${x}`) `` lookups over the keys under a literal prefix. */
  prefixLookup?: boolean;
}

/** Static-call table: key → one message variant (compiler IR) per variant index. */
export type StaticTable = Record<string, readonly unknown[]>;

/** Register (or replace) a static-call table in this process's compiler instance. */
export function registerTable(id: string, table: StaticTable): void {
  call<null>({ op: "registerTable", id, table });
}

/** Output of `compile()`: code, diagnostics and the extras the options asked for (boundaries, map, css). */
export interface CompileResult {
  code: string;
  diagnostics: Diagnostic[];
  /** Warnings (absent when none); the code is still emitted. */
  warnings?: CompileWarning[];
  /**
   * `resume` only (absent when the module has none): the module's boundary names, module-qualified
   * (`<resume module>#<Name>`, source order) — the names `_rB` / `_b` carry and the build manifest's `symbols` keys.
   */
  boundaries?: string[];
  /**
   * Derived DOM target only (ZERO C1, absent when no boundary is eligible): the module's lite entry — per eligible
   * independent boundary `export function <Name>$a(node, rec)` (adopt residual over the server nodes, against
   * `@rivetjs/runtime/dom-lite`) and `export const <Name>$c = () => import(<filename>)` (the ordinary module); module
   * constants it reads are copied in, it never imports the module statically. `names` = the boundary names it covers.
   */
  lite?: { code: string; map: null; names: string[] };
  /**
   * Derived DOM target only (ZERO B1 census): per independent boundary that got no lite residual, why — `"dependent"`, or
   * the first construct the residual cannot express (`"component root"`, `"declaration"`, …). Diagnostic data only.
   */
  liteBecause?: Record<string, string>;
  /** Source map v3 JSON (with `sourceMap: true`). */
  map?: string;
  /** Scoped CSS of the module's css`` blocks (`styles` option). */
  css?: string;
  /** css`` binding → local name → scoped class name. */
  cssClasses?: Record<string, Record<string, string>>;
  /** `serverExports` only: server export names in source order. */
  serverExports?: string[];
  /** `serverExports` only: kind of each export (parallel to `serverExports`): the wrapper name (`load`, `onGet`, …), `?` for a re-export from a server-only module. */
  serverKinds?: string[];
  /** `serverExports` only: import sources the browser module no longer imports. */
  serverImports?: string[];
}

/** Lower JSX/TSX into hoisted HTML fragments and ordered server slots; diagnostics suppress output. */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
  try {
    return call<CompileResult>({ op: "compile", source, options });
  } catch (error) {
    // A compiler panic is a diagnostic of the module (RV9001); the instance was replaced.
    if (!(error instanceof CompilerPanic)) throw error;
    return {
      code: "",
      diagnostics: [{ category: "error", code: error.code, severity: "error", message: error.message, filename: options.filename ?? "module.tsx" }],
    };
  }
}

/** `check` diagnostic: a stable `RVxxxx` code and a UTF-16 range (`start`/`end`) into the source. */
export interface CheckDiagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  filename: string;
  start: number;
  end: number;
  /** 1-based; absent when the diagnostic has no source range (`start === end === 0`). */
  line?: number;
  column?: number;
  /** Targets that report it. */
  targets: ("server" | "dom")[];
  /** Docs URL of `code` (added by the language service, `docsUrl(code)`). */
  docs?: string;
}

/** A resume site found by `check()`: a closure or binding that runs in the browser on a resumed page, with its captures. */
export interface CheckSite {
  /** Symbol name and id (empty for `ref` sites, which are not symbols). */
  name: string;
  id: string;
  kind: "event" | "attr" | "bind" | "region" | "model" | "ref" | "effect" | "clientEvent" | "computed" | "equals" | "fn" | "slot" | "spread" | "props";
  component: string;
  /** `client`: browser only on a resumed page (handlers, effects, client events, refs); `both`: also
   * evaluated during server rendering (bindings, regions, computeds, local functions). */
  runsOn: "client" | "both";
  /** Closure (or rendered expression) range. */
  start: number;
  end: number;
  /** Attribute name, helper callee or declaration name the site belongs to. */
  anchorStart: number;
  anchorEnd: number;
  /** Captured locals with their binding ranges; `cell` = a boxed `let` (Function Bridge T8). */
  captures: { name: string; kind: "value" | "ref" | "fn" | "cell"; start: number; end: number }[];
}

/** Options of `check()`: file name, resume and the targets to check. */
export interface CheckOptions {
  filename?: string;
  resume?: ResumeOptions | null;
  /** Default both. */
  targets?: ("server" | "dom")[];
  /** See `CompileOptions.sourcePackages`. */
  sourcePackages?: string[];
}

/** Result of `check()`: diagnostics of every target, plus resume sites with `resume`. */
export interface CheckResult {
  diagnostics: CheckDiagnostic[];
  /** `resume` only (empty without). */
  sites: CheckSite[];
}

/** Editor/CLI check: every target's diagnostics (codes, ranges) and resume sites; no code generated. */
export function check(source: string, options: CheckOptions = {}): CheckResult {
  try {
    return call<CheckResult>({ op: "check", source, options });
  } catch (error) {
    if (!(error instanceof CompilerPanic)) throw error;
    const filename = options.filename ?? "module.tsx";
    const targets = options.targets ?? ["server", "dom"];
    return { diagnostics: [{ code: error.code, severity: "error", message: error.message, filename, start: 0, end: 0, targets }], sites: [] };
  }
}

/** Static facts of one module, returned by `moduleFacts()`. */
export interface ModuleFacts {
  /** local → { from, imported } */
  imports: Map<string, { from: string; imported: string }>;
  statics: Set<string>;
  dynamics: Set<string>;
  /** component name → rendered component tag names */
  components: Map<string, Set<string>>;
  /** `ChunkGroup` elements: key (file#name), `preload` prop, rendered tags inside. */
  groups: { key: string; preload: string | null; tags: Set<string> }[];
  preload: string | null;
  defaultName: string | null;
  /** Local exports: exported name → local binding (`export { a as b }`, `export function X`, `export default X`). */
  exports: Map<string, string>;
  /** Re-exports: exported name → source + imported name (`*` for `export * as ns from`). */
  reexports: Map<string, { from: string; imported: string }>;
  /** `export * from "m"` sources. */
  stars: string[];
  /** Top-level compound components `const X = Object.assign(Root, { Part: Local })`: X → root local + part → local. */
  compounds: Map<string, { root: string; parts: Map<string, string> }>;
  /**
   * `boundaries: true` only (derived model, M2 C1): per module-level component, the facts the boundary fixpoint
   * (`facts-fixpoint.ts` `boundaryFacts`) closes over. Empty on older wasm builds (`hasDerivedModel()` false).
   */
  boundaries: Map<string, ComponentBoundaryFacts>;
  /**
   * `boundaries: true` only (ZERO A1): PascalCase bindings the module uses as values — not as a JSX tag, an export
   * specifier, a `typeof` operand, a type or a top-level `Object.assign` compound's root / part (`icon={Glyph}`, a lookup
   * table, a direct call). A component reached this way may render under code the walk does not see: it counts adopted.
   */
  componentValues?: string[];
  /**
   * `holes: true` only (shell cache H-holes, PPR-T6): every streamed boundary element (`<Async>` / `<Suspense>` from
   * `@rivetjs/runtime*`) in source order, and whether a stored shell may re-run only its content on a hit. The server
   * resume target marks eligible ones with a `$hole: 1` prop. Absent without the option.
   */
  holes?: HoleFacts[];
  /**
   * `refs: true` only (ZERO CALLSITE): the module-level reference graph (Rust `facts_refs.rs`) the per-call-site context
   * proof closes over (`facts-callsite.ts`).
   */
  refs?: ModuleRefs;
  /** `serverExports` only: facts are of the browser source; these list what was removed. */
  serverExports?: string[];
  /** Kind per server export (parallel to `serverExports`, see `CompileResult.serverKinds`). */
  serverKinds?: string[];
  serverImports?: string[];
  serverErrors?: { message: string; line: number | null; column: number | null }[];
}

/** ZERO CALLSITE: a module's reference graph (`moduleFacts(…, { refs: true })`). */
export interface ModuleRefs {
  /** Top-level `const X = createContext(…)` (any `…Context(…)` factory) names: context tokens. */
  tokens: Set<string>;
  /**
   * Per top-level declaration (a function, a class, one declarator; `default` for an anonymous default export): the names
   * it declares, the module bindings / import locals its code references as values and as JSX tags, the specifiers it
   * imports dynamically (`import("…")`), the bindings it passes straight to a context reader call (`reads`: `[name, callee]`,
   * `useContext(X)` / `contextProps(…, X)` / `slottedContext(X)` by callee name; the proof resolves the callee); `flags` 1 = code the graph cannot follow (`import(expression)`, `eval`,
   * `require`, `new Function`), 2 = creates context tokens at run time.
   */
  decls: { names: string[]; values: string[]; jsx: string[]; flags: number; dynamic: string[]; reads: [name: string, callee: string][] }[];
  /** Top-level statements that declare nothing (`X.part = Y`): every name in one reaches the others. */
  groups: { values: string[]; flags: number; dynamic: string[] }[];
  /** Namespace imports: local → specifier. */
  namespaces: Map<string, string>;
}

/** Module-level facts of one component for the derived model (`ModuleFacts.boundaries`). */
export interface ComponentBoundaryFacts {
  /** Its own subtree holds a resume site (handler, binding, model, ref, client effect / event, computed, local function, spread). */
  interactive: boolean;
  /**
   * M6-PARITY 6b: it has a change source of its own (a handler, client effect / event, element effect, model binding,
   * keyed state, a `resource`, an `Async` / `Suspense` / `clientOnly` component, or a site reading module state). A
   * component whose sites only read props / context is dependent: a boundary only when live data flows in.
   */
  source: boolean;
  /** It renders a context provider (`<Provider>`, `<X.Provider>`). */
  provides: boolean;
  /**
   * STATIC-ZERO T3: it has an event handler whose value is not a function written in place (`cond ? f : undefined`,
   * `props.onX`, a hook's handler): a change source only for an instance that installs a function — the server checks
   * the value (`_rHandler`); without a source of its own the build marks it conditional.
   */
  listens: boolean;
  /** It (or a nested function / hook of it) calls `useContext` / a `use…Context` helper: its inputs are not only props. */
  context: boolean;
  /** `object`: `function C(props)`; `destructured`: `function C({ a })`; `none`: no parameter. */
  params: "none" | "object" | "destructured";
  /** Component tags it renders (PascalCase / `ns.Tag`), first appearance order. */
  renders: Set<string>;
  /** Every component element it renders, source order: the tag and whether the call site passes data only (no spread,
   * literal / data-literal / data-const attributes, text or site-free static element children). */
  calls: {
    tag: string;
    data: boolean;
    /** The call passes a function (an inline function or a function binding): live data. */
    fn: boolean;
    /** Component tags enclosing the call in this component's JSX, innermost first (context providers around it). */
    around: string[];
    /** Its attributes and expression children are data (element children are calls of their own, function children slots). */
    inputs: boolean;
    /** PLACE cost feature: source bytes of its attributes and text children (≈ the props a record would ship; absent from an older wasm). */
    bytes?: number;
    /** PLACE: it has JSX element / fragment children (a `SITE` instance there is demoted at run time). */
    children?: boolean;
  }[];
  /** PLACE cost feature: native JSX elements written in the component (absent from an older wasm). */
  elements?: number;
}

/**
 * One streamed boundary element (`ModuleFacts.holes`). Eligible = an `<Async>` with a `fallback` whose `load` / `children` /
 * `error` (and render-function child) capture only data — module-level bindings, globals, parameters, `const`s
 * initialised by literals / object and array literals / member reads / operators over those — and whose component creates
 * no reactive state (`signal` / `computed` / `createStore`) outside them; else `because` names the first
 * reason (the shell then replays on a hit: H-replay).
 */
export interface HoleFacts {
  /** The module-level component it is in (null: anonymous / module scope). */
  component: string | null;
  tag: "Async" | "Suspense";
  /** Source offset of the element's `<`, and its 1-based line / column. */
  at: number;
  line: number;
  column: number;
  eligible: boolean;
  because: string | null;
}

/** Options of `moduleFacts()`. */
export interface ModuleFactsOptions {
  /** Route module (see `CompileOptions.serverExports`). */
  serverExports?: boolean;
  /** Resume build: server-only code may not render JSX. */
  resume?: boolean;
  /** Derived model (M2 C1): also compute `ModuleFacts.boundaries` (runs the resume analysis on the module). */
  boundaries?: boolean;
  /** Shell cache H-holes (PPR-T6): also compute `ModuleFacts.holes`. */
  holes?: boolean;
  /** ZERO CALLSITE: also compute `ModuleFacts.refs` (the module-level reference graph). */
  refs?: boolean;
}

interface RawFacts {
  imports: [string, { from: string; imported: string }][];
  statics: string[];
  dynamics: string[];
  components: [string, string[]][];
  groups: { key: string; preload: string | null; tags: string[] }[];
  preload: string | null;
  defaultName: string | null;
  exports?: [string, string][];
  reexports?: [string, string, string][];
  stars?: string[];
  compounds?: [string, string, [string, string][]][];
  componentValues?: string[];
  boundaries?: [
    string,
    {
      interactive: boolean;
      source?: boolean;
      listens?: boolean;
      provides?: boolean;
      context: boolean;
      params: "none" | "object" | "destructured";
      renders: string[];
      calls: [string, boolean, boolean?, string[]?, boolean?, number?, boolean?][];
      elements?: number;
    },
  ][];
  holes?: HoleFacts[];
  refs?: {
    tokens: string[];
    decls: [string[], string[], string[], number, string[]?, [string, string][]?][];
    groups: [string[], number, string[]?][];
    namespaces: [string, string][];
  } | null;
  serverExports?: string[];
  serverKinds?: string[];
  serverImports?: string[];
  serverErrors?: { message: string; line: number | null; column: number | null }[];
}

/**
 * Static facts of one module: imports, lazy edges, components and what they render, chunk groups, preload; with
 * `boundaries: true` also the derived model's per-component facts (`boundaryFacts()` in `./facts-fixpoint.ts` closes them
 * over the module graph).
 */
export function moduleFacts(source: string, filename: string, options?: ModuleFactsOptions): ModuleFacts {
  const raw = call<RawFacts>(options ? { op: "moduleFacts", source, filename, options } : { op: "moduleFacts", source, filename });
  const server = raw.serverExports
    ? { serverExports: raw.serverExports, serverKinds: raw.serverKinds ?? [], serverImports: raw.serverImports, serverErrors: raw.serverErrors }
    : {};
  return {
    ...server,
    imports: new Map(raw.imports),
    statics: new Set(raw.statics),
    dynamics: new Set(raw.dynamics),
    components: new Map(raw.components.map(([name, tags]) => [name, new Set(tags)])),
    groups: raw.groups.map((group) => ({ ...group, tags: new Set(group.tags) })),
    preload: raw.preload,
    defaultName: raw.defaultName,
    exports: new Map(raw.exports ?? []),
    reexports: new Map((raw.reexports ?? []).map(([exported, from, imported]) => [exported, { from, imported }])),
    stars: raw.stars ?? [],
    compounds: new Map((raw.compounds ?? []).map(([name, root, parts]) => [name, { root, parts: new Map(parts) }])),
    boundaries: new Map(
      (raw.boundaries ?? []).map(([name, facts]) => [
        name,
        {
          ...facts,
          // An older wasm (no `source`): every own site is a source (the pre-6b verdict).
          source: facts.source ?? facts.interactive,
          provides: facts.provides ?? false,
          listens: facts.listens ?? false,
          renders: new Set(facts.renders),
          calls: facts.calls.map(([tag, data, fn = false, around = [], inputs = data, bytes, children]) => ({
            tag,
            data,
            fn,
            around,
            inputs,
            ...(bytes === undefined ? {} : { bytes }),
            ...(children === undefined ? {} : { children }),
          })),
        } satisfies ComponentBoundaryFacts,
      ]),
    ),
    ...(raw.componentValues ? { componentValues: raw.componentValues } : {}),
    ...(raw.holes ? { holes: raw.holes } : {}),
    ...(raw.refs
      ? {
          refs: {
            tokens: new Set(raw.refs.tokens),
            decls: raw.refs.decls.map(([names, values, jsx, flags, dynamic = [], reads = []]) => ({ names, values, jsx, flags, dynamic, reads })),
            groups: raw.refs.groups.map(([values, flags, dynamic = []]) => ({ values, flags, dynamic })),
            namespaces: new Map(raw.refs.namespaces),
          },
        }
      : {}),
  };
}

/** Chunk lookups built by `groupComponents()`: chunk group (`ChunkGroup`), route and module preload groups. */
export interface ComponentGroups {
  group(file: string, name: string): string | null;
  groupPreload(id: string): string | null;
  route(file: string): string;
  /**
   * Lazy roots whose static graph reaches the file (`route` keys derive from them), `MAIN_LATE_ROOT` when the shell
   * reaches it only through late files; null when no lazy root does (`route:main`).
   */
  roots(file: string): string[] | null;
  modulePreload(file: string): string | null;
}

/** The shell's route (`route:main`); `MAIN_LATE_ROOT` placed parts go to its intent chunk. */
export const MAIN_ROOT = "main";
/** The shell's name among a file's `roots` when it reaches the file only through late files (`route:main:intent`). */
export const MAIN_LATE_ROOT = "main:intent";

/**
 * Chunk grouping for resume symbols. `component` keeps one chunk per component; `group` groups
 * every component rendered inside a <ChunkGroup> subtree; `route` groups the modules reached from each
 * lazy import edge (defineRoute / lazyComponent targets). Grouping changes chunks and the manifest only.
 * `facts`: Map file → moduleFacts; `resolved`: Map file → Map specifier → resolved file (resumable
 * files only). `through`: extra reach edges (barrel leaves); `late`: files of the intent class (their route's
 * `:intent` chunk) — the shell's reach through them is `MAIN_LATE_ROOT`.
 */
export function groupComponents(
  facts: Map<string, ModuleFacts>,
  resolved: Map<string, Map<string, string>>,
  through?: Map<string, Set<string>>,
  late?: (file: string) => boolean,
): ComponentGroups {
  const target = (file: string, spec: string) => resolved.get(file)?.get(spec) ?? null;
  // Component graph: (file, name) → rendered (file, name).
  const key = (file: string, name: string) => file + "?" + name;
  const resolveTag = (file: string, tag: string): string | null => {
    const own = facts.get(file);
    if (!own) return null;
    if (own.components.has(tag)) return key(file, tag);
    const imported = own.imports.get(tag);
    const to = imported && target(file, imported.from);
    if (!imported || !to) return null;
    const theirs = facts.get(to);
    if (!theirs) return null;
    const name = imported.imported === "default" ? theirs.defaultName : imported.imported;
    return name && theirs.components.has(name) ? key(to, name) : null;
  };
  const edges = new Map<string, string[]>();
  for (const [file, f] of facts)
    for (const [name, rendered] of f.components)
      edges.set(
        key(file, name),
        [...rendered].map((t) => resolveTag(file, t)).filter((t): t is string => Boolean(t)),
      );
  // Chunk groups: every component reachable from a ChunkGroup's children; shared by two groups → its own chunk.
  const group = new Map<string, string | null>(),
    groupPreload = new Map<string, string>();
  for (const [file, f] of facts)
    for (const { key: id, preload, tags } of f.groups) {
      if (preload) groupPreload.set(id, preload);
      const stack = [...tags].map((t) => resolveTag(file, t)).filter((t): t is string => Boolean(t));
      const seen = new Set<string>();
      while (stack.length) {
        const node = stack.pop()!;
        if (seen.has(node)) continue;
        seen.add(node);
        group.set(node, group.has(node) && group.get(node) !== id ? null : id);
        stack.push(...(edges.get(node) ?? []));
      }
    }
  // Routes: files reached statically from each lazy-import target; reached by several → shared.
  const roots = new Set<string>();
  for (const [file, f] of facts)
    for (const spec of f.dynamics) {
      const to = target(file, spec);
      if (to) roots.add(to);
    }
  const reach = new Map<string, Set<string>>();
  for (const root of roots) {
    const stack = [root],
      seen = new Set<string>();
    while (stack.length) {
      const file = stack.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      let by = reach.get(file);
      if (!by) reach.set(file, (by = new Set()));
      by.add(root);
      for (const spec of facts.get(file)?.statics ?? []) {
        const to = target(file, spec);
        if (to && !roots.has(to)) stack.push(to);
      }
      for (const to of through?.get(file) ?? []) if (!roots.has(to)) stack.push(to);
    }
  }
  // The shell's late reach (DOCS-COLD 2026-10-20): files no lazy root reaches are `route:main`. A file a lazy route
  // reaches that the shell reaches ONLY through late files (`late`: intent class) counts the shell among its roots as
  // `MAIN_LATE_ROOT`, so it is placed (imported by `route:main:intent` and the route's chunk) instead of keyed to that
  // route: keyed there, the shell's first intent loaded the lazy route's chunk with everything else in it (docs: the
  // theme menu's cdk popover part sat in the home page's intent chunk with its selects / sliders, 437 KB). Files the
  // EAGER shell reaches keep the lazy routes' keys (`MAIN_ROOT` for them made `route:main` import their parts and the
  // merge pull shared library chunks into the eager shell: cdk story app `rivet-merge-components` before any input).
  // No `late`: nothing to walk. Walked on the first `route` / `roots` call: `late` may read state the caller fills after
  // `groupComponents` returns.
  let walked = !late;
  const walkShell = () => {
    walked = true;
    // Eager paths first: a file reached by one is the eager shell's, a late path cannot downgrade it.
    const eager = new Set<string>(),
      lateOnly = new Set<string>();
    const visit = (starts: string[], into: Set<string>, stop: (file: string) => boolean, onStop?: (file: string) => void) => {
      for (const stack = starts; stack.length;) {
        const file = stack.pop()!;
        if (into.has(file)) continue;
        into.add(file);
        if (stop(file)) {
          onStop?.(file);
          continue;
        }
        for (const spec of facts.get(file)?.statics ?? []) {
          const to = target(file, spec);
          if (to && !roots.has(to)) stack.push(to);
        }
        for (const to of through?.get(file) ?? []) if (!roots.has(to)) stack.push(to);
      }
    };
    const shell = [...facts.keys()].filter((file) => !reach.has(file));
    const lateStarts: string[] = [];
    visit(
      shell,
      eager,
      (file) => !!late?.(file),
      (file) => lateStarts.push(file),
    );
    for (const file of lateStarts) eager.delete(file);
    visit(lateStarts, lateOnly, () => false);
    for (const file of lateOnly) if (!eager.has(file)) reach.get(file)?.add(MAIN_LATE_ROOT);
  };
  // Reached by several routes: one chunk per set of routes (a component library's modules split like the bundler's
  // shared chunks, not one chunk with every shared handler of the app).
  const sets = new Map<Set<string>, string>();
  const route = (file: string) => {
    if (!walked) walkShell();
    const by = reach.get(file);
    if (!by) return "route:main";
    if (by.size === 1) return "route:" + [...by][0];
    let id = sets.get(by);
    // Keyed by the sorted roots themselves (a hash could merge two sets' chunks).
    if (id === undefined) sets.set(by, (id = "route:shared:" + [...by].sort().join("\0")));
    return id;
  };
  return {
    group: (file, name) => group.get(key(file, name)) ?? null,
    groupPreload: (id) => groupPreload.get(id) ?? null,
    route,
    roots: (file) => {
      if (!walked) walkShell();
      const by = reach.get(file);
      return by ? [...by] : null;
    },
    modulePreload: (file) => facts.get(file)?.preload ?? null,
  };
}
