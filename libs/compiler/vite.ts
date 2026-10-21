import { readFile } from "node:fs/promises";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { coLoadGroups, isBarrel, MERGE_BUDGET, withMergeGroup, type CoLoadModule } from "./chunk-groups.ts";
import { barrelUses, type LinkModule } from "./barrel-links.ts";
import { switchContent } from "./switches.ts";
import { boundaryFacts } from "./facts-fixpoint.ts";
import { createFilter, parseAst, type FilterPattern, type HtmlTagDescriptor, type Plugin, type Rollup, type UserConfig, type ViteDevServer } from "vite";
import {
  compile,
  _compileSymbolModule,
  groupComponents,
  MAIN_LATE_ROOT,
  MAIN_ROOT,
  moduleFacts,
  type CompileOptions,
  type CompileResult,
  type ModuleFacts,
  type ResumeSymbol,
} from "./index.ts";
import { docsUrl } from "./codes.ts";
import { appFrames, codeFrame, displayPath, formatDiagnostic, remedyLines } from "./diagnostics-format.ts";
import { runtimeAbiProblem, runtimePackage } from "./abi.ts";
import { hotModule, sourceStamps } from "./hot.ts";
import { updateEditorManifest } from "./editor.ts";
import { imagesPlugin } from "./images/plugin.ts";
import { staticIcons } from "./static-icons.ts";
import { matchesServerOnly, type ServerOnlyPattern } from "./server-only.ts";
import { nameRegistry, scopedName, type ClassNames } from "./styles.ts";
import type { ImagesConfig } from "./images/options.ts";

/** Browser-side `@rivetjs/*` packages (`optimizeDeps.exclude` takes names, not patterns). */
const RIVET_PACKAGES = [
  "@rivetjs/runtime",
  "@rivetjs/reactivity",
  "@rivetjs/router",
  "@rivetjs/forms",
  "@rivetjs/kit",
  "@rivetjs/i18n",
  "@rivetjs/cdk",
  "@rivetjs/devtools",
];

export type { ImagesConfig } from "./images/options.ts";
/** Server-only modules (SERVER-REACH): patterns, the browser stand-in, plugin declarations (`api.rivetServerOnly`). */
export { declaredServerOnly, isServerOnly, matchesServerOnly, serverOnlyStub, SERVER_FILE, SERVER_ONLY_MARKER, type ServerOnlyPattern } from "./server-only.ts";

/** When a resume chunk loads: at start, when idle, when visible, on intent (hover/focus) or on the first interaction. */
export type PreloadStrategy = "eager" | "idle" | "visible" | "intent" | "interaction";
/** `resume.preload.rules` entry: symbols whose id matches load with `strategy`. */
export interface PreloadRule {
  /** Symbol id prefix (`src/page.tsx#Component`), or a pattern. */
  match: string | RegExp;
  strategy: PreloadStrategy;
  /**
   * Route chunks (`chunks: "route"`), `intent` / `interaction` rules: a module whose every symbol matches rules naming
   * this chunk leaves its route's intent chunk for its own (`route:<key>:intent:<chunk>`, emitted
   * `resume-<route>-<chunk>`, same sibling group). For late code with another trigger than the rest: the router app
   * module (docs sites: `.rivet/app.tsx#`, loads on the first link intent) apart from the frame menus it would
   * otherwise share a chunk with. A word: letters, digits, `_`, `-`.
   */
  chunk?: string;
}

/** Resume build options of `rivet({ resume })`: modules, entry, chunk grouping and preload. */
export interface RivetResumeOptions {
  /** Root-relative source modules compiled in resume mode. */
  modules: string[];
  /** Root-relative resume entry whose default export is `createResume(...)`; defaults to an empty one. */
  entry?: string;
  /**
   * Chunk grouping: "route" (default since 2026-10-18, derived-client plan M1) one chunk per lazy-import target's
   * static module graph (`lazyComponent` / route imports), a main chunk, and the modules several routes reach
   * placed by the bundler into shared chunks (merged under `merge` / `cap`); "component" one chunk per component;
   * "group" one chunk per `<ChunkGroup>` subtree (components rendered in several groups, or none, keep their own
   * chunk). Chunks of the same group / route prefetch each other once one is used. Measured (ui-docs frames, Slow 4G):
   * route needs a quarter of the files of component through the first click for about a fifth more bytes, and
   * the first click downloads nothing. Route mode splits each route chunk by load class: a module whose every symbol
   * loads on intent / interaction (component-level `preload`, else a `preload.rules` rule) goes to the route's intent
   * chunk (`resume-<route>-intent`, same sibling group), so a page booting its route chunk (an idle effect, a boot-time
   * listener) does not evaluate it, and the page fetch-ahead leaves it to its intent prefetch.
   */
  chunks?: "component" | "group" | "route";
  /**
   * When a chunk's lazy imports (lazy routes/components it may load on use) prefetch: "idle" (default)
   * once an eager/idle/visible chunk is scheduled, or "intent" only, with the chunk's own intent prefetch.
   */
  lazy?: "idle" | "intent";
  /**
   * Root-relative modules that prefetch their own lazy imports (the router's generated App: its intent
   * handler loads the hovered route's page): their dynamic imports are never listed as lazies of the chunk
   * holding them (nor of any chunk, when only they import the target), so a page's resume state does not name
   * every route chunk and intent on the App's chunk does not prefetch every page.
   */
  lazyOwned?: string[];
  /**
   * Shared chunk merging (client build, PRELOAD-GROUP 2026-10-12): the bundler splits shared code into one chunk per
   * distinct set of entries using it, so a page's preload closure is dozens of small files. Shared modules that load
   * together merge into one chunk while the source bytes entries (symbol chunks, lazily imported modules, app entry,
   * runtime) load without needing them stay under this budget per request saved — summed over entries and checked per
   * merge, so the budget is amortised: one entry can pay more (`chunk-groups.ts`). Chunks every page loads never take
   * page code; a merged chunk never closes an import cycle. Default 65536 (`MERGE_BUDGET`; 2048 until 2026-10-18: 64 K cut the
   * files of a page by a third to a half at flat bytes on the ui-docs frames); `false` = the bundler's automatic split.
   * Skipped when the build sets `codeSplitting: false`, `manualChunks` or `advancedChunks`.
   */
  merge?: number | false;
  /**
   * Most shared chunks one entry (a symbol chunk; with `chunks: "route"` a route's chunk) may load after merging
   * (ROUTE-CHUNKS cluster 2026-10-18): an entry over the cap keeps merging the cheapest pair of its shared chunks past
   * the budget, pinned chunks and import order still respected. Applies to the bundler's shared code chunks and, in
   * route mode, to the shared symbol chunks. Unset = the budget alone decides.
   */
  cap?: number;
  /**
   * Preload overrides. Automatic: click/submit/input handlers prefetch on intent; handlers repeated on
   * 3+ elements (list rows) and hover-like events when visible; window/document client events at idle;
   * `passive: false` listeners eagerly. First matching rule wins; a string matches a symbol id prefix
   * (`src/page.tsx#Component`). Precedence: element `preload="…"` directive > component level (module
   * `export const preload = "…"`, or a `<ChunkGroup preload>`) > these rules > automatic. With `chunks: "route"`, a
   * module whose symbols all resolve to `intent` / `interaction` here (or at the component level) moves to its route's
   * intent chunk and out of the page's fetch-ahead (`data-fo`); rule the renderers of such components too (a frame whose
   * child slots render a menu imports the menu's module).
   */
  preload?: { rules?: PreloadRule[] };
  /**
   * Dev server: serve the modules resumable (`rivetRouter` sets it unless `dev: { resume: false }`).
   * Client modules compile in resume mode (which adds the export list of locals symbol chunks import)
   * and `<module>?rivet-chunk=<Component>` serves a component's symbol chunk, compiled like a
   * production chunk (`api.devResume.manifest()` points symbols at them). Default false: dev client
   * modules compile without resume mode (their pages client-render).
   */
  dev?: boolean;
  /**
   * Every app `.tsx`/`.jsx` module (inside the Vite root, outside `node_modules`) compiles in resume mode
   * when something resumable imports it, like source-package modules; `resume.modules` then only seeds the
   * graph. Without it a component module not listed in `modules` is silently non-resumable and the page
   * fails at request time ("Resume manifest has no chunk").
   * `rivetRouter` sets it (default true there); plain `rivet({ resume })` keeps the explicit list.
   */
  appModules?: boolean;
  /**
   * Lazy collection rows (LAZY-ROWS, experimental; spec `docs/design/specs/2026-10-19-lazy-collection-rows-design.md`):
   * the browser runtime of this build can materialise lazy `<For>` rows (state `L`: rows rendered without resume
   * records, materialised on their first event / a read signal's first change). Adds the lazy rows runtime (about
   * 11.1 KB min / 3.5 KB br, zero-cost `dom` + `dom-resume` `[lazyRows]` lines: `@rivetjs/runtime` `dom-resume-lazy.ts`, `dom-adopt.ts` `_adoptRow` and the adopt-run hooks
   * of the DOM runtime) to the build and `lazyRows: true` to the resume manifest; builds without it carry none of it
   * (0 bytes). The server writes lazy row records only when the manifest says so AND its environment has
   * `RIVET_LAZY_ROWS=on` (read per render): build once with this option, toggle the variable to A/B. Default false.
   */
  lazyRows?: boolean;
  /**
   * DOM-backed loader data (DOM-DATA, experimental; spec `docs/design/specs/2026-10-20-dom-backed-loader-data-design.md`):
   * plain JSON data the page renders as an element's whole text (`<dd>{row().name}</dd>`: loader rows, `<For>` items) is
   * not written into `rivet/state` again — the browser reads those strings back from the DOM on first access (at the latest
   * at the first idle after resume). Adds the reader (`@rivetjs/runtime` `dom-resume-data.ts`, about 1.8 KB min / 0.6 KB br)
   * to the build's resume runtime, the registry + `D` encoder (`server-dom-data.ts`, about 9.1 KB min) to its server and
   * `domData: true` to the resume manifest; servers write `D` entries only then. Builds without it carry neither. Default
   * false.
   */
  domData?: boolean;
  /**
   * Resume model (experimental; derived client, spec `docs/design/specs/2026-10-18-structural-resume-design.md` §3.3–3.5,
   * plan `docs/design/plans/2026-10-18-derived-client.md` M2). `"serialized"` (default): today's records + state table +
   * symbol chunks. `"derived"`: resume modules compile with `resume: { model: "derived" }` on both targets (boundary
   * verdicts from the build's facts fixpoint, `facts-fixpoint.ts`), the page ships values only (a boundaries tail) and the
   * browser adopts boundaries over the server nodes. The build serves the lazy rows + `DERIVED` runtime switches, emits one
   * chunk per module holding boundaries plus the runtime entry (default export of `@rivetjs/runtime/dom-derived`), and
   * writes the manifest with `model: "derived"`, `runtime` and `symbols` keyed by boundary name (`<module>#<Name>`); the
   * router renders such builds with `renderDerived`. `chunks` / `merge` / `cap` / `preload` / `lazy` / `entry` /
   * `lazyRows` / `domData` do not apply. Dev: an edit of a resume module reloads the page.
   */
  model?: "serialized" | "derived";
  /**
   * `model: "derived"` only: root-relative modules whose default export is an independent root boundary (its props are
   * data, whatever its call sites pass or which contexts it reads), like a route module's default export. `rivetRouter()`
   * adds its generated `app.tsx` (`Root`: the route payload as props, M2 R5).
   */
  roots?: string[];
}

/** Scoped styles: css`` blocks and `*.module.<ext>` stylesheets. */
export interface RivetCSSOptions {
  /** Cascade layer of css`` output (default `components`; `false`: unlayered). */
  layer?: string | false;
  /** Layer order statement each extracted sheet starts with (default Tailwind's; `false`: none). */
  layers?: string | false;
  /** Class names: `readable` `<local>_<hash5>` (dev default) or `short` `r<hash6>` (build default). */
  names?: ClassNames;
  /** Root-relative stylesheet referenced by every css`` sheet (`@reference`, for Tailwind `@apply` / theme). */
  reference?: string;
  /** Name `*.module.<ext>` classes like css`` (default true; off when `css.modules.generateScopedName` is set). */
  modules?: boolean;
}

/**
 * A framework bridge (`@rivetjs/bridge-<framework>/vite`, e.g. `react()`): the modules its framework owns and the Vite
 * plugins that compile them. `rivet({ bridges })` inserts the plugins before the Rivet compiler, keeps the owned modules
 * away from it, and imports them into Rivet modules through island facades (`@rivetjs/bridge/vite`, spec
 * docs/design/specs/2026-10-11-framework-bridges-design.md §4).
 */
export interface BridgeEntry {
  /** Framework name (`react`): build messages, the per-page bytes report. */
  name: string;
  /** Whether the framework owns a module (absolute file, no query; `source` when known, for a `@jsxImportSource` pragma). */
  owns(id: string, source?: string): boolean;
  /** npm import specifiers the framework owns (`"@mui/material"` covers its subpaths; RegExps test the whole specifier). */
  specifiers: (string | RegExp)[];
  /** The framework's own Vite plugins (inserted before the Rivet compiler, same ownership filter). */
  plugins(): Plugin[];
  /** Server adapter module specifier (`@rivetjs/bridge-react/server`). */
  server: string;
  /** Client adapter module specifier (`@rivetjs/bridge-react/client`). */
  client: string;
  /** Types module the framework's JSX types come from (tooling). */
  types?: string;
  /** Packages Vite dedupes (`resolve.dedupe`: one framework instance per page). */
  dedupe?: string[];
  /** Client runtime entries pre-bundled on the dev server (`optimizeDeps.include`). */
  optimize?: string[];
  /** Called once the Vite root is known (ownership globs resolve against it). */
  configure?(config: { root: string; command: "build" | "serve" }): void;
  /**
   * Wrapper calls whose result is a component, beyond the built-in list (`memo`, `forwardRef`, `lazy`, `observer`,
   * `defineComponent`, …): an export `X = wrapper(…)` is an island.
   */
  wrappers?: readonly string[];
  /**
   * Islands override: exports that are islands although their value does not look like a component (a component object,
   * a factory's result). `include` entries: an export name (`"Chart"`) or an island key (`"src/charts.tsx#Chart"`, `*` =
   * any run of characters: `"src/widgets/*#*"`). `exclude` (same forms; wins over `include` and detection): exports that
   * look like components but are not islands (a store class, a factory).
   */
  islands?: { include?: readonly string[]; exclude?: readonly string[] };
}

/**
 * @internal What `@rivetjs/bridge/vite` gives the compiler (`api.rivetBridges` of its plugin): island facades are virtual
 * Rivet modules (`\0rivet-island:<target>.tsx`) compiled here like app modules, in resume mode when resuming.
 */
export interface RivetBridgesApi {
  /** The framework entry owning a module (throws RV2145 when two do), else null. */
  owner(file: string, source?: string): BridgeEntry | null;
  /** Whether a module id is an island facade. */
  facade(id: string): boolean;
  /** A facade's TSX (the same text its `load` returns). */
  source(ctx: Rollup.PluginContext, id: string): Promise<string>;
  /** Resume module id of a facade (symbol id prefix). */
  module(id: string): string;
  /** Source files a facade stands for (its target): app-imported lazy chunks, manifest closures. */
  sources(id: string): string[];
  /** Island key (`<module>#<export>`) of an island client module id (a client chunk's facade module), else null. */
  islandKey(id: string): string | null;
  /** Dev: the island client module id of an island key. */
  islandModule(key: string): string | undefined;
  /** Modules a facade's server render records symbols of (`@rivetjs/bridge` `root.tsx`): resume modules with it. */
  seeds(): string[];
}

/** Options of the `rivet()` Vite plugin. */
export interface RivetOptions {
  resume?: RivetResumeOptions;
  /** Scoped styles options (css`` from `@rivetjs/runtime/css`; `*.module.<ext>` naming). */
  css?: RivetCSSOptions;
  /** `?image` / `?jsx` imports (needs `sharp`); `true` = defaults. */
  images?: ImagesConfig | true;
  /** DevTools on the dev server when `@rivetjs/devtools` is installed (default true). */
  devtools?: boolean;
  /**
   * Route modules (root-relative; the router fills this): their server exports (`load(…)`, `onGet(…)`,
   * … wrapper calls) and code only those use are removed from browser builds (`CompileOptions.serverExports`).
   */
  serverExports?: { modules: string[] };
  /**
   * Modules the compiler transforms, among `.tsx` / `.jsx` files (and the router's `.ts` route
   * modules): picomatch globs (relative to the Vite root) or RegExps, Vite `createFilter` rules.
   * Default: all of them (outside `node_modules`, except source packages).
   */
  include?: FilterPattern;
  /** Modules never transformed (another framework's islands, e.g. `src/react/**`). Wins over `include`. */
  exclude?: FilterPattern;
  /**
   * Compile-time icons (default true): `<Icon icon={Check} size={16} class="x" />` (`Icon` from
   * `@rivetjs/kit/icon`, `Check` imported from `lucide`, constant props only) compiles as the inline
   * `<svg>` it renders — same markup, one static template, no component call. `false` keeps every call.
   */
  staticIcons?: boolean;
  /**
   * Framework bridges (`react()` from `@rivetjs/bridge-react/vite`, …): React / Preact / Solid / Vue / Svelte components
   * used as JSX tags in Rivet modules (needs `@rivetjs/bridge`). Each framework owns its modules (`*.react.tsx`, a
   * `@jsxImportSource` pragma, its `include`); a module matching two owners is a build error (RV2145). Absent or empty:
   * nothing changes.
   */
  bridges?: BridgeEntry[];
  /**
   * Modules browser code must never import (module ids / specifiers, or RegExps tested against both): virtual modules a
   * plugin serves with server data, e.g. `"virtual:docs/api"`. With `rivetRouter()` they join its `serverOnly` list
   * (page routes reaching one render as documents, components reaching one fail the build — RV3011); without the router a
   * browser import of one fails the build. Declared to other plugins as `api.rivetServerOnly`.
   */
  serverOnly?: ServerOnlyPattern[];
}

/** A file that asks for another JSX runtime in its leading comments (`@jsxImportSource react`, or a
 * classic `@jsx h` pragma): its JSX belongs to that framework, the Rivet compiler leaves it alone. */
export function foreignJsxPragma(source: string): boolean {
  const head = /^(?:#![^\n]*\n)?(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/.exec(source)![0];
  const named = /@jsxImportSource\s+([^\s*]+)/.exec(head);
  if (named) return named[1] !== "@rivetjs/runtime";
  return /@jsx\s+[^\s*]/.test(head);
}

/** RV2145: a module both the Rivet compiler (an explicit `include`) and a framework bridge claim. */
function ownershipConflict(file: string, owner: BridgeEntry, root: string): Rollup.RollupError {
  const path = relative(root, file).split(sep).join("/");
  return {
    message: `[RV2145] ${path} matches both the Rivet compiler and ${owner.name}({ include }) — pick one owner\n  docs: ${docsUrl("RV2145")}`,
    id: file,
    plugin: "vite-plugin-rivet",
    pluginCode: "RV2145",
    url: docsUrl("RV2145"),
  };
}

const RIVET_RUNTIME = /^@rivetjs\/runtime(?:\/|$)/;
/** Parser language of a JS / TS module path (null: an SFC or other format). */
const langOf = (file: string): "js" | "jsx" | "ts" | "tsx" | null => {
  const ext = /\.([cm]?[jt]sx?)$/.exec(file)?.[1];
  return !ext ? null : ext.endsWith("tsx") ? "tsx" : ext.endsWith("jsx") ? "jsx" : ext.endsWith("ts") ? "ts" : "js";
};
/** Value (not type-only) `@rivetjs/runtime` specifiers of a parsed module: static imports / re-exports + `import()`. */
function runtimeImport(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = runtimeImport(item);
      if (found) return found;
    }
    return null;
  }
  const n = node as { type?: string; importKind?: string; exportKind?: string; source?: { value?: unknown }; specifiers?: { importKind?: string }[] };
  const from = typeof n.source?.value === "string" && RIVET_RUNTIME.test(n.source.value) ? n.source.value : null;
  if (from && (n.type === "ImportDeclaration" || n.type === "ExportNamedDeclaration" || n.type === "ExportAllDeclaration")) {
    const typeOnly = n.importKind === "type" || n.exportKind === "type" || (!!n.specifiers?.length && n.specifiers.every((spec) => spec.importKind === "type"));
    if (!typeOnly) return from;
  }
  if (from && n.type === "ImportExpression") return from;
  for (const key in n) {
    if (key === "source" && n.type !== "ImportExpression") continue;
    const value = (n as Record<string, unknown>)[key];
    if (value && typeof value === "object") {
      const found = runtimeImport(value);
      if (found) return found;
    }
  }
  return null;
}
/**
 * The Rivet runtime a module uses, for RV2148, else null: a value import / re-export / `import()` of `@rivetjs/runtime*`
 * (parsed: `import type`, type-only specifiers, comments and strings never count), or the runtime's JSX pragma in the
 * leading comments. SFCs and other non-JS formats: a value `import … from "@rivetjs/runtime…"` statement (text match).
 */
function rivetRuntimeUse(source: string, file: string): string | null {
  if (!source.includes("@rivetjs/runtime")) return null;
  const head = /^(?:#![^\n]*\n)?(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/.exec(source)![0];
  if (/@jsxImportSource\s+@rivetjs\/runtime\b/.test(head)) return "@jsxImportSource @rivetjs/runtime";
  const lang = langOf(file);
  if (!lang) return /^\s*import\s+(?!type\b)[^;]*?\bfrom\s*["'](@rivetjs\/runtime(?:\/[^"']*)?)["']/m.exec(source)?.[1] ?? null;
  try {
    return runtimeImport((parseAst(source, { lang }) as unknown as { body: unknown[] }).body);
  } catch {
    return null; // a syntax error is the framework plugin's to report
  }
}

/** RV2148: a module a framework bridge owns uses the Rivet runtime (Rivet code the Rivet compiler never sees). */
function foreignRivetRuntime(file: string, owner: BridgeEntry, root: string, use: string): Rollup.RollupError {
  const path = relative(root, file).split(sep).join("/");
  return {
    message: `[RV2148] ${path} is owned by ${owner.name} but uses the Rivet runtime (${use}): Rivet code in a framework module is never compiled by Rivet — move it to a Rivet module, or take the file out of ${owner.name}'s ownership (suffix / include)\n  docs: ${docsUrl("RV2148")}`,
    id: file,
    plugin: "vite-plugin-rivet",
    pluginCode: "RV2148",
    url: docsUrl("RV2148"),
  };
}

/** A resume symbol the dev server compiled, with where its component and captures are in the source. */
export interface DevSymbolInfo {
  id: string;
  kind: string;
  component: string;
  /** Absolute source file. */
  file: string;
  /** Root-relative module id (posix). */
  module: string;
  /** 1-based position of the component declaration (the module start when not found). */
  line: number;
  column: number;
  captures: { name: string; line: number; column: number }[];
}
/** Dev server resume state of the compiler plugin (`api.devResume`). */
export interface DevResume {
  /**
   * Resume manifest for dev SSR: the runtime is the resume entry, a symbol's chunk is
   * `<module>?rivet-chunk=<Component>` (served by this plugin). Symbols resolve from the modules the
   * dev server compiled for SSR; an id no resume-compiled module defines has no chunk.
   */
  manifest(): {
    runtime: string;
    symbols: Record<string, string>;
    builtins?: string;
    loader?: string;
    captures: Record<string, readonly string[]>;
    /** Framework island key (`<module>#<export>`) → dev island module URL (`rivet({ bridges })`). */
    islands?: Record<string, string>;
    /** `resume.lazyRows`: the dev resume runtime materialises lazy rows. */
    lazyRows?: boolean;
    /** `resume.domData`: the dev resume runtime reads DOM-backed loader data. */
    domData?: boolean;
    /** `resume.model: "derived"`: `runtime` is the dev derived entry, `symbols` maps boundary names to dev module URLs. */
    model?: "derived";
  };
  /** Component, source location and capture names of a symbol id compiled for dev SSR. */
  describe(id: string): DevSymbolInfo | undefined;
}

interface Chunk {
  parts: Map<string, ResumeSymbol[]>;
  symbols: ResumeSymbol[];
  preload: string | null;
  sibling: string;
  /** Route chunks: shared (placed) modules the route reaches, imported for their registration side effect. */
  shared?: string[];
}

const CHUNK = "\0rivet-resume-chunk:";
const PART = "\0rivet-resume-part:";
/** Vite's `__vitePreload` helper module (virtual). */
const VITE_PRELOAD_HELPER = "\0vite/preload-helper.js";

/** Appended to a route-mode part module: registers its symbols (by the id after `#`) under the module id. */
function registration(mod: string, symbols: ResumeSymbol[]): string {
  const table = symbols.map((symbol) => `${JSON.stringify(symbol.id.slice(symbol.id.indexOf("#") + 1))}: ${symbol.name}`).join(", ");
  return `import { _rSym } from "@rivetjs/runtime/resume-symbols";\n_rSym(${JSON.stringify(mod)}, { ${table} });\n`;
}
const ENTRY = "\0rivet-resume-entry";
/** `resume.model: "derived"`: the runtime entry (manifest `runtime`, default export = the `dom-derived` instance). */
const DERIVED_ENTRY = "\0rivet-derived-entry";
/**
 * `resume.model: "derived"`, server: the router's `@rivetjs/runtime/server-resume` import resolves here, so its
 * `renderResumable` / `resumableToString` are `renderDerived` / `derivedToString` (`@rivetjs/runtime/server-derived`). Build
 * time selection: the router source is untouched (serialized-model servers carry 0 B of it).
 */
const DERIVED_SERVER = "\0rivet-derived-server-resume";
const ROUTER_MODULE = /[\\/](?:libs[\\/]router|@rivetjs[\\/]router)[\\/]/;
const MANIFEST = ".vite/rivet-resume.json";
/**
 * `resume.lazyRows` (LAZY-T5B): the runtime's build-time switch modules (`@rivetjs/runtime` `lazy-rows.ts` /
 * `lazy-rows-resume.ts`, sources or published `.js`) → their opted-in content (`switches.ts`). Matched by path: the workspace source
 * (`libs/runtime/`) or an installed package (`@rivetjs/runtime/`, any package manager layout).
 */
const LAZY_SWITCH = /[\\/](?:libs[\\/]runtime|@rivetjs[\\/]runtime)[\\/](lazy-rows(?:-resume)?)\.([cm]?[jt]s)$/;
function lazySwitch(id: string): string | null {
  const hit = LAZY_SWITCH.exec(id);
  return hit && switchContent(hit[1]!, (module) => "./" + module + "." + hit[2]);
}
/** `resume.model: "derived"` (M2 C3): the runtime's `derived.ts` switch (`DERIVED`, the adopt run's `_for` hook) → its
 * opted-in content (`switches.ts`); the derived build serves the lazy rows switches with it (browser only). */
const DERIVED_SWITCH = /[\\/](?:libs[\\/]runtime|@rivetjs[\\/]runtime)[\\/](derived)\.([cm]?[jt]s)$/;
function derivedSwitch(id: string): string | null {
  const hit = DERIVED_SWITCH.exec(id) ?? LAZY_SWITCH.exec(id);
  return hit && switchContent(hit[1]!, (module) => "./" + module + "." + hit[2]);
}
/** `resume.domData` (DOM-DATA): the runtime's switch modules (`dom-data.ts` / `dom-data-resume.ts` for the browser,
 * `dom-data-server.ts` for the server) → their opted-in content (`switches.ts`). */
const DOM_DATA_SWITCH = /[\\/](?:libs[\\/]runtime|@rivetjs[\\/]runtime)[\\/](dom-data(?:-resume|-server)?)\.([cm]?[jt]s)$/;
function domDataSwitch(id: string): string | null {
  const hit = DOM_DATA_SWITCH.exec(id);
  return hit && switchContent(hit[1]!, (module) => "./" + module + "." + hit[2]);
}
// V8 explicit compile hint: compile every function when the script is compiled (module scripts: on the
// streaming compile thread while they download). Client entry chunks: their functions run at startup (mount),
// which otherwise re-parses + lazily compiles each one on the main thread (krausest startup scriptBootup
// median 7.3 → 3.7 ms, ready 32.2 → 29.0 ms, +29 B). Resume chunks are fetched and evaluated at idle or on intent, so their functions compile there
// instead of lazily inside the first interaction (whose handler, dispatch and flush paths run for the first
// time). Lazily imported (dynamic) chunks stay lazy.
const EAGER = "//# allFunctionsCalledOnLoad\n";
/** Prepend the eager-compile hint to the chunks matching `root` and their static imports (maps shift a line). */
function hintEagerCompile(bundle: Rollup.OutputBundle, root: (output: Rollup.OutputChunk) => boolean): void {
  const stack = Object.values(bundle)
      .filter((o): o is Rollup.OutputChunk => o.type === "chunk" && !!o.facadeModuleId && root(o))
      .map((o) => o.fileName),
    seen = new Set<string>();
  while (stack.length) {
    const file = stack.pop()!;
    const output = bundle[file];
    if (seen.has(file) || output?.type !== "chunk") continue;
    seen.add(file);
    stack.push(...output.imports);
    if (output.code.startsWith(EAGER)) continue;
    output.code = EAGER + output.code;
    if (output.map) output.map.mappings = ";" + output.map.mappings;
  }
}

/** Compile project JSX/TSX for Vite's DOM or SSR environment. Styles use Vite's normal pipeline.
 * `resume.modules` (root-relative paths) compile in resume mode: the client build emits symbol chunks
 * grouped by `resume.chunks` (default one per route) plus the resume runtime entry, and writes
 * `.vite/rivet-resume.json`.
 * Transformed modules carry source maps in dev and when `build.sourcemap` is set. On the dev server,
 * client modules hot-replace their exported components in place, keeping component state
 * (`@rivetjs/runtime/hot`; a module comment `@refresh reset` opts out of keeping it). Plugins with an
 * `api.rivetCompileOptions(server, id)` (e.g. `@rivetjs/i18n/vite`) contribute compile options.
 * With `@rivetjs/devtools` installed, the dev server also serves the DevTools panel under
 * `<base>__rivet/devtools/` and pages load its agent first (`devtools: false` opts out); builds never
 * include it. `images` adds the image plugin (`?image` / `?jsx` imports) and returns both plugins. */
export function rivet(options: RivetOptions & ({ images: ImagesConfig | true } | { bridges: BridgeEntry[] })): Plugin[];
export function rivet(options?: RivetOptions): Plugin;
export function rivet({
  resume,
  images,
  devtools = true,
  css = {},
  serverExports,
  include,
  exclude,
  staticIcons: icons = true,
  bridges,
  serverOnly,
}: RivetOptions = {}): Plugin | Plugin[] {
  const plugin = rivetPlugin(resume, devtools, css, serverExports, { include, exclude }, icons, serverOnly ?? []);
  // Bridges: framework plugins first (they own their modules), then the facade host, then the Rivet compiler.
  const framed = bridges?.length ? [...bridges.flatMap((entry) => entry.plugins()), bridgeHost(bridges), plugin] : [plugin];
  if (images) framed.push(imagesPlugin(images));
  return images || bridges ? framed : plugin;
}

/**
 * The bridge plugin (`@rivetjs/bridge/vite`: facades, island modules, dedupe, HMR, bytes report), loaded from the app
 * root when Vite starts (an optional peer: only apps with bridges install it); every hook delegates to it.
 */
function bridgeHost(entries: BridgeEntry[]): Plugin {
  let impl: Plugin | null = null;
  type Hook = (this: unknown, ...args: unknown[]) => unknown;
  const hook = (name: keyof Plugin) =>
    function (this: unknown, ...args: unknown[]): unknown {
      const value = impl?.[name] as Hook | { handler: Hook } | undefined;
      const fn = typeof value === "function" ? value : value?.handler;
      return fn?.apply(this, args);
    };
  return {
    name: "vite-plugin-rivet-bridge",
    enforce: "pre",
    api: {
      get rivetBridges(): RivetBridgesApi | undefined {
        return (impl?.api as { rivetBridges?: RivetBridgesApi } | undefined)?.rivetBridges;
      },
    },
    async config(config, env) {
      const root = resolve(config.root ?? process.cwd());
      let mod: { bridgePlugin(entries: BridgeEntry[]): Plugin };
      try {
        mod = await import(pathToFileURL(createRequire(join(root, "package.json")).resolve("@rivetjs/bridge/vite")).href);
      } catch {
        mod = await import("@rivetjs/bridge/vite" as string);
      }
      impl = mod.bridgePlugin(entries);
      return hook("config").call(this, config, env) as UserConfig | null;
    },
    configResolved: hook("configResolved") as Plugin["configResolved"],
    configureServer: hook("configureServer") as Plugin["configureServer"],
    buildStart: hook("buildStart") as Plugin["buildStart"],
    resolveId: hook("resolveId") as Plugin["resolveId"],
    load: hook("load") as Plugin["load"],
    generateBundle: hook("generateBundle") as Plugin["generateBundle"],
    hotUpdate: hook("hotUpdate") as Plugin["hotUpdate"],
  };
}
// Fact resolutions in flight (`importer \0 specifier` → count): the compiler resolves every specifier its module facts list
// (type-only imports too) to group resume chunks and name module references; none of them is an import. Import guards
// (the router's server-only check) ask `_factsResolve`. Not `this.resolve(…, { custom })`: rolldown 1.2.12 keys the
// options of a context resolve by `resolveOptionsMap.size` and deletes them after the call, so concurrent resolves reuse
// a live key and a hook sees another call's `custom`, or none.
const factsInFlight = new Map<string, number>();
async function resolveFact(ctx: { resolve: Rollup.PluginContext["resolve"] }, spec: string, importer: string) {
  const key = importer + "\0" + spec;
  factsInFlight.set(key, (factsInFlight.get(key) ?? 0) + 1);
  try {
    return await ctx.resolve(spec, importer);
  } finally {
    const n = factsInFlight.get(key)! - 1;
    if (n) factsInFlight.set(key, n);
    else factsInFlight.delete(key);
  }
}
/** Whether a `resolveId` call is the compiler resolving a module fact (an import specifier it lists, type-only too) of
 * `importer` rather than an import of the module graph. Import guards skip these. */
export const _factsResolve = (specifier: string, importer: string | undefined): boolean =>
  importer !== undefined && factsInFlight.has(importer + "\0" + specifier);
/** Virtual stylesheet of a module's css`` blocks: `<module path>` + this suffix. */
export const _STYLE_SUFFIX = ".rivet.css";
const DEFAULT_LAYERS = "theme, base, components, utilities";

/** `.tsx`/`.jsx` leaves reachable from a source-package entry through relative `export … from` / `import … from` in `.ts`/`.js` barrels (cycle-safe, sorted). */
export function barrelLeaves(entry: string, seen = new Set<string>()): string[] {
  if (seen.has(entry) || !existsSync(entry)) return [];
  seen.add(entry);
  if (/\.[jt]sx$/.test(entry)) return [entry];
  if (!/\.[cm]?[jt]s$/.test(entry)) return [];
  const out = new Set<string>();
  const source = readFileSync(entry, "utf8");
  for (const m of source.matchAll(/(?:export|import)\s[^;]*?from\s*["'](\.[^"']+)["']/g)) {
    for (const leaf of barrelLeaves(resolve(dirname(entry), m[1]!), seen)) out.add(leaf);
  }
  return [...out].sort();
}

/**
 * The `.tsx`/`.jsx` leaves behind one export of a `.ts`/`.js` barrel (`chunks: "route"` reach): `export { name } from`
 * follows that module, `export * from` the first module that exports the name; a name the barrel defines itself (a
 * compound `Object.assign(Root, { … })`) takes every leaf it imports. Relative specifiers only, like `barrelLeaves`.
 */
export function exportLeaves(entry: string, name: string, memo = new Map<string, string[]>(), seen = new Set<string>(), star = false): string[] {
  const key = entry + "\0" + name;
  const known = memo.get(key);
  if (known) return known;
  if (seen.has(key)) return (seen.add("\0cut"), []);
  if (!existsSync(entry)) return [];
  seen.add(key);
  const leaf = /\.[jt]sx$/.test(entry);
  if (!leaf && !/\.[cm]?[jt]s$/.test(entry)) return [];
  const source = readFileSync(entry, "utf8");
  const near = (spec: string) => resolve(dirname(entry), spec);
  const word = name.replace(/\$/g, "\\$");
  // Declared here: `export const|function|class name`, `export { local as name }`, `export default` for "default".
  const declared =
    new RegExp("export\\s+(?:declare\\s+)?(?:const|let|var|function\\*?|class|async\\s+function)\\s+" + word + "(?![\\w$])").test(source) ||
    (name === "default" && /export\s+default\b/.test(source)) ||
    [...source.matchAll(/export\s+\{([^}]*)\}(?!\s*from)/g)].some((m) =>
      m[1]!.split(",").some((part) => (part.trim().split(/\s+as\s+/)[1] ?? part.trim()).trim() === name),
    );
  // A component module: itself when it has the name (always when imported directly).
  if (leaf) return star && !declared ? [] : [entry];
  let out: string[] | null = null;
  for (const m of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'](\.[^"']+)["']/g))
    for (const part of m[1]!.split(",")) {
      const [from, as = from] = part
        .replace(/^\s*type\s+/, "")
        .trim()
        .split(/\s+as\s+/);
      if (as?.trim() === name && from) out ??= exportLeaves(near(m[2]!), from.trim(), memo, seen);
    }
  if (!out && declared) out = barrelLeaves(entry);
  if (!out)
    for (const m of source.matchAll(/export\s*\*\s*from\s*["'](\.[^"']+)["']/g)) {
      const hit = exportLeaves(near(m[1]!), name, memo, seen, true);
      if (hit.length) {
        out = hit;
        break;
      }
    }
  out ??= [];
  // A miss decided while an `export *` cycle was cut short is not final for this module: not memoized.
  if (out.length || !seen.has("\0cut")) memo.set(key, out);
  return out;
}

/** Resume membership for editors (`.rivet/editor.json`); best effort, builds never depend on it.
 * Written on every config resolution (bumps its mtime: `rivet-check`'s staleness check). */
function writeEditorManifest(root: string, resume: RivetResumeOptions | undefined): void {
  const posix = (path: string) => path.split(sep).join("/");
  try {
    updateEditorManifest(root, {
      // Undefined removes what a previous config wrote.
      resumeModules: resume ? [...new Set(resume.modules.map(posix))].sort() : undefined,
      preloadRules: resume?.preload?.rules?.length
        ? resume.preload.rules.map(({ match, strategy }) => ({
            match: typeof match === "string" ? match : { regex: match.source, flags: match.flags },
            strategy,
          }))
        : undefined,
    });
  } catch {}
}

function rivetPlugin(
  resume: RivetResumeOptions | undefined,
  devtools: boolean,
  cssOptions: RivetCSSOptions,
  serverExports: { modules: string[] } | undefined,
  patterns: { include?: FilterPattern; exclude?: FilterPattern },
  icons: boolean,
  serverOnly: readonly ServerOnlyPattern[],
): Plugin {
  // `include` / `exclude` (resolved against the Vite root once it is known).
  let selected: (id: string) => boolean = () => true;
  let ssrBuild = false,
    // `resume.lazyRows`: this client build's resume runtime has the lazy rows factory (`lazySwitch`).
    lazyRowsIn = false,
    // `resume.domData`: this client build's resume runtime has the DOM data reader (`domDataSwitch`).
    domDataIn = false,
    abiChecked = false,
    serve = false,
    sourceMap = false,
    root = process.cwd(),
    base = "/",
    // `rivetRouter()` in the config: it owns the server-only guard (document routes, RV3011); else `serverOnly` is guarded here.
    routed = false;
  const resumable = new Set<string>();
  // `resume.model: "derived"` (M2 C3): per resume module, the build's boundary verdicts (`facts-fixpoint.ts`, buildStart
  // of every build environment: client and server walk the same graph, so both targets get the same boundaries / names /
  // keys); dev compiles without them (module-local closure, identical on both targets).
  const derivedModel = resume?.model === "derived";
  const derivedVerdicts = new Map<string, { boundaries: string[]; independent: string[] }>();
  // `resume.roots`: modules whose default export is an independent root (the router's generated `Root`).
  const isDerivedRoot = (filename: string): boolean => !!resume?.roots?.some((path) => resolve(root, path) === resolve(filename));
  // Dev: boundary name (`<module>#<export>`, compile results) → defining file, for the dev manifest's `symbols`.
  const derivedDev = new Map<string, string>();
  // Client build: module → its boundary names as the DOM compile emitted them (`CompileResult.boundaries`: the export
  // names the runtime reads from the chunk), for the manifest's `symbols`.
  const derivedNames = new Map<string, string[]>();
  // Framework bridges (`rivet({ bridges })`): the facade host's api once Vite resolved the config, else null.
  let bridges: RivetBridgesApi | null = null;
  /** An island facade (`\0rivet-island:…`): a virtual Rivet module (its text from the bridge plugin). */
  const virtual = (id: string): boolean => id.startsWith("\0") && !!bridges?.facade(id);
  /** `resolve` for module ids that may be virtual (`\0…` ids are not paths). */
  const abs = (id: string): string => (id.startsWith("\0") ? id : resolve(id));
  const sourceOf = async (ctx: Rollup.PluginContext, id: string): Promise<string> => (virtual(id) ? bridges!.source(ctx, id) : readFile(id, "utf8"));
  // Compile-time icons (`static-icons.ts`): every compile of a module (both targets, resume, CSS-only updates) sees
  // the same rewritten source, so symbol ids agree. lucide data comes from the `lucide` the importer resolves
  // (Node resolution: the same on every environment; its CJS build holds the same data).
  const lucide = new Map<string, Record<string, unknown> | null>();
  const lucideFor = (importer: string): Record<string, unknown> | null => {
    let file: string;
    try {
      file = createRequire(importer).resolve("lucide");
    } catch {
      return null;
    }
    let exports = lucide.get(file);
    if (exports === undefined) {
      try {
        exports = createRequire(importer)(file) as Record<string, unknown>;
      } catch {
        exports = null;
      }
      lucide.set(file, exports);
    }
    return exports;
  };
  const prepared = (filename: string, source: string): string => (icons && /\.[jt]sx$/.test(filename) ? staticIcons(source, filename, lucideFor) : source);
  // Read live: the router adds route modules while the dev server runs.
  const isRoute = (filename: string) => !!serverExports?.modules.some((path) => resolve(root, path) === resolve(filename));
  const split = (filename: string) => (isRoute(filename) ? { serverExports: true } : {});
  // Compile options contributed by sibling plugins (`api.rivetCompileOptions`, e.g. @rivetjs/i18n),
  // given the target and the module id (with its query) when one is being transformed.
  let contributors: ((server: boolean, id?: string) => Partial<CompileOptions>)[] = [];
  const contributed = (server: boolean, id?: string): Partial<CompileOptions> =>
    contributors.length ? Object.assign({ dev: serve }, ...contributors.map((f) => f(server, id))) : {};
  // DevTools server module once resolved on the dev server (null: off or not installed).
  let tools: typeof import("@rivetjs/devtools/server") | null = null;
  const chunks = new Map<string, Chunk>(); // virtual id → chunk
  let merged = new Map<string, string>(); // module id → shared chunk name (`resume.merge`, buildEnd → outputOptions)
  const parts = new Map<string, { file: string; symbols: ResumeSymbol[] }>(); // part id → part
  /** Chunk grouping in force (`resume.chunks`, default route): read here, never the raw option (undefined = default). */
  const chunkStrategy = (): "component" | "group" | "route" => resume?.chunks ?? "route";
  // Route mode: modules several routes reach are no chunks of their own (ROUTE-CHUNKS placed parts, 2026-10-18): their
  // part module is imported by every route chunk reaching it and the bundler places it, with its import closure, in a
  // shared chunk by the routes using it (merged under `resume.merge` / `cap` at buildEnd, on the real module graph).
  // The manifest then points their symbols at whichever chunk holds the part. One emitted chunk per exact set of routes
  // was both the request count and a Rolldown stack overflow (ui-docs: 193 nested sets over 1,036 frames), and
  // clustering those sets up front could not see the closures and lazy imports a merge drags along.
  const placed = new Map<string, { symbols: ResumeSymbol[]; preload: string | null; late: string | false }>(); // shared file → its symbols
  // Route mode: component-level preload (module `export const preload`, else its ChunkGroup's) per symbol id — a route
  // chunk holds many modules, so a chunk-wide preload would be the first module's.
  const routePreload = new Map<string, string>();
  // Route mode: modules whose every symbol loads on intent / interaction → their late chunk's key suffix: `intent` (the
  // route's `:intent` chunk), or `intent:<name>` when every symbol's rule names a `chunk` (buildStart).
  const lateFiles = new Map<string, string>();
  const posix = (path: string) => path.split(sep).join("/");
  // Dev server: symbols of the resume modules compiled for SSR (symbol id → its module's source and symbol).
  // id → defining file → its symbol (fix round 2, L2: a shared canonical module reference id has several definers; it
  // stays while any of them still defines it). Lookups take the first definer.
  const devDefs = new Map<string, Map<string, { file: string; source: string; symbol: ResumeSymbol }>>();
  const devSymbols = {
    get: (id: string) => devDefs.get(id)?.values().next().value,
    define(id: string, entry: { file: string; source: string; symbol: ResumeSymbol }) {
      let files = devDefs.get(id);
      if (!files) devDefs.set(id, (files = new Map()));
      files.set(entry.file, entry);
    },
    drop(id: string, file: string) {
      const files = devDefs.get(id);
      if (files?.delete(file) && files.size === 0) devDefs.delete(id);
    },
  };
  const devModules = new Map<string, string[]>(); // module id → its symbol ids (replaced on each SSR transform)
  // `@rivetjs/runtime/resume-builtins` (built-in entry decoders, loaded only by pages whose state holds such entries):
  // its resolved id (production: an emitted chunk, manifest `builtins`) once `buildStart` resolved it.
  let builtinsId: string | null = null;
  // `@rivetjs/runtime/resume-loader-module` (the resume loader's scheduled prefetch / idle warm-up, imported by the inline
  // stub after the first frame or with the first intent): an emitted chunk, manifest `loader` (hashed, cached across pages).
  let loaderId: string | null = null;
  // Serialized model dev manifest (`api.devResume.manifest()`).
  const devManifest = (): ReturnType<DevResume["manifest"]> => ({
    runtime: base + (resume?.entry ? posix(resume.entry).replace(/^\.?\//, "") : "@id/__x00__rivet-resume-entry"),
    ...(builtinsId ? { builtins: base + devUrl(builtinsId) } : {}),
    ...(loaderId ? { loader: base + devUrl(loaderId) } : {}),
    ...(resume?.lazyRows ? { lazyRows: true } : {}),
    ...(resume?.domData ? { domData: true } : {}),
    symbols: new Proxy({} as Record<string, string>, {
      get: (_, id) => {
        const known = typeof id === "string" ? devSymbols.get(id) : undefined;
        return (
          known && base + devUrl(known.file) + "?rivet-chunk=" + encodeURIComponent(known.symbol.kind === "ref" ? known.symbol.id : known.symbol.component)
        );
      },
    }),
    // Framework islands (`rivet({ bridges })`): island key → its dev island module URL.
    ...(bridges
      ? {
          islands: new Proxy({} as Record<string, string>, {
            get: (_, key) => {
              const id = typeof key === "string" ? bridges?.islandModule(key) : undefined;
              return id && base + devUrl(id);
            },
          }),
        }
      : {}),
    // Capture names per symbol id (Function Bridge Q6 / T19): render errors name the capture as written (`o.a`, not the
    // member-narrowed parameter `o$a`: `labels`). Dev only — the production manifest (`.vite/rivet-resume.json`) never has them.
    captures: new Proxy({} as Record<string, readonly string[]>, {
      get: (_, id) => {
        const symbol = typeof id === "string" ? devSymbols.get(id)?.symbol : undefined;
        return symbol && (symbol.labels ?? symbol.captures);
      },
    }),
  });
  const devResume: DevResume = {
    manifest: () =>
      derivedModel
        ? {
            model: "derived",
            runtime: base + devUrl(DERIVED_ENTRY),
            symbols: new Proxy({} as Record<string, string>, {
              get: (_, name) => {
                const file = typeof name === "string" ? derivedDev.get(name) : undefined;
                return file && base + devUrl(file);
              },
            }),
            captures: {},
            ...(builtinsId ? { builtins: base + devUrl(builtinsId) } : {}),
          }
        : devManifest(),
    describe(id) {
      const known = devSymbols.get(id);
      if (!known) return undefined;
      const { file, source, symbol } = known;
      const at = (index: number) => {
        const before = source.slice(0, Math.max(0, index));
        return { line: before.split("\n").length, column: index - before.lastIndexOf("\n") };
      };
      const word = (name: string) => name.replace(/[$.[\]]/g, "\\$&");
      const declared = new RegExp(`(?:function\\s*\\*?\\s*${word(symbol.component)}\\b|\\b(?:const|let|var)\\s+${word(symbol.component)}\\b)`).exec(source);
      const start = declared?.index ?? (symbol.component === "default" ? Math.max(0, source.indexOf("export default")) : 0);
      // A capture: its declaration in the component (`const x`, `let [x`), else its first mention there.
      // Patterns end with the name as group 1: its index is the match end minus its length.
      const find = (pattern: RegExp): number | null => {
        pattern.lastIndex = start;
        const hit = pattern.exec(source);
        return hit ? hit.index + hit[0].length - hit[1]!.length : null;
      };
      // Named as written (`labels`: `o.a` for the member-narrowed `o$a`); a member capture is located at its object's declaration.
      const captures = (symbol.labels ?? symbol.captures).map((name) => {
        const root = /^[\w$]+/.exec(name)?.[0] ?? name;
        const declared = find(new RegExp(`\\b(?:const|let|var)\\s+(?:[{[][^=;]*?)?(?<![\\w$.])(${word(root)})(?![\\w$])`, "g"));
        const mentioned = find(new RegExp(`(?<![\\w$.])(${word(name)})(?![\\w$])`, "g"));
        return { name, ...at(declared ?? mentioned ?? start) };
      });
      return { id, kind: symbol.kind, component: symbol.component, file, module: moduleId(file), ...at(start), captures };
    },
  };
  // Framework packages keep the plain `signal` (their state is not component state); their tests
  // directories hold apps like any other.
  const FRAMEWORK = new Set(["@rivetjs/runtime", "@rivetjs/reactivity", "@rivetjs/router", "@rivetjs/compiler", "@rivetjs/devtools", "@rivetjs/forms"]);
  const packages = new Map<string, string | null>(); // directory → package dir of its nearest package.json
  const packageOf = (dir: string): string | null => {
    let found = packages.get(dir);
    if (found === undefined) {
      found = existsSync(join(dir, "package.json")) ? dir : dirname(dir) === dir ? null : packageOf(dirname(dir));
      packages.set(dir, found);
    }
    return found;
  };
  const appModule = (file: string): boolean => {
    if (file.startsWith("\0")) return virtual(file);
    if (/[/\\]node_modules[/\\]/.test(file)) return false;
    const dir = packageOf(dirname(file));
    if (!dir) return true;
    const { name } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: string };
    return !(name && FRAMEWORK.has(name)) || /^tests[/\\]/.test(relative(dir, file));
  };
  // Installed framework packages ship their components as preserved-JSX `.jsx` (`router/client/link.jsx`,
  // `forms/components.jsx`): compiled like their workspace sources, which are not under node_modules.
  const frameworkNames = new Map<string, boolean>(); // package dir → framework package
  const frameworkJsx = (file: string): boolean => {
    if (!/\.[jt]sx$/.test(file)) return false;
    const dir = packageOf(dirname(file));
    if (!dir) return false;
    let hit = frameworkNames.get(dir);
    if (hit === undefined) {
      const { name } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: string };
      frameworkNames.set(dir, (hit = !!name && FRAMEWORK.has(name)));
    }
    return hit;
  };
  // Source packages (`"rivet": { "source": true }` in package.json, e.g. @rivetjs/cdk): their .tsx
  // compile like app code even under node_modules and, in resume apps, in resume mode, with module ids
  // `<package name>/<path>` (stable across apps).
  const sources = new Map<string, { name: string; dir: string } | null>(); // package dir → source package
  const sourcePackage = (file: string): { name: string; dir: string } | null => {
    if (file.startsWith("\0")) return null;
    // Files of the app itself (inside the Vite root, outside node_modules) are app modules.
    if (!/[/\\]node_modules[/\\]/.test(file) && !relative(root, file).startsWith("..")) return null;
    const dir = packageOf(dirname(file));
    if (!dir) return null;
    let found = sources.get(dir);
    if (found === undefined) {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: string; rivet?: { source?: boolean } };
      sources.set(dir, (found = pkg.name && pkg.rivet?.source === true ? { name: pkg.name, dir } : null));
    }
    return found;
  };
  // Source packages a module imports (bare specifiers resolved through node_modules from its directory):
  // the compiler treats their components as user components (`sourcePackages`, resume mode).
  const importedSources = new Map<string, string | null>(); // "<dir>\0<package name>" → source package name
  const sourcePackagesOf = (filename: string, source: string): string[] => {
    const found = new Set<string>();
    for (const [, specifier = ""] of source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"'.\/][^"']*)["']/g)) {
      const name = specifier
        .split("/")
        .slice(0, specifier.startsWith("@") ? 2 : 1)
        .join("/");
      const key = dirname(filename) + "\0" + name;
      let hit = importedSources.get(key);
      if (hit === undefined) {
        hit = null;
        for (let dir = dirname(filename); ; dir = dirname(dir)) {
          const pkg = join(dir, "node_modules", name);
          if (existsSync(join(pkg, "package.json"))) {
            hit = sourcePackage(join(pkg, "package.json"))?.name ?? null;
            break;
          }
          if (dirname(dir) === dir) break;
        }
        importedSources.set(key, hit);
      }
      if (hit) found.add(hit);
    }
    return [...found].sort();
  };
  // Function Bridge T3 (fix M1): module reference ids name the RESOLVED imported module, so `./util`, `./util.js` and
  // `./util.ts` from any importer give one id (and `util.ts` / `util/index.ts` stay two). Specifier → module id per resume
  // module, filled by `resolveImports` before its compiles (transform, buildStart, dev chunks); app files and source
  // packages only — other packages keep the specifier (their files may differ per environment condition).
  const resolvedImports = new Map<string, Record<string, string>>();
  // Specifier → resolved file (no query) per resume module, every resolvable import (fix round 3, G2: import reference
  // ids of packages keep the specifier, so two installed copies share an id — the client build checks the files).
  const resolvedFiles = new Map<string, Record<string, string>>();
  const resolveImports = async (ctx: { resolve: Rollup.PluginContext["resolve"] }, filename: string, source: string): Promise<void> => {
    const map: Record<string, string> = {};
    const files: Record<string, string> = {};
    let statics: Iterable<string> = [];
    try {
      statics = moduleFacts(source, filename).statics;
    } catch {
      // A module that does not parse fails its compile with the diagnostics.
    }
    for (const spec of statics) {
      const hit = await resolveFact(ctx, spec, filename);
      const [file = null, query = ""] = hit && !hit.external ? hit.id.split("?", 2) : [];
      if (!file || file.startsWith("\0") || !existsSync(file)) continue;
      files[spec] = file;
      const inApp = !/[/\\]node_modules[/\\]/.test(file) && !relative(root, file).startsWith("..");
      // The query stays in the unit (fix round 2, N1b): `./a.jpg?w=64&image`, `?w=1200&image` and `?jsx` are other values.
      if (inApp || sourcePackage(file) !== null) map[spec] = moduleId(file) + (query ? "?" + query : "");
    }
    resolvedImports.set(filename, map);
    resolvedFiles.set(filename, files);
  };
  /** Derived model: walk the resume module graph from `resume.modules` (facts with `boundaries`), close the boundary facts
   * over it (`boundaryFacts`; route modules' default exports are independent roots) and keep each module's verdicts. */
  const derivedWalk = async (ctx: Rollup.PluginContext): Promise<void> => {
    const facts = new Map<string, ModuleFacts>(),
      graph = new Map<string, Map<string, string>>(),
      roots = new Set<string>();
    const pending = [...resumable];
    for (let filename; (filename = pending.shift());) {
      if (facts.has(filename)) continue;
      const source = prepared(filename, await sourceOf(ctx, filename));
      const route = isRoute(filename);
      const f = moduleFacts(source, filename, route ? { serverExports: true, resume: true, boundaries: true } : { boundaries: true });
      facts.set(filename, f);
      if (route || isDerivedRoot(filename)) roots.add(filename);
      const map = new Map<string, string>();
      for (const spec of new Set([...f.statics, ...f.dynamics])) {
        const hit = await resolveFact(ctx, spec, filename);
        const file = hit && !hit.external ? hit.id.split("?")[0]! : null;
        if (!file || !isResumable(file)) continue;
        map.set(spec, file);
        if (!resumable.has(file)) (resumable.add(file), pending.push(file));
      }
      graph.set(filename, map);
    }
    const verdicts = boundaryFacts(facts, graph, roots);
    derivedVerdicts.clear();
    for (const file of facts.keys()) derivedVerdicts.set(file, { boundaries: verdicts.boundaries(file), independent: verdicts.independent(file) });
  };
  /** Derived model manifest (`.vite/rivet-resume.json`): `model`, `runtime` (the derived entry chunk), `symbols` (boundary
   * name → the chunk of its module), `sizes` (those chunks' bytes), `builtins` (the built-in decoders' chunk: the server
   * names it in a route payload that needs it, `_rData`). */
  function derivedManifest(this: Rollup.PluginContext, bundle: Rollup.OutputBundle): void {
    const symbols: Record<string, string> = {},
      sizes: Record<string, number> = {};
    let runtime: string | null = null,
      builtins: string | null = null;
    for (const output of Object.values(bundle)) {
      if (output.type !== "chunk" || !output.facadeModuleId) continue;
      if (output.facadeModuleId === DERIVED_ENTRY) runtime = base + output.fileName;
      if (output.facadeModuleId === builtinsId) builtins = base + output.fileName;
      const names = output.isEntry && derivedVerdicts.get(output.facadeModuleId)?.boundaries.length ? derivedNames.get(output.facadeModuleId) : undefined;
      if (!names?.length) continue;
      sizes[base + output.fileName] = Buffer.byteLength(output.code);
      for (const name of names) symbols[name] = base + output.fileName;
    }
    const body = { model: "derived", runtime, symbols, sizes, ...(builtins ? { builtins } : {}) };
    const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
    this.emitFile({ type: "asset", fileName: MANIFEST, source: JSON.stringify({ hash, ...body }, null, 2) + "\n" });
  }
  const warned = new Set<string>();
  // Compile + dev bookkeeping of one transformed `.tsx` / `.jsx` module (after `resolveImports` for resume modules).
  const finish = (ctx: Rollup.TransformPluginContext, filename: string, source: string, server: boolean, id: string) => {
    const result = compile(source, moduleOptions(filename, source, server, id));
    if (result.diagnostics.length) fail(ctx, result, filename);
    // T10 fix 2: compiler warnings (`[rivet:compiler] RVnnnn …` + location, frame, fix, docs), once per site and message
    // across targets / rebuilds; the module still compiles.
    for (const w of result.warnings ?? []) {
      const key = `${w.filename}\0${w.line ?? 0}:${w.column ?? 0}\0${w.message}`;
      if (warned.has(key)) continue;
      warned.add(key);
      ctx.warn(formatDiagnostic({ origin: "compiler", code: w.code, message: w.message, file: filename, line: w.line, column: w.column }, { root }));
    }
    // Dev SSR of a resume module: its symbols back the dev manifest and error descriptions.
    if (serve && server && isResumable(abs(filename))) {
      const module = moduleId(filename);
      // Fix L2: an id other modules also define (a shared module reference) stays while any of them still lists it.
      for (const id of devModules.get(module) ?? []) devSymbols.drop(id, filename);
      const symbols = result.symbols ?? [];
      for (const symbol of symbols) devSymbols.define(symbol.id, { file: filename, source, symbol });
      devModules.set(
        module,
        symbols.map((symbol) => symbol.id),
      );
    }
    // Derived model dev server: boundary names → their module (dev manifest `symbols`).
    if (serve && derivedModel) for (const name of result.boundaries ?? []) derivedDev.set(name, filename);
    if (derivedModel && !server) derivedNames.set(filename, result.boundaries ?? []);
    // DevTools (dev client only): signals / computeds named after their bindings.
    const named = tools && serve && !server ? tools.nameSignals(result.code, result.map) : null;
    let code = named?.code ?? result.code;
    const map = named ? named.map : (result.map ?? null);
    if (result.css !== undefined) {
      const collision = registry.add(moduleId(filename), Object.assign({}, ...Object.values(result.cssClasses ?? {})));
      if (collision) ctx.error({ message: collision, id: filename });
      sheets.set(filename, result.css);
      if (serve && !server) clientCode.set(filename, result.code);
      // Appended: imports hoist, and the module's own sheet follows its children's (parent wins).
      code += `\nimport ${JSON.stringify(filename + _STYLE_SUFFIX)};\n`;
    } else sheets.delete(filename);
    // Resume modules hot-replace too; the locals they export for dev symbol chunks are no update reason.
    const locals = serve && !server && result.symbols ? new Set(result.symbols.flatMap((symbol) => symbol.locals)) : undefined;
    const hot = serve && !server ? hotModule(code, moduleId(filename), source, locals) : null;
    // Dev client: where each component is declared, for dev warnings (`<Card> (src/card.tsx:12:17)`).
    const stamps = serve && !server ? sourceStamps(source, displayPath(filename, root), hot ?? code) : "";
    return { code: (hot ?? code) + stamps, map };
  };
  /** Resume options of a resume module: symbol id prefix, the source packages it imports and its resolved imports. */
  const resumeOptions = (filename: string, source: string): Partial<CompileOptions> => {
    const sourcePackages = sourcePackagesOf(filename, source);
    const resolved = resolvedImports.get(filename);
    // Derived model: the build's verdicts for this module (absent in dev: the compiler's module-local closure).
    let verdict: { boundaries?: string[]; independent: string[] } | undefined = derivedModel ? derivedVerdicts.get(filename) : undefined;
    // Dev (no build walk): a `resume.roots` module's default export is independent all the same.
    if (derivedModel && !verdict && isDerivedRoot(filename)) verdict = { independent: [moduleFacts(source, filename).defaultName ?? "default"] };
    return {
      resume: derivedModel ? { module: moduleId(filename), model: "derived", ...verdict } : { module: moduleId(filename) },
      ...(sourcePackages.length ? { sourcePackages } : {}),
      ...(resolved && Object.keys(resolved).length ? { resolvedImports: resolved } : {}),
    };
  };
  const isResumable = (filename: string): boolean =>
    filename.startsWith("\0")
      ? !!resume && virtual(filename)
      : !bridges?.owner(filename) &&
        (resumable.has(filename) ||
          (!!resume &&
            /\.[jt]sx$/.test(filename) &&
            (sourcePackage(filename) !== null ||
              (!!resume.appModules && !/[/\\]node_modules[/\\]/.test(filename) && !relative(root, filename).startsWith("..") && appModule(filename)))));
  const moduleId = (filename: string) => {
    if (filename.startsWith("\0")) return bridges?.module(filename) ?? filename.slice(1);
    const pkg = sourcePackage(filename);
    return pkg ? pkg.name + "/" + posix(relative(pkg.dir, filename)) : posix(relative(root, filename));
  };
  /** Dev URL of a module: root-relative inside the Vite root, else `/@fs/<absolute>` (source packages). */
  const devUrl = (filename: string): string => {
    // Virtual modules: Vite's `/@id/__x00__<id>` form.
    if (filename.startsWith("\0")) return "@id/__x00__" + filename.slice(1);
    const local = posix(relative(root, filename));
    return local.startsWith("../") ? "@fs" + posix(filename) : local;
  };
  // Framework source (Rivet packages outside their tests, linked from the workspace): one instance per page.
  const frameworkSource = (file: string): boolean =>
    /\.[cm]?[jt]sx?$/.test(file) && !/[/\\]node_modules[/\\]/.test(file) && existsSync(file) && !appModule(file);
  /** Dev: a re-export of the plain URL for a `?t=`-busted request of a framework module, else null. */
  const frameworkFacade = (url: string, prefix: string): string | null => {
    const [path = "", query = ""] = url.split("?", 2);
    const params = new URLSearchParams(query);
    if (!params.has("t") || [...params.keys()].some((key) => key !== "t")) return null;
    const local = path.startsWith(prefix) ? "/" + path.slice(prefix.length) : path;
    let file: string;
    try {
      file = decodeURIComponent(local.startsWith("/@fs/") ? local.slice(4) : join(root, local));
    } catch {
      return null;
    }
    if (!frameworkSource(file)) return null;
    const plain = JSON.stringify(path);
    const source = readFileSync(file, "utf8");
    return `export * from ${plain};\n` + (/^\s*export\s+default\b|\bas\s+default\b/m.test(source) ? `export { default } from ${plain};\n` : "");
  };
  // css``: extracted CSS and last client code per module (CSS-only hot updates), build-wide names.
  const sheets = new Map<string, string>();
  const clientCode = new Map<string, string>();
  const registry = nameRegistry();
  const classNames = (): ClassNames => cssOptions.names ?? (serve ? "readable" : "short");
  const stylesFor = (filename: string, source: string): Partial<CompileOptions> =>
    source.includes("@rivetjs/runtime/css")
      ? { styles: { scope: moduleId(filename), names: classNames(), layer: cssOptions.layer === undefined ? "components" : cssOptions.layer } }
      : {};
  const sheetText = (css: string) => {
    const layers = cssOptions.layers === undefined ? DEFAULT_LAYERS : cssOptions.layers;
    const reference = cssOptions.reference ? `@reference ${JSON.stringify(resolve(root, cssOptions.reference))};\n` : "";
    return reference + (layers && cssOptions.layer !== false ? `@layer ${layers};\n` : "") + css + "\n";
  };
  /** Compile options of an app module (`transform` and the css`` `hotUpdate` share them, D9). */
  const moduleOptions = (filename: string, source: string, server: boolean, id = filename): CompileOptions => ({
    ...contributed(server, id),
    ...stylesFor(filename, source),
    ...split(filename),
    target: server ? "server" : "dom",
    filename,
    // Dev client: resume mode only for dev resume (its chunks import the module's locals).
    ...(isResumable(abs(filename)) && (!serve || server || resume?.dev) ? resumeOptions(filename, source) : {}),
    ...(sourceMap ? { sourceMap: true } : {}),
  });
  // Every diagnostic: `[RVnnnn] file:line:col: message` + its `fix:` / `docs:` lines (`diagnostics-format.ts`); the first
  // one's code / docs URL / location / code frame go to the overlay (`frame` set here: Vite's dev context returns an error
  // carrying `pluginCode` unchanged, so it would add neither the frame nor the plugin name), later ones carry their frame
  // in the message. Frames show the file on disk (compiled text may be `prepared`: static icons inlined).
  const fail = (ctx: { error(e: Rollup.RollupError | string): never }, result: CompileResult, filename: string): never => {
    const first = result.diagnostics[0]!;
    let text: string | undefined;
    const frameOf = (line: number | undefined, column: number | undefined): string => {
      if (!line) return "";
      if (text === undefined)
        try {
          text = readFileSync(filename, "utf8");
        } catch {
          text = "";
        }
      return codeFrame(text, line, column ?? 1);
    };
    const frame = frameOf(first.line, first.column);
    return ctx.error({
      message: result.diagnostics
        .map((d, i) => {
          const extra = i > 0 && d.filename === filename ? frameOf(d.line, d.column) : "";
          return `[${d.code}] ${d.filename}:${d.line ?? 1}:${d.column ?? 1}: ${d.message}${extra ? "\n" + extra : ""}${remedyLines(d.code, undefined, undefined, root)}`;
        })
        .join("\n"),
      id: filename,
      plugin: "vite-plugin-rivet",
      pluginCode: first.code,
      url: docsUrl(first.code),
      ...(first.line ? { loc: { file: filename, line: first.line, column: (first.column ?? 1) - 1 } } : {}),
      ...(frame ? { frame } : {}),
    });
  };
  return {
    name: "vite-plugin-rivet",
    enforce: "pre",
    api: {
      /** Scripts a dev page loads before `@vite/client`: the DevTools agent when enabled. */
      devtoolsScripts: (): string[] => (tools ? [tools.agentScript(base)] : []),
      /** Dev server: resume manifest and symbol descriptions for dev SSR (see `DevResume`). */
      devResume,
      /** `rivet({ serverOnly })`: modules browser code must never import (read by `rivetRouter()`). */
      rivetServerOnly: serverOnly,
    },
    async configureServer(server: ViteDevServer) {
      // Server-side dev warnings (cdk, runtime `DEV.locate()`) name the app code that triggered them: the first app frames
      // of the current stack, source-mapped (`globalThis[Symbol.for("rivet.locate")]`; the browser twin is runtime dev/where.ts).
      // V8 keeps 10 frames by default: a ui → cdk → runtime chain uses them up before the first app frame, so the probe
      // alone asks for 60. The last started server owns the global; closing it removes only its own.
      const LOCATE = Symbol.for("rivet.locate");
      const store = globalThis as { [key: symbol]: unknown };
      const locate = (): string => {
        const limit = Error.stackTraceLimit;
        Error.stackTraceLimit = 60;
        const probe = new Error();
        Error.stackTraceLimit = limit;
        try {
          server.ssrFixStacktrace(probe);
        } catch {
          // Unmapped frames still name the file.
        }
        return appFrames(probe.stack ?? "", root);
      };
      store[LOCATE] = locate;
      // Also middleware-mode servers (no `httpServer`): the hook goes with `server.close()` (restarts included).
      const close = server.close.bind(server);
      server.close = () => {
        if (store[LOCATE] === locate) delete store[LOCATE];
        return close();
      };
      // One browser instance per framework module (E16): a cache-busted URL (`?t=`) re-exports the plain one.
      server.middlewares.use((req, res, next) => {
        const facade = req.url && req.method === "GET" ? frameworkFacade(req.url, server.config.base) : null;
        if (!facade) return next();
        res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-cache" });
        res.end(facade);
      });
      if (!devtools) return;
      tools = await import("@rivetjs/devtools/server").catch(() => null);
      if (tools) server.middlewares.use(tools.uiMiddleware(server.config.base));
    },
    transformIndexHtml: {
      order: "pre",
      handler(): HtmlTagDescriptor[] {
        if (!tools) return [];
        return [{ tag: "script", attrs: { type: "module", src: tools.agentScript(base) }, injectTo: "head-prepend" }];
      },
    },
    config(config, env) {
      // Installed `@rivetjs/*` packages hold `.jsx` the Rivet compiler must see: the server build bundles them
      // (Node cannot load an externalized `.jsx`) and dev never pre-bundles them (esbuild would compile their
      // JSX as React). Workspace-linked packages already behave this way (not under node_modules).
      const packages: UserConfig = { ssr: { noExternal: [/^@rivetjs\//] }, optimizeDeps: { exclude: [...RIVET_PACKAGES] } };
      if (cssOptions.modules === false || config.css?.modules === false || config.css?.modules?.generateScopedName) return packages;
      const names = cssOptions.names ?? (env.command === "serve" ? "readable" : "short");
      return {
        ...packages,
        css: {
          modules: {
            generateScopedName: (local: string, filename: string) => scopedName(posix(relative(root, filename.split("?")[0]!)), local, names),
          },
        },
      };
    },
    configResolved(config) {
      ssrBuild = Boolean(config.build?.ssr);
      serve = config.command === "serve";
      // Dev always maps (stack traces, debugger); builds when `build.sourcemap` asks for maps.
      sourceMap = serve || Boolean(config.build?.sourcemap);
      root = config.root ?? root;
      base = config.base ?? "/";
      routed = !!config.plugins?.some((plugin) => plugin.name === "vite-plugin-rivet-router");
      if (patterns.include != null || patterns.exclude != null) selected = createFilter(patterns.include, patterns.exclude, { resolve: root });
      if (resume?.model !== undefined && resume.model !== "serialized" && resume.model !== "derived")
        throw new Error(`rivet({ resume }): resume.model must be "serialized" or "derived" (got ${JSON.stringify(resume.model)})`);
      resumable.clear();
      for (const path of resume?.modules ?? []) resumable.add(resolve(root, path));
      // Apps with a Vite config file always get a manifest (its presence = config evaluated, T1);
      // inline configs (tests, programmatic builds) only when resuming, as before.
      if (resume || config.configFile) writeEditorManifest(root, resume);
      bridges = null;
      for (const plugin of config.plugins ?? []) bridges ??= (plugin as { api?: { rivetBridges?: RivetBridgesApi } }).api?.rivetBridges ?? null;
      contributors = (config.plugins ?? []).flatMap((plugin) => {
        const api = (plugin as { api?: { rivetCompileOptions?: (server: boolean, id?: string) => Partial<CompileOptions> } }).api;
        return api?.rivetCompileOptions ? [api.rivetCompileOptions.bind(api)] : [];
      });
    },
    async buildStart() {
      // Compiler ↔ runtime ABI handshake (abi.ts), once per plugin instance: the app's resolved runtime.
      if (!abiChecked) {
        abiChecked = true;
        const hit = await this.resolve("@rivetjs/runtime/server", join(root, "index.html"), { skipSelf: true });
        const runtime = hit && !hit.external ? runtimePackage(hit.id.split("?")[0]!) : undefined;
        const problem = runtime && runtimeAbiProblem(runtime);
        if (problem) this.error(problem);
      }
      if (resume && builtinsId === null) {
        const hit = await this.resolve("@rivetjs/runtime/resume-builtins", join(root, "index.html"), { skipSelf: true });
        builtinsId = hit && !hit.external ? hit.id.split("?")[0]! : "";
        const module = await this.resolve("@rivetjs/runtime/resume-loader-module", join(root, "index.html"), { skipSelf: true });
        loaderId = module && !module.external ? module.id.split("?")[0]! : "";
      }
      // Derived model (M2 C3): verdicts in every build environment (server + client compile with the same boundaries), then
      // the client build emits one chunk per module holding boundaries (its exports = the boundaries' components) and the
      // runtime entry + the built-in decoders (`builtins`: route payloads with RegExp / binary / errors / registered classes,
      // DERIVED-S); no symbol chunks or loader module (the derived loader is inline).
      if (resume && derivedModel) {
        if (serve) return;
        await derivedWalk(this);
        if (ssrBuild || this.environment?.config?.consumer === "server") return;
        for (const [file, verdict] of derivedVerdicts) if (verdict.boundaries.length) this.emitFile({ type: "chunk", id: file, preserveSignature: "strict" });
        this.emitFile({ type: "chunk", id: DERIVED_ENTRY, name: "derived-runtime", preserveSignature: "strict" });
        if (builtinsId) this.emitFile({ type: "chunk", id: builtinsId, name: "resume-builtins", preserveSignature: "strict" });
        return;
      }
      // Dev renders without resumability: symbol chunks and the manifest exist only in client builds.
      if (!resume || serve || ssrBuild || this.environment?.config?.consumer === "server") return;
      chunks.clear();
      placed.clear();
      parts.clear();
      routePreload.clear();
      lateFiles.clear();
      const strategy = chunkStrategy();
      if (!["component", "group", "route"].includes(strategy)) this.error('resume.chunks must be "component", "group" or "route"');
      if (resume.merge !== undefined && resume.merge !== false && !(typeof resume.merge === "number" && resume.merge >= 0))
        this.error("resume.merge must be a byte budget (a number ≥ 0) or false");
      if (resume.cap !== undefined && !(Number.isInteger(resume.cap) && resume.cap >= 1)) this.error("resume.cap must be an integer ≥ 1");
      for (const rule of resume.preload?.rules ?? [])
        if (rule.chunk !== undefined && !/^[\w-]+$/.test(rule.chunk))
          this.error(`resume.preload.rules: chunk must be a word (letters, digits, _, -): ${JSON.stringify(rule.chunk)}`);
      const compiled = new Map<string, CompileResult>(),
        facts = new Map<string, ModuleFacts>(),
        resolved = new Map<string, Map<string, string>>(),
        through = new Map<string, Set<string>>(),
        leafMemo = new Map<string, string[]>();
      // Listed modules, then source-package .tsx modules they (transitively) import.
      const pending = [...resumable];
      for (let filename; (filename = pending.shift());) {
        const source = prepared(filename, await sourceOf(this, filename));
        await resolveImports(this, filename, source);
        const result = compile(source, { ...contributed(false), ...split(filename), target: "dom", filename, ...resumeOptions(filename, source) });
        if (result.diagnostics.length) fail(this, result, filename);
        compiled.set(filename, result);
        const f = isRoute(filename) ? moduleFacts(source, filename, { serverExports: true, resume: true }) : moduleFacts(source, filename);
        facts.set(filename, f);
        // Resolve the module's specifiers to resumable modules (the grouping graph). Facts list
        // type-only imports too: `_factsResolve` tells import guards (server-only) this is no import.
        const map = new Map<string, string>();
        for (const spec of new Set([...f.statics, ...f.dynamics])) {
          const hit = await resolveFact(this, spec, filename);
          const file = hit && !hit.external ? hit.id.split("?")[0]! : null;
          if (!file) continue;
          // A `.ts`/`.js` barrel of a source package: its `.tsx` leaves are resume modules too.
          if (resume && !/\.[jt]sx$/.test(file) && sourcePackage(file) !== null)
            for (const leaf of barrelLeaves(file)) if (!resumable.has(leaf)) (resumable.add(leaf), pending.push(leaf));
          // `chunks: "route"`: the leaves behind the names this module imports from a `.ts` barrel are reached through
          // it (a route importing `{ Select }` from a component library reaches the select modules, not the library).
          if (strategy === "route" && !/\.[jt]sx$/.test(file) && !isResumable(file)) {
            const names = [...f.imports.values()].filter((binding) => binding.from === spec).map((binding) => binding.imported);
            for (const leaf of names.flatMap((name) => (name === "*" ? barrelLeaves(file) : exportLeaves(file, name, leafMemo))))
              if (isResumable(leaf)) {
                let set = through.get(filename);
                if (!set) through.set(filename, (set = new Set()));
                set.add(leaf);
                if (!resumable.has(leaf)) (resumable.add(leaf), pending.push(leaf));
              }
          }
          if (!isResumable(file)) continue;
          map.set(spec, file);
          if (!resumable.has(file)) (resumable.add(file), pending.push(file));
          // An island facade renders through the bridge's server modules (the client graph resolves its DOM variant).
          if (virtual(file)) for (const seed of bridges!.seeds()) if (!resumable.has(seed)) (resumable.add(seed), pending.push(seed));
        }
        resolved.set(filename, map);
      }
      // `lateFiles` is filled below, before the first route key is read (the shell walk is lazy).
      const groups = groupComponents(facts, resolved, through, (file) => lateFiles.has(file));
      // Route keys: `route:<root>` (one route), `route:main` (no route); a module several routes reach is placed (above).
      const routeKey = (filename: string) => {
        const key = groups.route(filename);
        return key.startsWith("route:shared:") ? "route:placed:" + filename : key;
      };
      // Function Bridge T3 (fix H2, round 2 N3): module references, one symbol per canonical id. An import reference (a
      // value of a module that does not stamp it itself) gets one chunk per id, importing only that value from its
      // specifier, so a page needing it never loads another component's chunk or module graph. An own reference (the
      // module's own function) used by ONE component's chunk lives in that chunk (the module code is there already: the
      // router app module stays in `resume-App`); used by components of several chunks, or imported by another module, it
      // gets its own per-id chunk too (importing only that binding from its module). An import of a resume module's own
      // reference is that module's symbol.
      // Every chunk of routes reached by several routes is one sibling group (a page's shared chunks prefetch together).
      const routeSibling = (key: string) => (key.startsWith("route:shared:") ? "route:shared" : key);
      // Route chunks split by load class (DOCS-JS): a module whose every symbol loads on intent / interaction (its
      // component-level preload, else the first matching `preload.rules` rule) goes to the route's intent chunk
      // (`route:<key>:intent`, same sibling group), the others stay in the route chunk. A route chunk is evaluated with
      // its whole static closure as soon as one symbol is needed (a page's idle effect, a boot-time listener): without
      // the split, a docs page booted the cdk menu + collections (~400 KB) of its frame controls for a keyboard shortcut.
      // File level: one part per module (parts are keyed by file).
      const ruleFor = (id: string) => resume.preload?.rules?.find(({ match }) => (typeof match === "string" ? id.startsWith(match) : match.test(id)));
      const componentPreload = (filename: string, symbol: ResumeSymbol): string | null => {
        const group = groups.group(filename, symbol.component);
        return groups.modulePreload(filename) ?? (group && groups.groupPreload(group));
      };
      if (strategy === "route")
        for (const [filename, result] of compiled) {
          const own = (result.symbols ?? []).filter((symbol) => symbol.kind !== "ref" || symbol.id.startsWith(moduleId(filename) + "#"));
          if (!own.length || !own.every((symbol) => /^(intent|interaction)$/.test(componentPreload(filename, symbol) ?? ruleFor(symbol.id)?.strategy ?? "")))
            continue;
          // A rule's `chunk` (DOCS-COLD): the file's own late chunk when every symbol's rule names it (the router app module
          // on link intent, apart from the frame menus).
          const names = new Set(own.map((symbol) => (componentPreload(filename, symbol) ? undefined : ruleFor(symbol.id)?.chunk)));
          const [name] = names;
          lateFiles.set(filename, names.size === 1 && name ? "intent:" + name : "intent");
        }
      const routeChunkKey = (filename: string) => {
        const key = routeKey(filename);
        return lateFiles.has(filename) && !key.startsWith("route:placed:") ? key + ":" + lateFiles.get(filename) : key;
      };
      /** Emitted name of a route chunk key: `resume-<label>`, `-intent` / `-<chunk>` for its late chunks. */
      const routeLabel = (key: string) => {
        const late = /:intent(?::([\w-]+))?$/.exec(key);
        return (
          key
            .slice(0, late ? late.index : key.length)
            .replace(/^.*[#/]/, "")
            .replace(/[^\w-]/g, "_") + (late ? "-" + (late[1] ?? "intent") : "")
        );
      };
      const chunkKey = (filename: string, component: string) => {
        const group = groups.group(filename, component);
        return strategy === "group" && group ? group : strategy === "route" ? routeChunkKey(filename) : filename + "?" + component;
      };
      // Fix round 3, G2: one import reference id must name one file. Two importers whose specifier resolves to different
      // files (two installed copies of a package: an eager route and a lazy one, nested node_modules) would share the id,
      // and the one chunk would resume every page with the first copy's value — a build error naming both (RV2010).
      // Fix round 4, L4: two paths of one real file (symlinks under `resolve.preserveSymlinks`) are one file.
      const refFiles = new Map<string, { file: string; importer: string }>();
      const real = (file: string): string => {
        try {
          return realpathSync.native(file);
        } catch {
          return file;
        }
      };
      for (const [filename, result] of compiled)
        for (const symbol of result.symbols ?? []) {
          if (symbol.kind !== "ref" || symbol.id.startsWith(moduleId(filename) + "#")) continue;
          const spec = symbol.imports[0]?.from;
          const file = spec === undefined ? undefined : resolvedFiles.get(filename)?.[spec];
          if (!file) continue;
          const known = refFiles.get(symbol.id);
          if (!known) refFiles.set(symbol.id, { file, importer: filename });
          else if (known.file !== file && real(known.file) !== real(file))
            this.error({
              message:
                "[RV2010] Cannot resume: module reference " +
                symbol.id +
                " names two different files — " +
                relative(root, known.file) +
                " (imported by " +
                moduleId(known.importer) +
                ") and " +
                relative(root, file) +
                " (imported by " +
                moduleId(filename) +
                "); two installed copies of one package share the id: dedupe the package so every importer loads one copy (`npm dedupe` / `pnpm dedupe`, or Vite `resolve.dedupe: [" +
                JSON.stringify(spec!.split("/", spec!.startsWith("@") ? 2 : 1).join("/")) +
                "]`)\n  docs: " +
                docsUrl("RV2010"),
              plugin: "vite-plugin-rivet",
              pluginCode: "RV2010",
              url: docsUrl("RV2010"),
            });
        }
      const ownRefs = new Set<string>();
      for (const [filename, result] of compiled)
        for (const symbol of result.symbols ?? []) if (symbol.kind === "ref" && symbol.id.startsWith(moduleId(filename) + "#")) ownRefs.add(symbol.id);
      // Fix round 3, L2: a value its module exports under several names has one own id (the smallest name; the others are
      // `aliases`). An importer of an alias stamps `<unit>#<alias>…` too, but the own stamp wins on the server: the alias
      // gets no chunk, and the own reference counts as imported by another module (shared).
      const aliasOwners = new Map<string, string>(); // "<unit>\0<alias>" → own id
      for (const [filename, result] of compiled)
        for (const symbol of result.symbols ?? [])
          if (symbol.kind === "ref" && symbol.id.startsWith(moduleId(filename) + "#"))
            for (const alias of symbol.aliases ?? []) aliasOwners.set(moduleId(filename) + "\0" + alias, symbol.id);
      const aliasOf = new Map<string, string>(); // import reference id → own id
      if (aliasOwners.size)
        for (const [filename, result] of compiled)
          for (const symbol of result.symbols ?? []) {
            const imported = symbol.imports[0]?.imported;
            if (symbol.kind !== "ref" || imported === undefined || symbol.id.startsWith(moduleId(filename) + "#")) continue;
            const owner = aliasOwners.get(symbol.id.slice(0, symbol.id.lastIndexOf("#")) + "\0" + imported);
            if (owner) aliasOf.set(symbol.id, owner);
          }
      const shared = new Set(aliasOf.values());
      for (const [filename, result] of compiled)
        for (const symbol of result.symbols ?? []) {
          if (symbol.kind !== "ref" || !ownRefs.has(symbol.id)) continue;
          const own = symbol.id.startsWith(moduleId(filename) + "#");
          if (!own || new Set((symbol.uses ?? [symbol.component]).map((component) => chunkKey(filename, component))).size > 1) shared.add(symbol.id);
        }
      const refChunk = (filename: string, symbol: ResumeSymbol) => {
        const id = CHUNK + "ref:" + symbol.id;
        if (chunks.has(id)) return;
        chunks.set(id, { parts: new Map([[filename, [symbol]]]), symbols: [symbol], preload: null, sibling: "" });
        this.emitFile({
          type: "chunk",
          id,
          name:
            "resume-ref-" +
            symbol.name
              .replace(/\$[^$]*\$ref$/, "")
              .replace(/\$l$/, "")
              .replace(/[^\w-]/g, "_"),
          preserveSignature: "strict",
        });
      };
      for (const [filename, result] of compiled)
        for (const symbol of result.symbols ?? []) {
          if (symbol.kind === "ref") {
            const own = symbol.id.startsWith(moduleId(filename) + "#");
            if (aliasOf.has(symbol.id)) continue;
            if (!ownRefs.has(symbol.id)) {
              refChunk(filename, symbol);
              continue;
            }
            if (!own) continue;
            if (shared.has(symbol.id)) {
              refChunk(filename, symbol);
              continue;
            }
          }
          const group = groups.group(filename, symbol.component);
          const key = chunkKey(filename, symbol.component);
          if (strategy === "route") {
            const preload = componentPreload(filename, symbol);
            if (preload) routePreload.set(symbol.id, preload);
          }
          if (key.startsWith("route:placed:")) {
            let entry = placed.get(filename);
            if (!entry) placed.set(filename, (entry = { symbols: [], preload: groups.modulePreload(filename), late: lateFiles.get(filename) ?? false }));
            entry.symbols.push(symbol);
            continue;
          }
          const id = CHUNK + key;
          let chunk = chunks.get(id);
          if (!chunk) {
            const label = strategy === "component" || (strategy === "group" && !group) ? symbol.component : routeLabel(key);
            // A rule-named late chunk (`:intent:<chunk>`) is a group of its own: another trigger than its route (using the
            // route's chunks does not prefetch it).
            const sibling = group ?? (/:intent:[\w-]+$/.test(key) ? key : routeSibling(routeKey(filename)));
            chunks.set(id, (chunk = { parts: new Map(), symbols: [], preload: null, sibling }));
            this.emitFile({ type: "chunk", id, name: "resume-" + label, preserveSignature: "strict" });
          }
          let list = chunk.parts.get(filename);
          if (!list) chunk.parts.set(filename, (list = []));
          list.push(symbol);
          chunk.symbols.push(symbol);
          // Component-level preload: the module's `export const preload`, else its ChunkGroup's `preload` prop (route
          // chunks: per symbol, `routePreload`).
          if (strategy !== "route") chunk.preload ??= groups.modulePreload(filename) ?? (group && groups.groupPreload(group));
        }
      // Every route reaching a placed module imports its part (a route without symbols of its own gets an empty chunk
      // of imports): the part is placed by the routes using it, and never dropped as unreferenced.
      // A late (intent-class) placed module is imported by the routes' intent chunks; the shell imports it from
      // `route:main:intent` when it reaches the module only through late files (`MAIN_LATE_ROOT`).
      for (const [filename, entry] of placed) {
        parts.set(PART + filename, { file: filename, symbols: entry.symbols });
        for (const root of groups.roots(filename) ?? []) {
          const late = entry.late || (root === MAIN_LATE_ROOT ? "intent" : false),
            route = root === MAIN_LATE_ROOT ? MAIN_ROOT : root;
          const id = CHUNK + "route:" + route + (late ? ":" + late : "");
          let chunk = chunks.get(id);
          if (!chunk) {
            chunks.set(
              id,
              (chunk = { parts: new Map(), symbols: [], preload: null, sibling: late && late !== "intent" ? id.slice(CHUNK.length) : "route:" + route }),
            );
            this.emitFile({
              type: "chunk",
              id,
              name: "resume-" + routeLabel("route:" + route + (late ? ":" + late : "")),
              preserveSignature: "strict",
            });
          }
          (chunk.shared ??= []).push(filename);
        }
      }
      this.emitFile({ type: "chunk", id: resume.entry ? resolve(root, resume.entry) : ENTRY, name: "resume-entry", preserveSignature: "strict" });
      if (builtinsId) this.emitFile({ type: "chunk", id: builtinsId, name: "resume-builtins", preserveSignature: "strict" });
      if (loaderId) this.emitFile({ type: "chunk", id: loaderId, name: "resume-loader", preserveSignature: "strict" });
    },
    resolveId(id, importer) {
      // `<module>.rivet.css`: absolute (our imports) or root-relative (dev URLs).
      const [clean = "", query] = id.split("?", 2);
      if (clean.endsWith(_STYLE_SUFFIX)) {
        const file = clean.slice(0, -_STYLE_SUFFIX.length);
        const absolute = existsSync(file) ? file : resolve(root, "." + file);
        return existsSync(absolute) ? absolute + _STYLE_SUFFIX + (query ? "?" + query : "") : null;
      }
      // Dev client: app modules get the state-restoring `signal` (hot replacement keeps state).
      if (id === "@rivetjs/reactivity" && serve && importer && this.environment?.config?.consumer !== "server" && appModule(importer.split("?")[0]!))
        return this.resolve("@rivetjs/runtime/hot-reactivity", importer, { skipSelf: true });
      if (id === ENTRY || id === DERIVED_ENTRY || id === DERIVED_SERVER || id.startsWith(CHUNK) || id.startsWith(PART)) return id;
      // Derived build, server: the router renders through the derived renderer (`DERIVED_SERVER`).
      if (
        derivedModel &&
        id === "@rivetjs/runtime/server-resume" &&
        importer &&
        ROUTER_MODULE.test(importer) &&
        (ssrBuild || this.environment?.config?.consumer === "server")
      )
        return DERIVED_SERVER;
      // `rivet({ serverOnly })` without the router: a browser import of one fails the build (the compiler's own fact
      // resolutions excepted: type-only imports are listed too).
      if (
        serverOnly.length &&
        !routed &&
        importer &&
        this.environment?.config?.consumer !== "server" &&
        !_factsResolve(id, importer) &&
        matchesServerOnly(serverOnly, id)
      )
        this.error({
          message: `${id} is server-only (rivet({ serverOnly })) and cannot be imported by browser code (imported from ${displayPath(importer.split("?")[0]!, root)})`,
          id: importer,
          plugin: "vite-plugin-rivet",
        });
      // Symbol bodies keep their source specifiers (e.g. `import("./analytics.js")` in an effect):
      // resolve relative ones against the module they came from.
      if (importer && /^\.\.?\//.test(id)) {
        const own = chunks.get(importer);
        const from = parts.get(importer)?.file ?? (own?.parts.size === 1 ? [...own.parts.keys()][0]! : null);
        if (from) return this.resolve(id, from, { skipSelf: true });
      }
      return null;
    },
    async load(id) {
      const clean = id.split("?", 1)[0]!;
      // `resume.model: "derived"`: the browser runtime ships lazy rows + the `DERIVED` `_for` hook (server untouched).
      if (derivedModel && !ssrBuild && this.environment?.config?.consumer !== "server") {
        const code = derivedSwitch(clean);
        if (code !== null) return code;
      }
      if (id === DERIVED_ENTRY) return 'export { default } from "@rivetjs/runtime/dom-derived";\n';
      if (id === DERIVED_SERVER)
        return 'export * from "@rivetjs/runtime/server-resume";\nexport { renderDerived as renderResumable, derivedToString as resumableToString } from "@rivetjs/runtime/server-derived";\n';
      // `resume.lazyRows`: the lazy rows runtime is in (`LAZY_ROWS`); the resume manifest says so when the switch loaded.
      if (resume?.lazyRows) {
        const code = lazySwitch(clean);
        if (code !== null) {
          if (code.includes("_lazyRows") && this.environment?.config?.consumer !== "server") lazyRowsIn = true;
          return code;
        }
      }
      // `resume.domData`: the DOM data reader is in (`DOM_DATA`); the resume manifest says so when the switch loaded.
      if (resume?.domData) {
        const code = domDataSwitch(clean);
        if (code !== null) {
          if (code.includes("_domData") && this.environment?.config?.consumer !== "server") domDataIn = true;
          return code;
        }
      }
      // Dev symbol chunk of one component (`?rivet-chunk=<Component>`), like a production chunk.
      const component = serve && resume?.dev && id.includes("rivet-chunk=") ? new URLSearchParams(id.slice(clean.length + 1)).get("rivet-chunk") : null;
      if (component !== null && this.environment?.config?.consumer !== "server") {
        if (!isResumable(abs(clean))) this.error(`${moduleId(clean)} is not a resume module (resume.modules)`);
        const source = prepared(clean, await sourceOf(this, clean));
        if (!resolvedImports.has(clean)) await resolveImports(this, clean, source);
        const result = compile(source, { ...contributed(false, id), ...split(clean), target: "dom", filename: clean, ...resumeOptions(clean, source) });
        if (result.diagnostics.length) fail(this, result, clean);
        // `?rivet-chunk=<id>` (contains `#`): one module reference symbol (fix H2: never its component's chunk).
        const symbols = (result.symbols ?? []).filter((symbol) =>
          component.includes("#") ? symbol.id === component : symbol.kind !== "ref" && symbol.component === component,
        );
        // Self-accepting: an edit of its module reaches the page (which then client-renders) without a reload.
        return _compileSymbolModule(symbols, clean, contributed(false, id)) + "if (import.meta.hot) import.meta.hot.accept();\n";
      }
      if (clean.endsWith(_STYLE_SUFFIX)) {
        const file = clean.slice(0, -_STYLE_SUFFIX.length);
        let css = sheets.get(file);
        if (css === undefined) {
          // Requested before its module was transformed (e.g. a dev page reload).
          const source = prepared(file, await readFile(file, "utf8"));
          const result = compile(source, { ...contributed(false), ...stylesFor(file, source), ...split(file), target: "dom", filename: file });
          if (result.diagnostics.length) fail(this, result, file);
          sheets.set(file, (css = result.css ?? ""));
        }
        return sheetText(css);
      }
      if (id === ENTRY) return 'import { createResume } from "@rivetjs/runtime/dom-resume";\nexport default createResume({});\n';
      const part = parts.get(id);
      // Route mode parts register their symbols by module id (`_rSym`): a placed part's chunk exports are the bundler's.
      if (part)
        return (
          _compileSymbolModule(part.symbols, part.file, contributed(false)) +
          (chunkStrategy() === "route" ? registration(moduleId(part.file), part.symbols) : "")
        );
      const chunk = chunks.get(id);
      if (!chunk) return null;
      // Route chunks: side-effect imports of the route's own parts and the placed parts it reaches (one part per file).
      if (chunkStrategy() === "route" && id.startsWith(CHUNK + "route:")) {
        let source = "";
        for (const [file, symbols] of chunk.parts) {
          const partId = PART + file;
          parts.set(partId, { file, symbols });
          source += `import ${JSON.stringify(partId)};\n`;
        }
        for (const file of chunk.shared ?? []) source += `import ${JSON.stringify(PART + file)};\n`;
        return source;
      }
      if (chunk.parts.size === 1) {
        const [[file, symbols]] = chunk.parts as unknown as [[string, ResumeSymbol[]]];
        return _compileSymbolModule(symbols, file, contributed(false));
      }
      // Several modules: symbol names may repeat across them, so the runtime resolves ids through
      // __rivet(id) instead of reading exports by name.
      let source = "const parts = {};\n",
        n = 0;
      for (const [file, symbols] of chunk.parts) {
        const partId = PART + file + "?" + id.slice(CHUNK.length);
        parts.set(partId, { file, symbols });
        source += `import * as p${n} from ${JSON.stringify(partId)};\nparts[${JSON.stringify(moduleId(file))}] = p${n++};\n`;
      }
      return source + 'export const __rivet = (id) => parts[id.slice(0, id.indexOf("#"))][id.slice(id.indexOf("#") + 1)];\n';
    },
    // Shared chunk merging (`resume.merge`): the module graph is complete at buildEnd; outputOptions hands the
    // groups to Rolldown's codeSplitting (deps not pulled in: every module is placed by its own group or left alone).
    async buildEnd(error) {
      const budget = resume?.merge ?? MERGE_BUDGET;
      // Server builds (another environment of this plugin instance) leave the client's groups alone.
      // Derived builds keep the bundler's split (one chunk per boundary module; route-closure chunks are later work).
      if (budget === false || !resume || derivedModel || serve || ssrBuild || this.environment?.config?.consumer === "server") return;
      merged = new Map();
      if (error) return;
      const nodes: CoLoadModule[] = [];
      // Barrel links: what each importer uses behind the barrels it imports (the bundler links it there; the planner's
      // owner walk stops at large barrels — without them a leaf used only through a barrel is unowned and can land in an
      // entry chunk that imports the importer's merge chunk back: a chunk cycle, CHUNK-CYCLE 2026-10-20).
      const linkModules = new Map<string, LinkModule>();
      for (const id of this.getModuleIds()) {
        const info = this.getModuleInfo(id);
        if (info)
          linkModules.set(id, {
            id,
            code: info.code,
            importedIds: info.importedIds,
            exports: info.exports ?? [],
            barrel: info.code != null && isBarrel(info.code),
          });
      }
      const uses = await barrelUses(
        linkModules,
        (code) => parseAst(code) as unknown as { body: readonly unknown[] },
        async (spec, importer) => {
          const hit = await this.resolve(spec, importer);
          return hit && !hit.external ? hit.id : null;
        },
      );
      // coLoadGroups sorts by id: the bundler's module order does not change the groups or their names.
      for (const id of this.getModuleIds()) {
        const info = this.getModuleInfo(id);
        if (!info) continue;
        const own = info.isEntry || info.dynamicImporters.length > 0;
        nodes.push({
          id,
          size: info.code?.length ?? 0,
          imports: info.importedIds,
          ...(uses.has(id) ? { uses: uses.get(id)! } : {}),
          // Dynamic-import targets (lazy routes, islands, library `import()`) load on their own: owners too.
          entry: own,
          // Virtual modules, assets and worker / url / raw imports keep the bundler's placement.
          groupable:
            !own &&
            info.code != null &&
            // Virtual modules keep the bundler's placement, except our part modules and Vite's preload helper (a plain
            // function every chunk with a dynamic import imports: a request of its own on every page otherwise).
            (!id.startsWith("\0") || id.startsWith(PART) || id === VITE_PRELOAD_HELPER) &&
            // `.css` too: a stylesheet import is a (near-empty) module placed with its importer; left alone it stays a
            // request of its own once the importer merges away (ui `*.styles.ts` + `.css` pairs).
            /\.(?:[cm]?[jt]sx?|css)(\?|$)/.test(id) &&
            !/[?&](worker|sharedworker|url|raw)\b/.test(id),
          barrel: linkModules.get(id)!.barrel,
          // The app entry and the resume runtime load on every page: nothing merges into them.
          pinned: info.isEntry && !id.startsWith(CHUNK),
          // The main route chunk (the app shell every page loads: root layout, router, frame) with an intent sibling:
          // merging never moves intent-only modules into its closure. Lazy route chunks keep the budget's trade (strict
          // there took a cdk-docs example frame from 12 to 57 requests).
          ...(id === CHUNK + "route:main" && [...chunks.keys()].some((key) => key.startsWith(id + ":intent")) ? { strict: true } : {}),
          ...(lateFiles.has(id.startsWith(PART) ? id.slice(PART.length).split("?")[0]! : id.split("?")[0]!) ? { late: true } : {}),
        });
      }
      // `RIVET_MERGE_DUMP=<file>`: the merge input (modules, options) as JSON, to replay `coLoadGroups` offline
      // (`libs/compiler/spikes/merge-replay.ts`) while tuning the policy instead of rebuilding the site.
      if (process.env.RIVET_MERGE_DUMP) writeFileSync(process.env.RIVET_MERGE_DUMP, JSON.stringify({ budget, cap: resume.cap, nodes }));
      merged = coLoadGroups(nodes, { budget, cap: resume.cap });
    },
    // Rolldown reads output options before the build: the group's name function reads `merged` at chunking time.
    outputOptions(options) {
      if (!resume || resume.merge === false || derivedModel || serve || ssrBuild || this.environment?.config?.consumer === "server") return;
      return withMergeGroup(options, (id) => merged.get(id) ?? null);
    },
    // Post: chunk code is final (Vite's preload helpers rewritten), so sizes match the emitted files.
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        if (ssrBuild || this.environment?.config?.consumer === "server") return;
        hintEagerCompile(bundle, (output) => output.isEntry);
        if (!resume) return;
        if (derivedModel) return derivedManifest.call(this, bundle);
        if (resume.domData && !domDataIn)
          this.warn(
            "resume.domData: the build's resume runtime does not include the DOM data reader (@rivetjs/runtime dom-data-resume module not found): the manifest leaves domData out, servers write no DOM-backed entries",
          );
        if (resume.lazyRows && !lazyRowsIn)
          this.warn(
            "resume.lazyRows: the build's resume runtime does not include the lazy rows runtime (@rivetjs/runtime lazy-rows-resume module not found): the manifest leaves lazyRows out, servers write no lazy row records",
          );
        hintEagerCompile(
          bundle,
          (output) =>
            output.facadeModuleId === ENTRY || chunks.has(output.facadeModuleId!) || (!!resume.entry && output.facadeModuleId === resolve(root, resume.entry)),
        );
        const symbols: Record<string, string> = {},
          sizes: Record<string, number> = {},
          preload: Record<string, string> = {},
          siblings: Record<string, string> = {};
        const rules = resume.preload?.rules ?? [];
        let runtime: string | null = null,
          builtins: string | null = null,
          loader: string | null = null;
        for (const output of Object.values(bundle)) {
          if (output.type !== "chunk" || !output.facadeModuleId) continue;
          if (output.facadeModuleId === builtinsId) builtins = base + output.fileName;
          if (output.facadeModuleId === loaderId) loader = base + output.fileName;
          const chunk = chunks.get(output.facadeModuleId);
          if (chunk) {
            sizes[base + output.fileName] = Buffer.byteLength(output.code);
            if (chunk.sibling) siblings[base + output.fileName] = chunk.sibling.startsWith(root) ? posix(relative(root, chunk.sibling)) : chunk.sibling;
            for (const symbol of chunk.symbols) {
              symbols[symbol.id] = base + output.fileName;
              // Component-level preload wins; else the first matching app rule (string: symbol id prefix).
              const rule = rules.find(({ match }) => (typeof match === "string" ? symbol.id.startsWith(match) : match.test(symbol.id)));
              const strategy = chunk.preload ?? routePreload.get(symbol.id) ?? rule?.strategy;
              if (strategy) preload[symbol.id] = strategy;
            }
          }
          if (output.facadeModuleId === ENTRY || (resume.entry && output.facadeModuleId === resolve(root, resume.entry))) runtime = base + output.fileName;
        }
        // Placed parts (route mode): a shared module's symbols live in whichever chunk the bundler put its part in.
        const placedChunks = new Set<string>();
        if (placed.size) {
          const holder = new Map<string, Rollup.OutputChunk>();
          for (const output of Object.values(bundle))
            if (output.type === "chunk") for (const id of output.moduleIds) if (id.startsWith(PART)) holder.set(id, output);
          for (const [file, entry] of placed) {
            const output = holder.get(PART + file);
            if (!output) {
              const importers = [...chunks].filter(([, chunk]) => chunk.shared?.includes(file)).map(([id]) => id.slice(CHUNK.length));
              const emitted = Object.values(bundle).flatMap((o) =>
                o.type === "chunk" && o.facadeModuleId?.startsWith(CHUNK + "route:") ? [o.facadeModuleId.slice(CHUNK.length)] : [],
              );
              this.error(
                `resume: no chunk holds the symbols of ${moduleId(file)} (part imported by ${importers.length} route chunks: ${importers.join(", ") || "none"}; route chunks emitted: ${emitted.join(", ") || "none"})`,
              );
            }
            const url = base + output.fileName;
            sizes[url] = Buffer.byteLength(output.code);
            placedChunks.add(output.fileName);
            for (const symbol of entry.symbols) {
              symbols[symbol.id] = url;
              const rule = rules.find(({ match }) => (typeof match === "string" ? symbol.id.startsWith(match) : match.test(symbol.id)));
              const strategy = entry.preload ?? rule?.strategy;
              if (strategy) preload[symbol.id] = strategy;
            }
          }
        }
        // Dynamic imports reachable through each symbol chunk's static graph (lazy routes/components it
        // may load on use): intent prefetches them after the chunk.
        const lazy: Record<string, string[]> = {};
        // Dynamic import targets whose every importer prefetches them itself (`lazyOwned`).
        const owners = new Set((resume.lazyOwned ?? []).map((file) => resolve(root, file)));
        const owned = new Set<string>();
        if (owners.size)
          for (const output of Object.values(bundle))
            if (output.type === "chunk" && output.isDynamicEntry && output.facadeModuleId) {
              const importers = this.getModuleInfo(output.facadeModuleId)?.dynamicImporters ?? [];
              if (importers.length && importers.every((id) => owners.has(id))) owned.add(output.fileName);
            }
        // A dynamic import made by an app module (inside the Vite root, outside node_modules): a library's own `import()`
        // (cdk carousel rotation plugins, the live announcer) loads on use and is never prefetched for its importer's chunk —
        // only the library knows whether the interaction path reaches it.
        const insideApp = (file: string): boolean => !/[/\\]node_modules[/\\]/.test(file) && !relative(root, file).startsWith("..");
        // Source files of a module: symbol chunk / part modules stand for the component modules they compile.
        // An island facade stands for its framework module (a dynamic import its loader makes is the app's).
        const real = (file: string): string[] => (virtual(file) ? bridges!.sources(file) : [file]);
        const sourcesOf = (id: string): string[] =>
          id.startsWith(CHUNK)
            ? [...(chunks.get(id)?.parts.keys() ?? [])].flatMap(real)
            : id.startsWith(PART)
              ? real(id.slice(PART.length).split("?")[0]!)
              : id.startsWith("\0")
                ? virtual(id)
                  ? real(id)
                  : []
                : [id.split("?")[0]!];
        // Module ids an app module of the chunk imports dynamically, once per chunk (route chunks reach the same shared
        // chunks over and over: ui-docs' 1,181 route closures × a 1,000-import registry took the build past 10 GB when
        // this ran per (chunk, dynamic) pair with a `getModuleInfo` per module).
        const appDynamics = new Map<string, Set<string>>();
        const appImported = (chunk: Rollup.OutputChunk, dynamic: string): boolean => {
          let targets = appDynamics.get(chunk.fileName);
          if (!targets) {
            targets = new Set();
            for (const id of chunk.moduleIds) {
              const sources = sourcesOf(id);
              // An owner (`lazyOwned`: the router App) prefetches its own dynamic imports — never the chunk's lazies, even
              // when another importer shares the target (the home page module is also a static dep of its route chunk).
              if (sources.some(insideApp) && !sources.every((file) => owners.has(file)))
                for (const to of this.getModuleInfo(id)?.dynamicallyImportedIds ?? []) targets.add(to);
            }
            appDynamics.set(chunk.fileName, targets);
          }
          const target = byFile.get(dynamic);
          return !!target && target.moduleIds.some((id) => targets.has(id));
        };
        const byFile = new Map(
          Object.values(bundle)
            .filter((o): o is Rollup.OutputChunk => o.type === "chunk")
            .map((o) => [o.fileName, o]),
        );
        // Static import closure per symbol chunk and the runtime (`deps`): the server lists them as fetch-only
        // hints for chunks it prefetches without evaluating (a lazy router's), modulepreload fetching one module.
        const deps: Record<string, string[]> = {},
          closed: string[] = [];
        const closure = (file: string): void => {
          closed.push(base + file);
          const seen = new Set<string>(),
            stack = [...(byFile.get(file)?.imports ?? [])];
          while (stack.length) {
            const next = stack.pop()!;
            if (seen.has(next) || next === file) continue;
            seen.add(next);
            stack.push(...(byFile.get(next)?.imports ?? []));
          }
          if (seen.size) deps[base + file] = [...seen].map((name) => base + name);
          // Shared chunks' own sizes too: the server's background budget counts a chunk's closure.
          for (const name of seen) sizes[base + name] ??= Buffer.byteLength((byFile.get(name)?.code ?? "") as string);
        };
        if (runtime) closure(runtime.slice(base.length));
        for (const name of placedChunks) closure(name);
        // Framework island chunks (`rivet({ bridges })`): island key → URL, sizes + static closures (the framework runtime),
        // so the server's `_rPreload(key)` plans them like symbol chunks.
        const islands: Record<string, string> = {};
        if (bridges)
          for (const output of byFile.values()) {
            const key = output.facadeModuleId ? bridges.islandKey(output.facadeModuleId) : null;
            if (!key) continue;
            islands[key] = base + output.fileName;
            sizes[base + output.fileName] = Buffer.byteLength(output.code);
            closure(output.fileName);
          }
        for (const output of byFile.values()) {
          if (!output.facadeModuleId || !chunks.has(output.facadeModuleId)) continue;
          closure(output.fileName);
          const found = new Set<string>(),
            seen = new Set<string>(),
            stack = [output.fileName];
          while (stack.length) {
            const file = stack.pop()!;
            if (seen.has(file)) continue;
            seen.add(file);
            const chunk = byFile.get(file);
            if (!chunk) continue;
            stack.push(...chunk.imports);
            for (const dynamic of chunk.dynamicImports)
              if (!owned.has(dynamic) && !byFile.get(dynamic)?.facadeModuleId?.startsWith(CHUNK) && appImported(chunk, dynamic)) found.add(base + dynamic);
          }
          if (found.size) lazy[base + output.fileName] = [...found];
        }
        // Chunks sharing a ChunkGroup / route: loading one for an interaction prefetches the others.
        const groupOf: Record<string, string[]> = {};
        for (const [url, key] of Object.entries(siblings)) (groupOf[key] ??= []).push(url);
        const groups = Object.values(groupOf).filter((urls) => urls.length > 1);
        // Deps modules (`<chunk>.deps.js`, `export default [urls]`: the chunk's static import closure, = `deps`), one per
        // symbol chunk / the runtime: the loader imports a chunk's deps module when it hints that chunk for an interaction,
        // then hints the whole closure at once (one round trip) instead of the `import()` waterfall (modulepreload fetches
        // one module). Content-hashed with their chunk (its name changes when its imports do); nothing loads before intent.
        // A chunk without imports gets an empty one (the loader cannot tell which chunks import nothing).
        for (const url of closed)
          this.emitFile({
            type: "asset",
            fileName: url.slice(base.length).replace(/\.js$/, ".deps.js"),
            source: `export default ${JSON.stringify(deps[url] ?? [])};\n`,
          });
        const body = {
          runtime,
          ...(closed.length ? { depsModules: true } : {}),
          symbols,
          ...(builtins ? { builtins } : {}),
          ...(loader ? { loader } : {}),
          sizes,
          ...(Object.keys(islands).length ? { islands } : {}),
          ...(Object.keys(lazy).length ? { lazy, ...(resume.lazy === "intent" ? { lazyIdle: false } : {}) } : {}),
          ...(Object.keys(deps).length ? { deps } : {}),
          ...(Object.keys(preload).length ? { preload } : {}),
          ...(groups.length ? { groups } : {}),
          // Route chunks: few, page-sized handler chunks — servers fetch a page's ahead (`data-fo`) when the app prefetches.
          ...(chunkStrategy() === "route" ? { fetchAhead: true } : {}),
          // `resume.lazyRows`: the resume runtime of this build materialises lazy rows (servers write `L` records then).
          ...(lazyRowsIn ? { lazyRows: true } : {}),
          // `resume.domData`: the resume runtime of this build reads `D` entries (servers write them then).
          ...(domDataIn ? { domData: true } : {}),
        };
        const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
        this.emitFile({ type: "asset", fileName: MANIFEST, source: JSON.stringify({ hash, ...body }, null, 2) + "\n" });
      },
    },
    transform(original, id, options) {
      const [filename = "", query = ""] = id.split("?", 2);
      // Island facades (`rivet({ bridges })`) are the only virtual modules compiled here.
      const facade = virtual(filename);
      if ((id.startsWith("\0") && !facade) || (/(?:^|[/\\])node_modules[/\\]/.test(filename) && !sourcePackage(filename) && !frameworkJsx(filename)))
        return null;
      // A `.ts` route module (an endpoint a page imports from): its server exports leave the browser build too.
      const routeScript = /\.[cm]?ts$/.test(filename) && !filename.endsWith(".d.ts") && isRoute(filename);
      if (!facade && !/\.[jt]sx$/.test(filename) && !routeScript) {
        // DevTools (dev client only): plain app modules name their signals, computeds and contexts too
        // (same-line edits: line numbers and stacks stay right).
        if (!tools || !serve || !/\.[cm]?[jt]s$/.test(filename) || !original.includes("@rivetjs/") || !appModule(filename)) return null;
        const consumer = this.environment?.config?.consumer;
        if (options?.ssr ?? (consumer ? consumer === "server" : ssrBuild)) return null;
        const named = tools.nameSignals(original, null, /\.[cm]?ts$/.test(filename) ? "ts" : "js");
        return named ? { code: named.code, map: null } : null;
      }
      const params = new URLSearchParams(query);
      if (params.has("raw") || params.has("url") || params.has("rivet-chunk")) return null;
      if (!facade) {
        // A framework bridge's module (its plugins compile it). RV2145: also listed by an explicit Rivet `include`.
        const owner = bridges?.owner(filename, original);
        if (owner) {
          if (patterns.include != null && selected(filename)) this.error(ownershipConflict(filename, owner, root));
          // RV2148: Rivet runtime use in a framework-owned module (the framework compiles it; Rivet JSX / ABI would break).
          const use = rivetRuntimeUse(original, filename);
          if (use) this.error(foreignRivetRuntime(filename, owner, root, use));
          return null;
        }
        if (!selected(filename) || foreignJsxPragma(original)) return null;
      }
      const source = prepared(filename, original);
      const consumer = this.environment?.config?.consumer;
      const server = options?.ssr ?? (consumer ? consumer === "server" : ssrBuild);
      if (routeScript) {
        if (server) return null;
        const split = compile(source, { ...contributed(false, id), serverExports: true, target: "dom", filename, ...(sourceMap ? { sourceMap: true } : {}) });
        if (split.diagnostics.length) fail(this, split, filename);
        return { code: split.code, map: split.map ?? null };
      }
      // Resume modules resolve their imports first (canonical module reference ids); other modules stay synchronous.
      if (resume && isResumable(abs(filename)) && (!serve || server || resume.dev))
        return resolveImports(this, filename, source).then(() => finish(this, filename, source, server, id));
      return finish(this, filename, source, server, id);
    },
    // T6: a deleted (or renamed away) module drops its dev caches — sheet, last client code, dev symbols.
    watchChange(id, change) {
      if (change.event !== "delete") return;
      sheets.delete(id);
      clientCode.delete(id);
      const module = moduleId(id);
      for (const symbol of devModules.get(module) ?? []) devSymbols.drop(symbol, id);
      devModules.delete(module);
      resolvedImports.delete(id);
    },
    // css`` edits that leave the compiled module unchanged update only its stylesheet.
    async hotUpdate({ file, modules, read }) {
      // A framework source edit (E16): importers re-importing it under `?t=` would run a second copy
      // beside the page's; reload the page instead.
      // Derived model: a resume module edit reloads the page (adopted boundaries are not hot-replaced; the server
      // environment still invalidates its modules, so the reload renders the new code).
      if (derivedModel && this.environment.config.consumer !== "server" && modules.length && isResumable(file)) {
        this.environment.hot.send({ type: "full-reload" });
        return [];
      }
      if (this.environment.config.consumer !== "server" && modules.length && frameworkSource(file)) {
        this.environment.hot.send({ type: "full-reload" });
        return [];
      }
      if (!sheets.has(file)) return;
      const graph = this.environment.moduleGraph;
      const sheet = [...(graph.getModulesByFile(file + _STYLE_SUFFIX) ?? [])];
      const source = prepared(file, await read());
      const client = this.environment.config.consumer !== "server";
      // Same options as the transform (resume mode included), so an unchanged module compiles identically.
      const result = compile(source, moduleOptions(file, source, !client));
      if (result.diagnostics.length || result.css === undefined) return;
      sheets.set(file, result.css);
      if (!sheet.length) return;
      for (const module of sheet) graph.invalidateModule(module);
      if (!client) return [...modules, ...sheet];
      const unchanged = clientCode.get(file) === result.code;
      clientCode.set(file, result.code);
      return unchanged ? sheet : [...modules, ...sheet];
    },
  };
}
