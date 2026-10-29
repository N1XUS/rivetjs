import { readFile } from "node:fs/promises";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { basename, dirname, join, posix, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { switchContent } from "./switches.ts";
import { boundaryFacts } from "./facts-fixpoint.ts";
import { placeCalls, placementMismatches } from "./facts-placement.ts";
import { nativeFamilies, stylesState, type NativeFamily } from "./facts-native.ts";
import { liteFamilies, litePlan, type LiteFamily } from "./native-lite.ts";
import { explainText, placementTable, placeVerdicts, type PlacementOption, type PlacementTable } from "./place.ts";
import { islandGetters } from "./island-props.ts";
import { createFilter, parseAst, type FilterPattern, type HtmlTagDescriptor, type Plugin, type Rollup, type UserConfig, type ViteDevServer } from "vite";
import { compile, moduleFacts, type CompileOptions, type CompileResult, type ModuleFacts } from "./index.ts";
import { docsUrl } from "./codes.ts";
import { appFrames, codeFrame, displayPath, formatDiagnostic, remedyLines, groupDiagnostics, summary } from "./diagnostics-format.ts";
import { runtimeAbiProblem, runtimePackage } from "./abi.ts";
import { hotModule, sourceStamps } from "./hot.ts";
import { updateEditorManifest } from "./editor.ts";
import { imagesPlugin } from "./images/plugin.ts";
import { staticIcons } from "./static-icons.ts";
import { applyMotion, motionContextToken, motionSites, type MotionElementSite, type MotionLowering } from "./static-motion.ts";
import {
  CLASS_FX,
  CLASS_REG,
  CLASS_REGISTRY,
  classPlan,
  lazyResolvers,
  effectSource,
  REGISTRY_SOURCE,
  registrationSource,
  sideEffectImports,
  type Literal,
  type PlannedFamily,
} from "./static-class.ts";
import { encode, evaluator } from "./comptime-eval.ts";
import { matchesServerOnly, type ServerOnlyPattern } from "./server-only.ts";
import { nameRegistry, scopedName, type ClassNames } from "./styles.ts";
import type { ImagesConfig } from "./images/options.ts";
import { comptimeCandidate, createComptime, MERGE_PREFIX, type Comptime, type ComptimeOptions } from "./comptime.ts";
import { classJoinDeclarations, classModuleInfo, classOverrideCandidate, classPropUse, type ClassModuleInfo, type ClassPropTarget } from "./class-merge.ts";
import { entriesText, keptEntries, languagesOf, localeTables, LOCALE_TABLE_MARK, type LocaleTable } from "./locale-tables.ts";

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

/** Resume build options of `rivet({ resume })`: modules, dev, DOM data, roots. */
export interface RivetResumeOptions {
  /** Root-relative source modules compiled in resume mode (seeds of the build's boundary facts walk). */
  modules: string[];
  /**
   * Dev server: serve the modules resumable (`rivetRouter` sets it unless `dev: { resume: false }`): client modules
   * compile in resume mode (boundaries + keyed state) and the dev manifest (`api.devResume.manifest()`) points boundary
   * names at their dev module URLs. An edit of a resume module reloads the page. Default false: dev client modules
   * compile without resume mode (their pages client-render).
   */
  dev?: boolean;
  /**
   * Every app `.tsx`/`.jsx` module (inside the Vite root, outside `node_modules`) compiles in resume mode
   * when something resumable imports it, like source-package modules; `resume.modules` then only seeds the
   * graph. Without it an app module not listed in `modules` compiles without resume mode (source-package modules
   * always resume): its components are no boundaries and carry no keyed state.
   * `rivetRouter` sets it (default true there); plain `rivet({ resume })` keeps the explicit list.
   */
  appModules?: boolean;
  /**
   * DOM-backed list data (DERIVED-C5, spec `docs/design/specs/2026-10-18-structural-resume-design.md` "DOM data on
   * derived"): `<For>` items of a boundary record's data props become tail `d` entries the browser reads back from the
   * rows (`DOM_DATA` in `@rivetjs/runtime` `dom-derived.ts`; server `server-derived-dom.ts` behind the `dom-data-derived`
   * switch) instead of shipping them in the boundaries tail. Default true (DOMDATA-DEFAULT 2026-10-27: −3 µs SSR CPU and
   * smaller pages for +2–9 ms on the first interaction at 4× CPU): a resume build whose walk saw a keyed `<For>` with rows
   * showing a value as an element's whole text or a plain attribute (`domListIn`) adds the reader + encoder and
   * the browser reader's chunk URL as manifest `domData` (a chunk of its own: the runtime imports it for a tail with `d`
   * entries, whose page preloads it); any other build is byte-identical to `false`. `false` opts out (neither
   * ships, the rows travel in the tail).
   */
  domData?: boolean;
  /**
   * Incremental server lists (INCR2, opt-in): the server compile proves which `<For>` rows render from their item's read
   * fields only (native elements over `row().a.b`, the row's index and its literal-init local signals; `compile/incr.rs`) and
   * gives those lists a `$incr` fact. The runtime list cache (`incr` in `@rivetjs/router/server` `createApp` /
   * `@rivetjs/runtime/server-incr`) then reuses unchanged rows' bytes across requests. Default false: output unchanged.
   */
  incr?: boolean;
  /**
   * Root-relative modules whose default export is an independent root boundary (its props are data, whatever its call
   * sites pass or which contexts it reads), like a route module's default export. `rivetRouter()` adds its generated
   * `app.tsx` (`Root`: the route payload as props).
   */
  roots?: string[];
  /**
   * ZERO A1: components rendered only by a host that never adopts them (docs-kit `FrameShell`): root-relative `file` (its
   * default export) or `file#Name`. Without a resolved call site a component counts as adopted (some boundary may render
   * it through code the walk does not see) and keeps its slot markers; a shell entry is adopted only through its own
   * boundaries. Plugins add entries with `api.resumeShell(file, name?)` before the build starts.
   */
  shells?: string[];
  /**
   * ZERO CALLSITE: the components that render every `shells` page (docs-kit `FrameShell` / `FrameRoot`): root-relative
   * `file` (its default export) or `file#Name`. The per-call-site context proof (`facts-callsite.ts`) counts what they and
   * the page's `_layout` files touch as provided above a shell page; without hosts a shell page's ancestry is unknown (no
   * proof below it). Plugins add entries with `api.resumeHost(file, name?)`.
   */
  hosts?: string[];
  /**
   * PLACE (phase 1, spec `docs/design/specs/2026-10-26-automatic-placement-design.md`, `place.ts`): how the build picks
   * per proven call site between `site` (independent, context-free record with its props) and `with-parent` (adopts with
   * its parent). `"heuristic"` (default): today's rule, every proven site — byte-identical to the unplaced build;
   * `"measured"`: the calibrated cost table (`@rivetjs/compiler` `place-table.json`, `scripts/place/calibrate.ts`); a
   * table object or `{ table, explain, weights }`; `"off"`: no placement pass. Env `RIVET_PLACEMENT`
   * (`heuristic` | `measured` | `off` | a table JSON path) overrides; `RIVET_PLACEMENT_EXPLAIN=<file>` writes the report.
   */
  placement?: PlacementOption;
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
  /**
   * Dev server: module ids a server-rendered dev page loads before any island module (`rivetRouter()` adds them to the
   * page head next to `@vite/client`): what the framework's Vite plugin would inject through `transformIndexHtml`, which
   * SSR pages never run (React: `@vitejs/plugin-react/preamble`, the Fast Refresh preamble).
   */
  devScripts?(): string[];
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
  /** Dev page scripts of the configured bridges (`BridgeEntry.devScripts`, module ids). */
  devScripts?(): string[];
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
  /**
   * Build-time evaluation (default on in builds; dev always keeps the runtime calls). Calls of allowlisted functions
   * (tailwind-variants `tv` / `cn` / `cx`) or of functions annotated `@comptime` / `@comptime tv` with compile-time
   * constant arguments run in Node at build time and become their result; a `tv(…)` definition becomes a lookup table
   * proven against the real library for every enumerated variant combination, so call sites without a `class` /
   * `className` override read the table and only pages with an override load tailwind-merge. Non-deterministic results
   * (time, randomness, locale, environment) stay runtime calls (RV2108 warning). A `tv` wrapper module with a
   * `@comptime defer` import (`@rivetjs/ui`'s `cn`) keeps its definitions as runtime calls instead and the deferred import
   * is loaded only by modules that may pass an override. `false` turns it off; `functions` extends the allowlist:
   * `{ "my-lib": { join: "value", variants: "tv" } }`.
   */
  comptime?: boolean | ComptimeOptions;
  /**
   * Locales the app serves. Declared (here, or the `i18n()` plugin's `locales`), production client builds keep, in locale
   * tables (`// @rivet-locale-table`: the cdk `intl.ts` string tables), only the keys of these languages + `en-US`; a lookup
   * for another language loads the full table (its first render may show `en-US` strings until it has loaded), so list
   * every language the app serves. Undeclared: every table ships whole (exact for any locale). See `locale-tables.ts`.
   */
  locales?: readonly string[];
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

/** Dev server resume state of the compiler plugin (`api.devResume`). */
export interface DevResume {
  /**
   * Resume manifest for dev SSR: `runtime` is the dev derived runtime entry, `symbols` maps boundary names
   * (`<module>#<Name>`) to the dev URLs of the modules the dev server compiled them in.
   */
  manifest(): {
    runtime: string;
    symbols: Record<string, string>;
    builtins?: string;
  };
}

/** The derived runtime entry (manifest `runtime`, default export = the `dom-derived-runtime` instance). */
const DERIVED_ENTRY = "\0rivet-derived-entry";
/** Client resume builds: prefix of a boundary module's facade entry id (ZERO B6). */
const BOUNDARY_ENTRY = "\0rivet-boundary:";
const MANIFEST = ".vite/rivet-resume.json";
/**
 * Lite resume (ZERO LITE-WIRE): a module's lite entry (`CompileResult.lite`, `\0rivet-lite:<file>.js`) and the lite runtime
 * entry (default export = the `@rivetjs/runtime/dom-lite` instance). Everything they reach is a copy of its own (the id +
 * `?rivet-lite`): the lite modules share no module with the ordinary client graph, so the chunks of pages that load the
 * full runtime stay what they were (no split of `dom-events` & co. out of the runtime chunk), and a lite page loads
 * one reactivity / event table (a fallback's full runtime and ordinary module are copies too).
 */
const LITE_PREFIX = "\0rivet-lite:";
/** JS-DIET-2: the residual `<local>$a` of a lite entry reads its record's props (`__rivetLr.p`, `derived_lite.rs`). */
export function _liteReadsProps(code: string, local: string): boolean {
  const at = code.indexOf("export function " + local + "$a(");
  if (at < 0) return false;
  const end = code.indexOf("\nexport ", at + 1);
  return /\b__rivetLr\.p\b/.test(code.slice(at, end < 0 ? undefined : end));
}
const LITE_RUNTIME = "\0rivet-lite-runtime";
/** Stylesheets reached from lite modules: the page already links them (server render), a copy would be a second sheet. */
const LITE_EMPTY = "\0rivet-lite-empty";
const LITE_QUERY = /[?&]rivet-lite(?=&|$)/;
const PRELOAD_HELPER = "\0vite/preload-helper.js";
/** A stylesheet imported for its side effect (no query, not a CSS module): `LITE_EMPTY` in the lite graph. */
const LITE_CSS = /(?<!\.module)\.(?:css|less|sass|scss|styl|stylus|pcss|postcss|sss)$/;
/** MOTION-CSS (`static-motion.ts`): the import a rewritten module gets per entrance rule (`<prefix><hash>.css`; resolved to
 * `\0` + it, the rule's CSS from the walk). Not `virtual:`: the call-site proof's `contextExternal` reads a stylesheet
 * import as context-free. */
const MOTION_CSS = "rivet-motion-entrance:";
/** The id of a module's copy in the lite graph. */
const liteCopy = (id: string): string => id + (id.includes("?") ? "&" : "?") + "rivet-lite";
/** Importers the derived reactivity alias leaves alone (DERIVED-C4): the runtime and reactivity packages themselves. */
const RUNTIME_OWN = /[\\/](?:libs[\\/](?:runtime|reactivity)|@rivetjs[\\/](?:runtime|reactivity))[\\/]/;
/**
 * The runtime's browser build-time switches of the adopt run (`switches.ts` `DERIVED_SWITCHES`) → their opted-in content.
 * Matched by path: the workspace source (`libs/runtime/`) or an installed package (`@rivetjs/runtime/`, any layout).
 */
type DomSlots = (plan: { fragments: readonly string[]; attributes: readonly unknown[] }) => unknown[] | null;
/**
 * `resume.domData`: whether a server-compiled resume module holds a keyed `<For>` list mount (`"$list": [plan, …]`) whose
 * row template shows a value as an element's whole text or a plain attribute (`slots`: the runtime's `_domSlots`). The
 * plan is rebuilt from the module's `__rivetFragmentsN` / `__rivetListPlan(…)` declarations (child component plans
 * flattened as `_listPlan` does); any shape not read here (or no helper) counts as a hit: the switch ships.
 */
export function domListIn(code: string, slots: DomSlots | null): boolean {
  if (!code.includes('"$list"')) return false;
  if (slots === null) return true;
  type Node = { type: string; [key: string]: unknown };
  let body: Node[];
  try {
    body = (parseAst(code, { lang: "js" }) as unknown as { body: Node[] }).body;
  } catch {
    return true;
  }
  const decls = new Map<string, Node>();
  for (const statement of body)
    if (statement.type === "VariableDeclaration")
      for (const d of statement.declarations as Node[]) {
        const id = d.id as Node;
        if (id.type === "Identifier" && d.init) decls.set(id.name as string, d.init as Node);
      }
  const strings = (node: Node | undefined): string[] | null => {
    // `Object.freeze([...])` of string literals.
    const array = node?.type === "CallExpression" ? ((node.arguments as Node[])[0] as Node | undefined) : node;
    if (array?.type !== "ArrayExpression") return null;
    const out: string[] = [];
    for (const e of array.elements as (Node | null)[]) {
      if (e?.type !== "Literal" || typeof e.value !== "string") return null;
      out.push(e.value);
    }
    return out;
  };
  const OPEN = 1,
    CLOSE = -1;
  const plans = new Map<string, { fragments: string[]; attributes: unknown[] } | null>();
  const plan = (name: string, depth = 0): { fragments: string[]; attributes: unknown[] } | null => {
    if (plans.has(name)) return plans.get(name)!;
    plans.set(name, null);
    const call = decls.get(name);
    const args = call?.type === "CallExpression" ? (call.arguments as Node[]) : null;
    const fragments = args?.[0]?.type === "Identifier" ? strings(decls.get(args[0].name as string)) : null;
    const entries = args?.[1]?.type === "ArrayExpression" ? (args[1].elements as (Node | null)[]) : null;
    if (!fragments || !entries || fragments.length !== entries.length + 1 || depth > 32) return null;
    const flat = [fragments[0]!],
      attributes: unknown[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      if (entry.type === "Identifier") {
        const child = plan(entry.name as string, depth + 1);
        if (!child) return null;
        attributes.push(OPEN);
        flat.push(child.fragments[0]!);
        for (let k = 0; k < child.attributes.length; k++) (attributes.push(child.attributes[k]), flat.push(child.fragments[k + 1]!));
        attributes.push(CLOSE);
      } else if (entry.type === "Literal" && entry.value === null) attributes.push(null);
      else {
        const pair = strings(entry);
        if (!pair || pair.length !== 2) return null;
        attributes.push({ name: pair[1] === "svg" || pair[1] === "mathml" ? pair[0] : pair[0]!.toLowerCase() });
      }
      flat.push(fragments[i + 1]!);
    }
    const out = { fragments: flat, attributes };
    plans.set(name, out);
    return out;
  };
  let hit = false;
  const visit = (node: unknown): void => {
    if (hit || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const n = node as Node;
    if (n.type === "Property" && (n.key as Node).type === "Literal" && (n.key as Node).value === "$list") {
      const first = ((n.value as Node).elements as Node[] | undefined)?.[0];
      const p = first?.type === "Identifier" ? plan(first.name as string) : null;
      if (p === null || slots(p) !== null) hit = true;
      return;
    }
    for (const key in n) if (key !== "type") visit(n[key]);
  };
  visit(body);
  return hit;
}
const DERIVED_SWITCH = /[\\/](?:libs[\\/]runtime|@rivetjs[\\/]runtime)[\\/](derived|lazy-rows)\.([cm]?[jt]s)$/;
function derivedSwitch(id: string): string | null {
  const hit = DERIVED_SWITCH.exec(id);
  return hit && switchContent(hit[1]!, (module) => "./" + module + "." + hit[2]);
}
/** `resume.domData` (DERIVED-C5): the runtime's switch modules (`dom-data.ts` for the browser, `dom-data-derived.ts` for
 * the server) → their opted-in content (`switches.ts` `DOM_DATA_SWITCHES`). */
const DOM_DATA_SWITCH = /[\\/](?:libs[\\/]runtime|@rivetjs[\\/]runtime)[\\/](dom-data(?:-derived)?)\.([cm]?[jt]s)$/;
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
/** @internal Prepend the eager-compile hint to the chunks matching `root` and their static imports (maps shift a line). */
export function _hintEagerCompile(bundle: Rollup.OutputBundle, root: (output: Rollup.OutputChunk) => boolean): void {
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
    // The emitted `.map` file is its own bundle asset, serialized before this hook: shift it too (else every mapping of
    // a hinted chunk points one line too high).
    const asset = bundle[file + ".map"];
    if (asset?.type === "asset") {
      const map = JSON.parse(typeof asset.source === "string" ? asset.source : Buffer.from(asset.source).toString("utf8")) as { mappings?: string };
      if (typeof map.mappings === "string") ((map.mappings = ";" + map.mappings), (asset.source = JSON.stringify(map)));
    }
  }
}

/** A re-export facade chunk: one `import{…}from"./x.js";export{…};` and nothing else (Rolldown's output for a strict entry
 * whose module landed in a shared chunk). */
const FACADE = /^(?:\/\/# allFunctionsCalledOnLoad\n)?import\{([^}]*)\}from"(\.\/[^"]+\.js)";export\{([^}]*)\};?\s*(?:\/\/# sourceMappingURL=\S+\s*)?$/;
/** The chunk's final `export{…}` clause (Rolldown prints exactly one, last), with what may follow it. */
const EXPORTS_TAIL = /export\{([^}]*)\};?(\s*(?:\/\/# sourceMappingURL=\S+\s*)?)$/;
const IDENT = /^[A-Za-z_$][\w$]*$/;
/** `a as b,c` → [[b, a], [c, c]] (exported or imported name first, then the local binding); null on anything unexpected. */
function specifiers(list: string): [string, string][] | null {
  const out: [string, string][] = [];
  for (const part of list.split(",")) {
    const item = part.trim();
    if (!item) continue;
    const [left = "", right = left] = item.split(/\s+as\s+/);
    if (!IDENT.test(left) || !IDENT.test(right)) return null;
    out.push([right, left]);
  }
  return out;
}
/**
 * @internal Facade folding (B1 / B6'): the manifest names the chunk that holds an entry's code, not its 1-line re-export facade.
 * The `wanted` export names of the facade are added to that chunk's own `export{…}` clause (same bindings, extra names: an ES module may
 * export one binding under several names), so `import(chunk)[name]` is the facade's export. Returns the chunk to name, or
 * the facade itself when the shape is not the expected one or a name would collide. The facade file stays emitted (the Vite
 * manifest lists it) and is no longer fetched.
 */
export function _foldFacade(bundle: Rollup.OutputBundle, facade: Rollup.OutputChunk, wanted: readonly string[]): Rollup.OutputChunk {
  const hit = FACADE.exec(facade.code);
  if (!hit) return facade;
  const target = bundle[posix.join(posix.dirname(facade.fileName), hit[2]!)];
  const imported = specifiers(hit[1]!),
    all = specifiers(hit[3]!);
  if (target?.type !== "chunk" || !imported || !all) return facade;
  // Only the names the manifest's readers use (boundary exports, the runtime's `default`): a strict facade re-exports the
  // module's whole signature, and every extra name would grow a chunk other pages fetch too.
  const exported = all.filter(([name]) => wanted.includes(name));
  if (exported.length !== new Set(wanted).size) return facade;
  const tail = EXPORTS_TAIL.exec(target.code);
  const own = tail && specifiers(tail[1]!);
  if (!tail || !own) return facade;
  const bindingOf = new Map(own); // target export name → its local binding
  const viaImport = new Map(imported); // facade local → target export name
  const added: string[] = [];
  for (const [name, local] of exported) {
    const from = viaImport.get(local);
    const binding = from === undefined ? undefined : bindingOf.get(from);
    if (binding === undefined) return facade;
    const existing = bindingOf.get(name);
    if (existing !== undefined) {
      if (existing !== binding) return facade;
      continue;
    }
    bindingOf.set(name, binding);
    added.push(binding === name ? name : binding + " as " + name);
  }
  if (added.length) {
    const at = tail.index;
    target.code = target.code.slice(0, at) + "export{" + [tail[1]!, ...added].filter(Boolean).join(",") + "};" + tail[2]! + "";
    target.exports = [...new Set([...target.exports, ...exported.map(([name]) => name)])];
  }
  return target;
}

/** @internal Names a TS module exports as types only (`export type X`, `export interface X`, `export { type X }`, `export type { X }`). */
export function _typeExports(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(/\bexport\s+(?:declare\s+)?(?:type|interface)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]!);
  for (const m of source.matchAll(/\bexport\s+(type\s+)?\{([^}]*)\}/g))
    for (const part of m[2]!.split(",")) {
      const spec = part.trim();
      if (!spec || !(m[1] || /^type\s/.test(spec))) continue;
      const names = spec.replace(/^type\s+/, "").split(/\s+as\s+/);
      out.add(names[names.length - 1]!.trim());
    }
  return out;
}

/** @internal Query marking `@rivetjs/ui`'s own `tailwind-variants` import (ZERO B3): the merge-only copy below. */
export const _MERGE_ONLY = "?rivet-tw-merge";
/** @internal `@rivetjs/ui`'s variant resolver (`styles/src/utils/tv.ts`, source or packaged): the one importer redirected. */
export const _UI_TV = /[/\\]ui[/\\]styles[/\\]src[/\\]utils[/\\](?:tv|tv-merge|merge-on)\.[jt]s$/;
/** @internal `@rivetjs/ui`'s tailwind-merge provider (ZERO UI-JS2): imported by client modules `class-merge.ts` flags. */
export const _UI_TV_MERGE = "@rivetjs/ui/tv-merge";
/** A module with an import (it may render a prop-join component, `class-merge.ts` `classPropUse`). */
const IMPORTS = /\bimport\s*[\w{*(`"']|\bimport\.meta\.glob\b/;
/**
 * Dynamic imports the bundler resolves: a literal specifier (group 1 / 2), an `import(\`…\`)` template (group 3: with
 * `${…}` the dynamic-import-vars expansion, not provable here) or `import.meta.glob` (no group). `import(expr)` of an
 * expression loads a URL outside the bundle (no group either: skipped by the caller).
 */
const DYNAMIC = /\bimport\.meta\.glob\b|\bimport\s*\(\s*(?:(["'])([^"'\n]+)\1|`([^`]*)`|(?=[^\s"'`]))/g;

/**
 * @internal ZERO B3: a project module importing only `cn` / `cx` from `tailwind-variants` takes them from the merge-only
 * copy too (`_MERGE_ONLY`), so a page using `cn` next to `@rivetjs/ui` loads one tailwind-merge, not two. Builds only; the
 * import line keeps its length class (no newline change). Type-only / default / namespace imports and other names: as is.
 */
export function _mergeOnlyImports(source: string): string {
  if (!source.includes("tailwind-variants")) return source;
  return source.replace(/(\bimport\s*\{([^}]*)\}\s*from\s*)(["'])tailwind-variants\3/g, (all, head: string, names: string, quote: string) => {
    if (/^\s*import\s+type\b/.test(head)) return all;
    const specifiers = names
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    const values = specifiers.filter((name) => !/^type\s/.test(name)).map((name) => name.split(/\s+as\s+/)[0]!.trim());
    if (!values.length || values.some((name) => name !== "cn" && name !== "cx")) return all;
    return head + quote + "tailwind-variants" + _MERGE_ONLY + quote;
  });
}

/** @internal Query of the `tailwind-variants` internal chunk copy holding the package's one `state` (ZERO B3). */
export const _TW_STATE = "?rivet-tw-state";

// tailwind-variants 3.x `index.js`: tailwind-merge + `cn` (body), then `// src/index.ts` = the `tv` runtime + exports.
const TW_TAIL = "\n// src/index.ts\n";
const TW_SETUP = /^var runtime = (getTailwindVariants\((?:cnAdapter|classAdapter)\));\nvar tv = runtime\.tv;\nvar createTV = runtime\.createTV;$/m;
const TW_CHUNK_IMPORT = /^(import [^;\n]* from '\.\/chunk-[\w-]+\.js)';$/gm;
function twLayout(code: string): { body: string; tail: string } | null {
  const at = code.indexOf(TW_TAIL);
  if (at < 0) return null;
  const body = code.slice(0, at),
    tail = code.slice(at);
  const names = ["cn", "cnMerge", "cnAdapter"];
  if (
    !TW_SETUP.test(tail) ||
    names.some((name) => !new RegExp("^var " + name + " = ", "m").test(body)) ||
    !/^import \{[^}]*\bcx\b[^}]*\} from '\.\/chunk-/m.test(body)
  )
    return null;
  return { body, tail };
}
const twPure = (code: string): string =>
  code.replace(
    TW_SETUP,
    "var runtime = /* @__PURE__ */ $1;\nvar tv = /* @__PURE__ */ (() => runtime.tv)();\nvar createTV = /* @__PURE__ */ (() => runtime.createTV)();",
  );

/**
 * @internal The lazy parts of a module (IDLE-PREFETCH): the specifiers of its `lazyComponent(() => import("…"))` calls
 * (an inline arrow importer, optional type arguments and an annotated empty parameter list). Other dynamic imports
 * (route tables, `clientOnly`, plain `import()` on use) are not lazy parts: the browser fetches lazy parts after the
 * page's fetch-ahead list, at idle (tail `data-fl`).
 */
export function _lazyParts(source: string): string[] {
  if (!source.includes("lazyComponent")) return [];
  const out: string[] = [];
  for (const hit of source.matchAll(/\blazyComponent\s*(?:<[^()]*>)?\(\s*\(\s*\)\s*(?::[^=]*)?=>\s*import\(\s*(["'`])([^"'`]+)\1\s*\)/g)) out.push(hit[2]!);
  return out;
}

/**
 * @internal Build-time module layout for tailwind-variants 3.x (ZERO B3). Rolldown shakes per statement but places per
 * module, so upstream's single `index.js` (tailwind-merge + `cn`, then the `tv` runtime built at load) put the `tv` runtime
 * into the chunk every `@rivetjs/ui` page loads for `cn` as soon as any page of the build imported upstream `tv`.
 * - `index.js` + `_MERGE_ONLY` (= `tailwind-variants${_MERGE_ONLY}`: ui's `tv.ts`, `_UI_TV`, and project `cn` / `cx`-only
 *   imports, `_mergeOnlyImports`): the body alone, exporting `cn` / `cnMerge` / `cnAdapter` / `cx`.
 * - `index.js`: its `tv` runtime over that module (`cn` & co imported from it: one tailwind-merge per page), the setup
 *   annotated pure; `lite.js`: the setup annotated pure.
 * - `chunk-*.js` holding `var state = createState();`: imports `state` from its `_TW_STATE` copy instead, so both module
 *   sets share the one mutable state (twMergeConfig cache), and the merge module never reaches `getTailwindVariants`; the
 *   merge side's other internal chunks are `_MERGE_ONLY` copies (helpers upstream's `tv` keeps stay on its side).
 * Same values, same evaluation order. Text that does not match (another version) is left as is (then upstream's layout).
 */
export function _pureAnnotate(id: string, code: string, query = ""): string | null {
  const match = /[/\\]node_modules[/\\]tailwind-variants[/\\]dist[/\\](index|lite|chunk-[\w-]+)\.js$/.exec(id);
  if (!match) return null;
  const file = match[1]!;
  if (file.startsWith("chunk-")) {
    // The state copy and the merge module's helper copies import the merge-side copies (`_MERGE_ONLY`) of the other chunks:
    // statements upstream's `tv` keeps in a shared helper chunk stay out of the merge side's chunk.
    if (query === _TW_STATE.slice(1) || query === _MERGE_ONLY.slice(1)) {
      const out = code.replace(TW_CHUNK_IMPORT, "$1" + _MERGE_ONLY + "';");
      return out === code ? null : out;
    }
    if (!/^var state = createState\(\);$/m.test(code)) return null;
    return `import { state } from './${file}.js${_TW_STATE}';\n` + code.replace(/^var state = createState\(\);$/m, "");
  }
  if (file === "lite") {
    const out = twPure(code);
    return out === code ? null : out;
  }
  const layout = twLayout(code);
  if (!layout) return null;
  // The merge module reads `state` straight from the copy: reaching the original chunk would pull `getTailwindVariants`.
  if (query === _MERGE_ONLY.slice(1))
    return (
      layout.body.replace(TW_CHUNK_IMPORT, (_, line: string) => line + (/\bstate\b/.test(line) ? _TW_STATE : _MERGE_ONLY) + "';") +
      "\nexport { cn, cnMerge, cnAdapter, cx };\n"
    );
  const head = (layout.body.match(TW_CHUNK_IMPORT) ?? []).filter((line) => /\bgetTailwindVariants\b/.test(line));
  if (head.length !== 1) return null;
  return head[0] + `\nimport { cn, cnMerge, cnAdapter, cx } from './index.js${_MERGE_ONLY}';` + twPure(layout.tail);
}

/** Compile project JSX/TSX for Vite's DOM or SSR environment. Styles use Vite's normal pipeline.
 * `resume.modules` (root-relative paths) seed the resume module graph: every build environment walks it for the
 * boundary facts (`facts-fixpoint.ts`), both targets compile its modules in resume mode (boundaries + keyed state), the
 * client build emits one chunk per module holding boundaries plus the derived runtime entry, and writes
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
  comptime = true,
  locales,
}: RivetOptions = {}): Plugin | Plugin[] {
  const plugin = rivetPlugin(resume, devtools, css, serverExports, { include, exclude }, icons, serverOnly ?? [], comptime, locales);
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
// (type-only imports too) to walk the resume module graph; none of them is an import. Import guards
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

/** Resume membership for editors (`.rivet/editor.json`); best effort, builds never depend on it.
 * Written on every config resolution (bumps its mtime: `rivet-check`'s staleness check). */
function writeEditorManifest(root: string, resume: RivetResumeOptions | undefined): void {
  const posix = (path: string) => path.split(sep).join("/");
  try {
    // Undefined removes what a previous config wrote.
    updateEditorManifest(root, { resumeModules: resume ? [...new Set(resume.modules.map(posix))].sort() : undefined });
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
  comptimeOption: boolean | ComptimeOptions = true,
  localesOption?: readonly string[],
): Plugin {
  // `include` / `exclude` (resolved against the Vite root once it is known).
  let selected: (id: string) => boolean = () => true;
  let ssrBuild = false,
    // `resume.domData`: this client build's derived runtime has the DOM data reader (`domDataSwitch`).
    domDataIn = false,
    abiChecked = false,
    serve = false,
    sourceMap = false,
    root = process.cwd(),
    base = "/",
    // `rivetRouter()` in the config: it owns the server-only guard (document routes, RV3011); else `serverOnly` is guarded here.
    routed = false;
  // Build-time evaluation (`comptime.ts`): builds only, one evaluator per plugin instance (shared by its environments).
  let comptime: Comptime | null = null;
  let comptimeCache: string | undefined;
  // A build (`configResolved` with `command: "build"`): the only mode the pass runs in.
  let built = false;
  const comptimeOn = (): Comptime | null =>
    !built || comptimeOption === false ? null : (comptime ??= createComptime(comptimeOption === true ? {} : comptimeOption, comptimeCache));
  const comptimeHost = (ctx: Rollup.PluginContext) => ({
    resolve: async (spec: string, importer: string) => {
      const hit = await ctx.resolve(spec, importer, { skipSelf: true });
      return hit && !hit.external ? hit.id : null;
    },
    // Ids imports may name (externals included: the server build keeps `tailwind-variants` external).
    resolveId: async (spec: string, importer: string) => (await ctx.resolve(spec, importer, { skipSelf: true }))?.id ?? null,
    warn: (message: string, file: string) => ctx.warn({ message: message + "\n  docs: " + docsUrl("RV2108"), id: file, plugin: "vite-plugin-rivet" }),
  });
  /** Comptime rewrite of a transformed module (call sites, definitions); the input's map stays (lines are kept). */
  // Synchronous when the pass is off (dev, `comptime: false`, a hook called without `configResolved`).
  type Out = { code: string; map: Rollup.SourceMapInput | null } | null;
  const comptimeRewrite = (ctx: Rollup.TransformPluginContext, filename: string, out: Out, original: string): Out | Promise<Out> => {
    const pass = comptimeOn();
    if (!pass || !comptimeCandidate(out ? out.code : original)) return out;
    return pass
      .transform(out ? out.code : original, filename, comptimeHost(ctx))
      .then((next) => (next === null ? out : { code: next, map: out ? out.map : null }));
  };
  /** `classMergeImport` on production client builds (dev and server builds merge always: ui `#tv-merge`). */
  const classMerged = (
    ctx: Rollup.TransformPluginContext,
    filename: string,
    original: string,
    options: { ssr?: boolean } | undefined,
    out: Out | Promise<Out>,
  ): Out | Promise<Out> => {
    const consumer = ctx.environment?.config?.consumer;
    // Synchronous unless the module can hold an override (a class-like name) or, in a prop-join recording pass, import a
    // prop-join component (the scan resolves the provider and the imports: async).
    if (
      !built ||
      serve ||
      (options?.ssr ?? (consumer ? consumer === "server" : ssrBuild)) ||
      !(classOverrideCandidate(original) || (joinsRecord && IMPORTS.test(original))) ||
      !classMergeScope(filename)
    )
      return out;
    return Promise.resolve(out).then((value) => classMergeImport(ctx, filename, original, value));
  };
  // Locale tables (ZERO UI-JS2, `locale-tables.ts`): the declared locales (option, else the `i18n()` plugin's), the tables by marker index.
  let declaredLocales: readonly string[] | null = localesOption ?? null;
  const localeMarks: { table: LocaleTable; file: string }[] = [];
  // The tables `localeRewrite` parsed, by `<file>#<name>` (the first of a name in source order): their lazy full-table
  // module is built from them, not from the file read and parsed again (PERF-REST P10). Cleared with `localeMarks`.
  const localeFull = new Map<string, LocaleTable>();
  const LOCALE_FULL = "\0rivet-locale-table:";
  const localeClient = (ctx: { environment?: { config?: { consumer?: string } } }, options?: { ssr?: boolean }): boolean => {
    const consumer = ctx.environment?.config?.consumer;
    return built && !serve && declaredLocales !== null && !(options?.ssr ?? (consumer ? consumer === "server" : ssrBuild));
  };
  /** A table module's client code: each table = the marker spread + the lazy full table (`renderChunk` fills it in). */
  const localeRewrite = (filename: string, code: string): string | null => {
    const tables = localeTables(code, filename);
    if (!tables.length) return null;
    for (const table of [...tables].reverse()) localeFull.set(filename + "#" + table.name, table);
    let out = code;
    for (const table of [...tables].sort((a, b) => b.start - a.start)) {
      const index = localeMarks.push({ table, file: filename }) - 1;
      const full = JSON.stringify(LOCALE_FULL + filename + "#" + table.name);
      out =
        out.slice(0, table.start) +
        `{ ...${JSON.stringify(`__rivet_lt_${index}__`)}, [Symbol.for("rivet.locales")]: { l: ${JSON.stringify(`__rivet_ll_${index}__`)}, f: () => import(${full}).then((m) => m.${table.name}) } }` +
        out.slice(table.end);
    }
    return out;
  };
  /** The languages this client build renders: the declared locales' (`languagesOf`, with `en`). */
  const localeLanguages = (): Set<string> => languagesOf(declaredLocales ?? []);
  const resumable = new Set<string>();
  // `resume.domData` (DERIVED-C5): on in resume builds unless `false` (DOMDATA-DEFAULT 2026-10-27), served only to a build
  // whose walk saw a keyed `<For>` list mount with DOM slots (`domDataLists`): any other build is byte-identical to `false`.
  // Dev (no walk) serves it whenever on.
  let domDataLists = false;
  const domDataOn = (): boolean => resume !== undefined && resume.domData !== false && (serve || domDataLists);
  // Per resume module, the build's boundary verdicts (`facts-fixpoint.ts`, buildStart of every build environment: client
  // and server walk the same graph, so both targets get the same boundaries / names / keys); dev compiles without them
  // (module-local closure, identical on both targets).
  const derivedVerdicts = new Map<
    string,
    { boundaries: string[]; independent: string[]; conditional: string[]; static: string[]; site: string[]; sites: string[]; free: string[]; native: string[] }
  >();
  // `resume.roots`: modules whose default export is an independent root (the router's generated `Root`).
  const isDerivedRoot = (filename: string): boolean => !!resume?.roots?.some((path) => resolve(root, path) === resolve(filename));
  // Dev: module-local verdicts (`facts-fixpoint.ts`, without the program): boundaries = components with a change source,
  // own read sites or listeners, closed over the module's own tags; conditional = those without a change source.
  const devVerdicts = new Map<string, { source: string; boundaries: string[]; conditional: string[] }>();
  const devVerdict = (filename: string, source: string): { boundaries: string[]; conditional: string[] } => {
    const hit = devVerdicts.get(filename);
    if (hit?.source === source) return hit;
    const facts = moduleFacts(source, filename, { boundaries: true }).boundaries ?? new Map();
    const marked = new Set<string>();
    for (const [name, c] of facts) if (c.source || c.interactive || c.listens) marked.add(name);
    for (let grew = true; grew;) {
      grew = false;
      for (const [name, c] of facts) if (!marked.has(name) && [...c.renders].some((tag) => marked.has(tag))) (marked.add(name), (grew = true));
    }
    const boundaries = [...marked];
    const entry = { source, boundaries, conditional: boundaries.filter((name) => !facts.get(name)!.source) };
    devVerdicts.set(filename, entry);
    return entry;
  };
  // `resume.shells` + `api.resumeShell()` (ZERO A1): absolute `file` / `file#Name` entries, resolved in the walk.
  const shellEntries: string[] = [];
  const hostEntries: string[] = [];
  const shellSet = (): Set<string> =>
    new Set(
      [...(resume?.shells ?? []), ...shellEntries].map((entry) => {
        const at = entry.lastIndexOf("#");
        return at > 0 ? resolve(root, entry.slice(0, at)) + entry.slice(at) : resolve(root, entry);
      }),
    );
  // Dev: boundary name (`<module>#<export>`, compile results) → defining file, for the dev manifest's `symbols`.
  const derivedDev = new Map<string, string>();
  // Client build: module → its boundary names as the DOM compile emitted them (`CompileResult.boundaries`: the export
  // names the runtime reads from the chunk), for the manifest's `symbols`.
  const derivedNames = new Map<string, string[]>();
  // Client build (ZERO B6, codex 994dcf7e6 vite half): boundary entry `\0rivet-boundary:<file>` → `<file>`. The strict entry
  // is a facade re-exporting only the compiled boundary names, so the module's other exports (and imports only they use)
  // shake, instead of the whole module signature being pinned by a strict entry on the module itself.
  const boundaryEntries = new Map<string, string>();
  // Client build (IDLE-PREFETCH): importer module → the resolved ids of its lazy parts (`lazyComponent(() => import("…"))`
  // targets, `lazyParts`), for the manifest's `lazy` (the server's later fetch list, tail `data-fl`). Resolved while the
  // build transforms (`lazyPending`), read once the bundle is written.
  const lazyImports = new Map<string, Set<string>>();
  const lazyPending: Promise<unknown>[] = [];
  // Client build (ZERO LITE-WIRE): module → its lite entry (compile `lite`: residual code + the boundary names it covers).
  const liteEntries = new Map<string, { code: string; names: string[] }>();
  // JS-DIET-2 one request: with one lite entry in the build, the lite runtime + that entry (set at `buildEnd`) are the `lite`
  // chunk group's roots; the group takes their static dependencies too (the modules the chunk actually uses: an import
  // only the fallback graph reads stays out), so a lite page fetches one file. Several lite entries: default chunking.
  const liteGroup = new Set<string>();
  // Resume walk: module → whether it exports anything but its boundary components (the facade only pays off then).
  const derivedExtraExports = new Map<string, boolean>();
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
  // MOTION-CSS (builds, `static-motion.ts`): module → its text with the proven CSS-only `<Motion.*>` call sites rewritten
  // (`from`: the prepared text the walk proved them on), entrance rule CSS by hash (`MOTION_CSS` imports).
  const motionText = new Map<string, { from: string; to: string }>();
  const motionCss = new Map<string, string>();
  // `@rivetjs/motion/static` as the importer resolves it (null: not installed / not loadable), by resolved file.
  const motionLowering = new Map<string, Promise<MotionLowering | null>>();
  const lowerFor = (importer: string): Promise<MotionLowering | null> => {
    let file: string;
    try {
      file = createRequire(importer).resolve("@rivetjs/motion/static");
    } catch {
      return Promise.resolve(null);
    }
    let hit = motionLowering.get(file);
    if (!hit)
      motionLowering.set(
        file,
        (hit = import(pathToFileURL(file).href).then(
          (m: { staticMotion?: MotionLowering }) => m.staticMotion ?? null,
          () => null,
        )),
      );
    return hit;
  };
  // VCLS (builds, `static-class.ts`): module → its text with `$cls` at the proven call sites (`from`: the prepared text
  // the walk proved them on); the active families (declaring module → its lazy resolver bindings), the browser build's
  // registration imports by module, the walked modules and the families' packages (the transform's net for the rest).
  const classText = new Map<string, { from: string; to: string }>();
  // PRESS-LITE (builds, `native-lite.ts`): module → its text with the proven call sites renamed to the light twin
  // (`from`: the prepared text after the Motion pass the walk proved them on).
  const liteText = new Map<string, { from: string; to: string }>();
  const classState = {
    families: [] as PlannedFamily[],
    lazy: new Map<string, Map<string, string>>(),
    flags: new Map<string, Set<string>>(),
    walked: new Set<string>(),
    packages: [] as { name: string; dir: string; keys: string[] }[],
    definitions: new Map<string, { file: string; name: string }>(),
    keep: new Map<string, { file: string; name: string }[]>(),
    registries: new Map<string, string>(),
  };
  // Build-time class evaluations (both environments' walks ask the same calls): recipe → class (null: refused).
  const classValues = new Map<string, Promise<string | null>>();
  let classEvaluator: ReturnType<typeof evaluator> | null = null;
  const classEvaluate = (file: string, name: string, props: Record<string, Literal>): Promise<string | null> => {
    const id = JSON.stringify([file, name, props]);
    let hit = classValues.get(id);
    if (!hit) {
      classEvaluator ??= evaluator();
      hit = classEvaluator
        .evaluate({ file, name, args: [encode(props)!], adapter: "value" })
        .then((result) => (result.ok && "value" in result && typeof result.value === "string" ? result.value : null));
      classValues.set(id, hit);
    }
    return hit;
  };
  // `<Icon>` with constant props → inline `<svg>`; then the walk's Motion rewrite, then its static classes (builds).
  const prepared = (filename: string, source: string): string => {
    if (!/\.[jt]sx$/.test(filename)) return source;
    const text = (serve ? (t: string) => t : _mergeOnlyImports)(icons ? staticIcons(source, filename, lucideFor) : source);
    const motion = motionText.get(filename);
    const moved = motion && motion.from === text ? motion.to : text;
    const lite = liteText.get(filename);
    const lighter = lite && lite.from === moved ? lite.to : moved;
    const cls = classText.get(filename);
    return cls && cls.from === lighter ? cls.to : lighter;
  };
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
  // `@rivetjs/runtime/resume-builtins` (built-in value decoders: route payloads with RegExp / binary / errors / registered
  // classes, DERIVED-S): its resolved id (production: an emitted chunk, manifest `builtins`) once `buildStart` resolved it.
  let builtinsId: string | null = null;
  // `resume.domData`: the browser's DOM data reader (`dom-data-reader.ts` next to the resolved derived runtime), emitted as
  // a chunk of its own by client builds; the `dom-data` switch serves its URL (`import.meta.ROLLUP_FILE_URL_<ref>`).
  let domReaderId: string | null = null,
    domReaderRef: string | null = null;
  const posix = (path: string) => path.split(sep).join("/");
  const devResume: DevResume = {
    manifest: () => ({
      runtime: base + devUrl(DERIVED_ENTRY),
      symbols: new Proxy({} as Record<string, string>, {
        get: (_, name) => {
          const file = typeof name === "string" ? derivedDev.get(name) : undefined;
          return file && base + devUrl(file);
        },
      }),
      ...(builtinsId ? { builtins: base + devUrl(builtinsId) } : {}),
      // Framework islands (E2a): island key → its dev client module (`\0rivet-island-client:…`), so lean records (JSON
      // props) boot in dev as in a build, and adopt runs' fetch-ahead names their modules.
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
    }),
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
  // tailwind-merge on demand (ZERO UI-JS2, `class-merge.ts`): a production client module that can hand `@rivetjs/ui`'s
  // resolver an override tailwind-merge would change imports `@rivetjs/ui/tv-merge` (registers the merge before its code
  // runs). Scope: app modules and packages that may render ui components (`@rivetjs/*` packages other than ui that do not
  // depend on it render classes, never resolve them); third-party code under node_modules is never scanned.
  const mergeScopes = new Map<string, boolean>(); // package dir → in scope
  const classMergeScope = (file: string): boolean => {
    if (file.startsWith("\0") || !/\.[cm]?[jt]sx?$/.test(file) || file.endsWith(".d.ts")) return false;
    if (/[/\\]node_modules[/\\]/.test(file) && !sourcePackage(file)) return false;
    const dir = packageOf(dirname(file));
    if (!dir) return true;
    let hit = mergeScopes.get(dir);
    if (hit === undefined) {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: string } & Record<string, Record<string, string> | undefined>;
      const deps = { ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.devDependencies };
      hit = !pkg.name?.startsWith("@rivetjs/") || pkg.name === "@rivetjs/ui" || "@rivetjs/ui" in deps;
      mergeScopes.set(dir, hit);
    }
    return hit;
  };
  const joinFiles = new Map<string, Map<string, number[]>>();
  // `@rivet-class-join` helpers of the module's relative imports (ui's `utils/compose.tsx`, `utils/live.tsx`).
  const importedJoins = (file: string, code: string): Map<string, number[]> => {
    const out = new Map<string, number[]>();
    for (const [, spec = ""] of code.matchAll(/\bfrom\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      const target = resolve(dirname(file), spec);
      let joins = joinFiles.get(target);
      if (!joins) joinFiles.set(target, (joins = existsSync(target) ? classJoinDeclarations(readFileSync(target, "utf8")) : new Map()));
      for (const [name, args] of joins) out.set(name, args);
    }
    return out;
  };
  const mergeProviders = new Map<string, Promise<string | null>>(); // package dir → resolved provider id
  let twMergeFn: ((value: string) => string) | null | undefined;
  // Prop joins (BIG-UI-3, `class-merge.ts` `conditional`): a component whose only override sources join two forwarded
  // class props (ui Scheduler: `classNames.base` + `class`) needs the merge only when some caller passes two of them.
  // Who calls it is a whole-build fact, so it is decided across the two passes of a co-load build (env `RIVET_COLOAD`,
  // `@rivetjs/router` `build/coload.ts`): pass 1 imports the merge as for any source and records every client module's
  // uses (`class-joins.json` in that dir); pass 2 (same sources) imports it into a prop-join module only when pass 1
  // found a caller that may pass two (or a use it cannot follow). One-pass builds treat prop joins as sources.
  // Module facts are read from disk (a caller may be transformed before the component), cached per build.
  const joinsDir = process.env.RIVET_COLOAD || null;
  const JOINS_FILE = "class-joins.json";
  type JoinsFile = { v: 1; joins: string[]; needed: string[]; all: boolean };
  const joinsPlan: { needed: Set<string>; all: boolean } | null = (() => {
    const file = joinsDir && join(joinsDir, JOINS_FILE);
    if (!file || !existsSync(file)) return null;
    const data = JSON.parse(readFileSync(file, "utf8")) as JoinsFile;
    return { needed: new Set(data.needed), all: data.all };
  })();
  const joinsRecord = joinsDir && !joinsPlan ? { joins: new Set<string>(), needed: new Set<string>(), all: false } : null;
  const joinKey = (file: string) => relative(root, file).split(sep).join("/");
  const classInfos = new Map<string, ClassModuleInfo | null>();
  const classInfoOf = (file: string, merge: (value: string) => string): ClassModuleInfo | null => {
    let info = classInfos.get(file);
    if (info === undefined) {
      const path = file.split("?", 1)[0]!;
      const readable = classMergeScope(path) && existsSync(path);
      const code = readable ? readFileSync(path, "utf8") : null;
      info = code === null ? null : classModuleInfo(code, path, { merge, joins: importedJoins(path, code) });
      classInfos.set(file, info);
    }
    return info;
  };
  const classResolved = new Map<string, Promise<string | null>>();
  const classResolve = (ctx: Rollup.TransformPluginContext, spec: string, importer: string): Promise<string | null> => {
    const key = (spec.startsWith(".") ? importer : dirname(importer)) + "\0" + spec;
    let hit = classResolved.get(key);
    if (!hit)
      classResolved.set(
        key,
        (hit = ctx.resolve(spec, importer, { skipSelf: true }).then(
          (r) => (r && !r.external && !r.id.startsWith("\0") ? r.id.split("?", 1)[0]! : null),
          () => null,
        )),
      );
    return hit;
  };
  type Join = { file: string; sets: string[][][] };
  // The prop join behind export `name` of `file`, through re-exports and `export *` (null: none). Modules outside the
  // merge scope (virtual, plain packages) hold no override sources and re-export none.
  const classJoinOf = async (
    ctx: Rollup.TransformPluginContext,
    file: string,
    name: string,
    merge: (value: string) => string,
    depth = 0,
  ): Promise<Join | null> => {
    const info = depth > 16 ? null : classInfoOf(file, merge);
    if (!info) return null;
    const own = info.conditional.get(name);
    if (own) return { file, sets: own };
    if (info.locals.has(name)) return null;
    for (const re of info.reexports)
      if (re.exported === name && re.imported !== "*") {
        const to = await classResolve(ctx, re.from, file);
        return to ? classJoinOf(ctx, to, re.imported, merge, depth + 1) : null;
      }
    if (name === "default") return null;
    for (const star of info.stars) {
      const to = await classResolve(ctx, star, file);
      const hit = to ? await classJoinOf(ctx, to, name, merge, depth + 1) : null;
      if (hit) return hit;
    }
    return null;
  };
  // Every prop-join module a module's namespace reaches (re-exports, `export *`, `export * as`).
  const classJoinFiles = async (
    ctx: Rollup.TransformPluginContext,
    file: string,
    merge: (value: string) => string,
    out = new Set<string>(),
    seen = new Set<string>(),
  ) => {
    if (seen.has(file) || seen.size > 4096) return out;
    seen.add(file);
    const info = classInfoOf(file, merge);
    if (!info) return out;
    if (info.conditional.size) out.add(file);
    for (const from of [...info.reexports.map((re) => re.from), ...info.stars]) {
      const to = await classResolve(ctx, from, file);
      if (to) await classJoinFiles(ctx, to, merge, out, seen);
    }
    return out;
  };
  // Pass 1: the prop-join modules a module's uses may pass two joined props to (static imports via `classPropUse`;
  // dynamic imports: a literal specifier = its whole namespace, `import.meta.glob` / `import(\`…${…}\`)` = unknown).
  const classRecordUses = async (
    ctx: Rollup.TransformPluginContext,
    filename: string,
    original: string,
    info: ClassModuleInfo,
    merge: (value: string) => string,
  ) => {
    const record = joinsRecord!;
    if (info.conditional.size) record.joins.add(joinKey(filename));
    for (const m of original.matchAll(DYNAMIC)) {
      const spec = m[2] ?? (m[3] !== undefined && !m[3].includes("${") ? m[3] : undefined);
      if (spec === undefined) {
        if (m[0].startsWith("import.meta") || m[3] !== undefined) record.all = true;
        continue;
      }
      const to = await classResolve(ctx, spec, filename);
      if (to) for (const file of await classJoinFiles(ctx, to, merge)) record.needed.add(joinKey(file));
    }
    if (!info.imports.size) return;
    const targets = new Map<string, ClassPropTarget>();
    const files = new Map<string, string[]>(); // hit key → prop-join modules
    for (const [local, { from, imported }] of info.imports) {
      const to = await classResolve(ctx, from, filename);
      if (!to) continue;
      if (imported === "*") {
        const all = await classJoinFiles(ctx, to, merge);
        if (!all.size) continue;
        files.set(local + ".*", [...all]);
        const members = new Map<string, Join | null>();
        // Member lookups happen during the synchronous scan: resolve every member the module names first.
        for (const [, name] of original.matchAll(new RegExp(`\\b${local}\\s*\\.\\s*([A-Za-z_$][\\w$]*)`, "g"))) {
          if (members.has(name!)) continue;
          const join = await classJoinOf(ctx, to, name!, merge);
          members.set(name!, join);
          if (join) files.set(`${local}.${name}`, [join.file]);
        }
        targets.set(local, { members: (name) => members.get(name)?.sets ?? null });
        continue;
      }
      const join = await classJoinOf(ctx, to, imported, merge);
      if (!join) continue;
      targets.set(local, { sets: join.sets });
      files.set(local, [join.file]);
    }
    if (!targets.size) return;
    for (const key of classPropUse(original, filename, targets, { merge })) for (const file of files.get(key) ?? []) record.needed.add(joinKey(file));
  };
  const classMergeImport = async (ctx: Rollup.TransformPluginContext, filename: string, original: string, out: Out): Promise<Out> => {
    const code = out ? out.code : original;
    const dir = packageOf(dirname(filename)) ?? dirname(filename);
    let provider = mergeProviders.get(dir);
    if (!provider)
      mergeProviders.set(dir, (provider = ctx.resolve(_UI_TV_MERGE, filename, { skipSelf: true }).then((hit) => (hit && !hit.external ? hit.id : null))));
    const id = await provider;
    if (!id || id.split("?", 1)[0] === filename) return out;
    if (twMergeFn === undefined) {
      try {
        const require = createRequire(id.split("?", 1)[0]!);
        const mod = (await import(pathToFileURL(require.resolve("tailwind-variants")).href)) as { cn: (value: string) => string };
        twMergeFn = (value: string) => mod.cn(value) ?? "";
      } catch {
        twMergeFn = null;
      }
    }
    // Without tailwind-merge at build time every override counts as one that may change.
    const merge = twMergeFn ?? (() => "\0");
    if (joinsRecord) {
      const info = classInfoOf(filename, merge) ?? classModuleInfo(original, filename, { merge, joins: importedJoins(filename, original) });
      await classRecordUses(ctx, filename, original, info, merge);
      if (!info.hard && !info.conditional.size) return out;
    } else if (!classOverrideCandidate(original)) return out;
    else {
      const info = classInfoOf(filename, merge) ?? classModuleInfo(original, filename, { merge, joins: importedJoins(filename, original) });
      if (!info.hard && !info.conditional.size) return out;
      // Pass 2: a module whose only sources are prop joins no caller may pass two of.
      if (!info.hard && joinsPlan && !joinsPlan.all && !joinsPlan.needed.has(joinKey(filename))) return out;
    }
    // Same line (maps and line numbers stay): ES imports are hoisted.
    return { code: `import ${JSON.stringify(id)};` + code, map: out ? out.map : null };
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
  // ZERO CALLSITE (`facts-callsite.ts` `ContextOptions.external`): a module outside the walk an app module imports —
  // null when it holds no context app code could provide or read: the reactivity / runtime packages (their own tokens
  // are internal; `Suspense` / `Async` / `resource` / `lazy` and the runtime router are pseudo-tokens of their own),
  // assets, npm packages without an `@rivetjs/*` dependency; else its pseudo-token.
  const rivetDeps = new Map<string, boolean>(); // "<dir>\0<package>" → its package.json names an `@rivetjs/*` dependency
  const contextExternal = (file: string, spec: string): string | null => {
    if (spec.startsWith("\0") || spec.startsWith("virtual:")) return "mod:" + spec;
    if (spec.includes("?") || /\.(css|scss|json|svg|png|jpe?g|gif|webp|avif|ico|woff2?|md|txt|mp[34]|webm)$/.test(spec)) return null;
    if (/^@rivetjs\/runtime\/(async|lazy)$/.test(spec)) return "!suspense";
    if (/^@rivetjs\/runtime\/router/.test(spec)) return "pkg:@rivetjs/router";
    if (/^@rivetjs\/(reactivity|runtime)(\/|$)/.test(spec)) return null;
    if (spec.startsWith(".") || spec.startsWith("/")) return "mod:" + resolve(dirname(file), spec);
    const name = spec
      .split("/")
      .slice(0, spec.startsWith("@") ? 2 : 1)
      .join("/");
    if (name.startsWith("@rivetjs/")) return "pkg:" + name;
    const key = dirname(file) + "\0" + name;
    let deps = rivetDeps.get(key);
    if (deps === undefined) {
      deps = true;
      for (let dir = dirname(file); ; dir = dirname(dir)) {
        const pkg = join(dir, "node_modules", name, "package.json");
        if (existsSync(pkg)) {
          const json = JSON.parse(readFileSync(pkg, "utf8")) as Record<string, Record<string, string> | undefined>;
          deps = [json.dependencies, json.peerDependencies, json.optionalDependencies].some((d) => d && Object.keys(d).some((k) => k.startsWith("@rivetjs/")));
          break;
        }
        if (dirname(dir) === dir) break;
      }
      rivetDeps.set(key, deps);
    }
    return deps ? "pkg:" + name : null;
  };
  /** PLACE: run the placement pass over the walk (null: `placement: "off"`). Pages: route / derived roots + shell pages. */
  const placementOf = (
    facts: Map<string, ModuleFacts>,
    verdicts: ReturnType<typeof boundaryFacts>,
    bytes: Map<string, number>,
    shells: Set<string>,
  ): ReturnType<typeof placeVerdicts> | null => {
    const env = process.env.RIVET_PLACEMENT;
    const option: PlacementOption = env
      ? env === "heuristic" || env === "measured" || env === "off"
        ? env
        : { table: env }
      : (resume?.placement ?? "heuristic");
    if (option === "off" || !verdicts.callSites) return null;
    const config: Exclude<PlacementOption, string | PlacementTable> =
      typeof option === "object" && !("kind" in option) ? option : { table: option as "heuristic" | "measured" | PlacementTable };
    const pages = [...verdicts.roots];
    for (const entry of shells) {
      const at = entry.lastIndexOf("#");
      const file = at > 0 && !existsSync(entry) ? entry.slice(0, at) : entry;
      const name = file === entry ? (facts.get(file)?.defaultName ?? "default") : entry.slice(at + 1);
      if (facts.get(file)?.boundaries.has(name)) pages.push(file + "?" + name);
    }
    const explainFile = process.env.RIVET_PLACEMENT_EXPLAIN ?? config.explain;
    const placed = placeVerdicts({
      facts,
      verdicts,
      bytes,
      pages,
      table: placementTable(config.table),
      ...(config.weights ? { weights: config.weights } : {}),
      explain: !!explainFile,
      display: (file) => posix(relative(root, file)),
    });
    if (!placed.agrees) console.warn("[rivet] placement: the legal call sites differ from the call-site proof; today's verdicts kept");
    if (explainFile) {
      writeFileSync(explainFile + ".txt", explainText(placed, { all: true }));
      writeFileSync(explainFile, JSON.stringify({ result: placed.result, graph: placed.graph }));
    }
    return placed;
  };
  /** Walk the resume module graph from `resume.modules` (facts with `boundaries`), close the boundary facts over it (`boundaryFacts`; route modules' default exports are independent roots) and keep each module's verdicts. */
  const derivedWalk = async (ctx: Rollup.PluginContext): Promise<void> => {
    const facts = new Map<string, ModuleFacts>(),
      sourceBytes = new Map<string, number>(),
      typeExports = new Map<string, Set<string>>(),
      graph = new Map<string, Map<string, string>>(),
      roots = new Set<string>(),
      families = new Map<string, NativeFamily[]>(),
      lites = new Map<string, LiteFamily[]>(),
      routeFiles = new Set<string>(),
      stateStyled = new Set<string>();
    const pending = [...resumable];
    // MOTION-CSS: the walked modules' prepared texts (the Motion pass rewrites from them).
    const texts = new Map<string, string>();
    motionText.clear();
    liteText.clear();
    classText.clear();
    placementMismatches.length = 0;
    // `resume.domData`: resume modules that may hold a `<For>` (their source names it), checked after the verdicts.
    const forSources = new Map<string, string>();
    // Plain re-export modules (M6-PARITY 6b): app / source-package `.ts` / `.js` modules between resume modules (a package
    // `index.ts`, `meter/index.ts` with `Object.assign(MeterRoot, { … })`) join the walk without boundaries, so tags
    // resolve through them to the component's call sites; they are never compiled as resume modules.
    const plain = new Set<string>();
    const passThrough = (file: string) =>
      /\.[cm]?[jt]s$/.test(file) && !/[/\\]node_modules[/\\]/.test(file) && (!relative(root, file).startsWith("..") || sourcePackage(file) !== null);
    const walk = async (): Promise<void> => {
      for (let filename; (filename = pending.shift());) {
        if (facts.has(filename)) continue;
        const source = prepared(filename, await sourceOf(ctx, filename));
        sourceBytes.set(filename, source.length);
        texts.set(filename, source);
        const route = isRoute(filename);
        const f = plain.has(filename)
          ? moduleFacts(source, filename, { refs: true })
          : placeCalls(
              source,
              filename,
              moduleFacts(source, filename, route ? { serverExports: true, resume: true, boundaries: true, refs: true } : { boundaries: true, refs: true }),
            );
        facts.set(filename, f);
        if (!plain.has(filename) && resume?.domData !== false && /\bFor\b/.test(source)) forSources.set(filename, source);
        // ZERO STATESPACE: the module's `@rivet-native` families (`facts-native.ts`).
        const declared = plain.has(filename) ? [] : nativeFamilies(source);
        if (declared.length) families.set(filename, declared);
        // PRESS-LITE: the module's `@rivet-native-lite` families (`native-lite.ts`).
        const light = plain.has(filename) ? [] : liteFamilies(source);
        if (light.length) lites.set(filename, light);
        if (!plain.has(filename) && stylesState(source)) stateStyled.add(filename);
        typeExports.set(filename, _typeExports(source));
        if (route || isDerivedRoot(filename)) roots.add(filename);
        if (route) routeFiles.add(filename);
        const map = new Map<string, string>();
        for (const spec of new Set([...f.statics, ...f.dynamics])) {
          const hit = await resolveFact(ctx, spec, filename);
          const file = hit && !hit.external ? hit.id.split("?")[0]! : null;
          if (!file) continue;
          if (isResumable(file)) {
            map.set(spec, file);
            if (!resumable.has(file)) (resumable.add(file), pending.push(file));
          } else if (!file.startsWith("\0") && passThrough(file) && existsSync(file)) {
            // (Dynamic ones too, ZERO CALLSITE: `import("./announcer.ts")` in a hook reaches that module's declarations.)
            map.set(spec, file);
            if (!plain.has(file)) (plain.add(file), pending.push(file));
          }
        }
        graph.set(filename, map);
      }
    };
    await walk();
    // ZERO CALLSITE: the hosts above every shell page (`resume.hosts` + `api.resumeHost`: docs-kit `FrameShell` / `FrameRoot`).
    const shells = shellSet();
    const hostList = [...(resume?.hosts ?? []), ...hostEntries].map((entry) => {
      const at = entry.lastIndexOf("#");
      return at > 0 ? resolve(root, entry.slice(0, at)) + entry.slice(at) : resolve(root, entry);
    });
    const close = () =>
      boundaryFacts(
        facts,
        graph,
        roots,
        shells,
        {
          external: contextExternal,
          debug: !!process.env.RIVET_CALLSITE_TRACE,
          ...(hostList.length ? { hosts: new Set(hostList) } : {}),
          // RT-DIET2: the derived roots (`resume.roots`: the router's `Root`) render every route module.
          ...(resume?.roots?.length ? { routeHosts: new Set(resume.roots.map((path) => resolve(root, path))) } : {}),
        },
        { families, stateStyled },
      );
    let verdicts = close();
    // MOTION-CSS: CSS-only `<Motion.*>` call sites with nothing Motion reads provided above them become plain elements
    // (`static-motion.ts`); the rewritten modules' facts are recomputed and the program closed again. A rewrite can only
    // shrink what is provided above other calls (an outer Motion element gone), so a later round may prove more.
    const motionTrace = process.env.RIVET_MOTION_TRACE ? (...a: unknown[]) => console.error("[motion-css]", ...a) : null;
    for (let round = 0; round < 4; round++) {
      let changed = false;
      for (const [file, text] of texts) {
        if (plain.has(file) || !text.includes("@rivetjs/motion")) continue;
        const lower = await lowerFor(file);
        if (!lower) continue;
        const own = facts.get(file)!;
        const sites = motionSites(text, file, lower);
        const proven = (site: MotionElementSite): boolean => {
          if (!site.rewrite || site.component === null) return false;
          const calls = own.boundaries.get(site.component)?.calls;
          if (!calls) return false;
          const same = calls.flatMap((call, index) => (call.tag === site.tag ? [index] : []));
          // The walk's calls and the parsed elements must agree (count, enclosing tags), else nothing is rewritten.
          if (same.length !== sites.filter((s) => s.component === site.component && s.tag === site.tag).length) return false;
          const index = same[site.ordinal]!;
          if (calls[index]!.around.join("\0") !== site.around.join("\0")) return false;
          const above = verdicts.aboveCall(file + "?" + site.component, index);
          const ok = above !== null && !above.some(motionContextToken);
          motionTrace?.(
            relative(root, file),
            site.component,
            site.tag,
            site.ordinal,
            ok ? "static" : above === null ? "above TOP" : above.filter(motionContextToken),
          );
          return ok;
        };
        const chosen = sites.filter(proven);
        if (!chosen.length) continue;
        const to = applyMotion(text, chosen, (hash) => MOTION_CSS + hash + ".css");
        if (to === text) continue;
        for (const site of chosen) if (site.rewrite?.css) motionCss.set(site.rewrite.css.hash, site.rewrite.css.css);
        motionText.set(file, { from: motionText.get(file)?.from ?? text, to });
        texts.set(file, to);
        sourceBytes.set(file, to.length);
        facts.set(
          file,
          placeCalls(
            to,
            file,
            moduleFacts(to, file, isRoute(file) ? { serverExports: true, resume: true, boundaries: true, refs: true } : { boundaries: true, refs: true }),
          ),
        );
        changed = true;
      }
      if (!changed) break;
      verdicts = close();
    }
    // VCLS (`static-class.ts`): `$cls` at the call sites whose class props are constants; which modules register.
    const classTrace = process.env.RIVET_CLASS_TRACE ? (...a: unknown[]) => console.error("[class]", ...a) : null;
    // `RIVET_STATIC_CLASS=0`: off (A/B measurement, parity tests); `=page`: proof per page instead of per build.
    const introduced = new Set<string>();
    let previouslyActive = new Set<string>();
    const planClasses = () =>
      process.env.RIVET_STATIC_CLASS === "0"
        ? { families: [], texts: new Map<string, string>(), flags: new Map<string, Set<string>>() }
        : classPlan({
            texts,
            introduced,
            previouslyActive,
            facts,
            target: (file, spec) => graph.get(file)?.get(spec) ?? null,
            resolveTag: verdicts.resolveTag,
            namespaceOf: verdicts.namespaceOf,
            exportsComponent: verdicts.exportsComponent,
            callers: verdicts.callers,
            definition: async (file, spec) => {
              const hit = await resolveFact(ctx, spec, file);
              return hit && !hit.external && !hit.id.startsWith("\0") ? hit.id.split("?")[0]! : null;
            },
            evaluate: classEvaluate,
            scope: process.env.RIVET_STATIC_CLASS === "page" ? "page" : "build",
            boundaries: verdicts.boundaries,
            edges: (file) => graph.get(file)?.values() ?? [],
            keyOf: (file, name, declaring) =>
              createHash("sha256")
                .update(posix(relative(root, file)) + "#" + name + (introduced.has(declaring) ? "#" + posix(relative(root, declaring)) : ""))
                .digest("hex")
                .slice(0, 10),
            ...(classTrace
              ? { trace: (...a: unknown[]) => classTrace(...a.map((v) => (typeof v === "string" && v.startsWith(root) ? relative(root, v) : v))) }
              : {}),
          });
    // PRESS-LITE (`native-lite.ts`): proven handler call sites render the declared light twin; the rewritten modules
    // (and the twins) are walked again and the program closed again. `RIVET_NATIVE_LITE=0`: off (A/B, parity).
    const liteTrace = process.env.RIVET_LITE_TRACE ? (...a: unknown[]) => console.error("[lite]", ...a) : null;
    if (lites.size && process.env.RIVET_NATIVE_LITE !== "0" && verdicts.callSites) {
      const twins = new Map<string, string | null>();
      for (const [file, list] of lites)
        for (const family of list) {
          const hit = await resolveFact(ctx, family.spec, file);
          twins.set(file + "\0" + family.spec, hit && !hit.external ? hit.id.split("?")[0]! : null);
        }
      const proof = verdicts.callSites;
      const lite = litePlan({
        texts,
        facts,
        families: lites,
        stateStyled,
        twin: (file, spec) => twins.get(file + "\0" + spec) ?? null,
        callers: verdicts.callers,
        aboveCall: verdicts.aboveCall,
        touches: (id) => proof.touches(id),
        provides: (id) => proof.provides(id),
        resolveTag: verdicts.resolveTag,
        // Page scope (`RIVET_NATIVE_LITE=all`: every proven site, A/B).
        ...(process.env.RIVET_NATIVE_LITE === "all"
          ? {}
          : {
              pages: [...routeFiles],
              edges: (file: string) => [...(facts.get(file)?.statics ?? [])].flatMap((spec) => graph.get(file)?.get(spec) ?? []),
              dynamicEdges: (file: string) => [...(facts.get(file)?.dynamics ?? [])].flatMap((spec) => graph.get(file)?.get(spec) ?? []),
              packageOf: (file: string) => sourcePackage(file)?.dir ?? null,
              isStatic: (id: string) => {
                const at = id.lastIndexOf("?");
                return verdicts.static(id.slice(0, at)).includes(id.slice(at + 1));
              },
            }),
        ...(liteTrace ? { trace: (...a: unknown[]) => liteTrace(...a.map((v) => (typeof v === "string" && v.startsWith(root) ? relative(root, v) : v))) } : {}),
      });
      if (lite.texts.size) {
        // Removing the last proven caller must not deactivate a class proof the original graph already established.
        const priorClasses = await planClasses();
        previouslyActive = new Set(priorClasses.families.map((family) => family.file + "?" + family.component));
        for (const twin of lite.twins) if (!texts.has(twin)) introduced.add(twin);
        for (const [file, to] of lite.texts) {
          liteText.set(file, { from: texts.get(file)!, to });
          facts.delete(file);
          pending.push(file);
        }
        for (const twin of lite.twins) if (!facts.has(twin) && !resumable.has(twin)) (resumable.add(twin), pending.push(twin));
        await walk();
        verdicts = close();
      }
    }
    const plannedClasses = await planClasses();
    for (const [file, to] of plannedClasses.texts) {
      classText.set(file, { from: texts.get(file)!, to });
      texts.set(file, to);
    }
    classState.families = plannedClasses.families;
    classState.flags = plannedClasses.flags;
    classState.walked = new Set(facts.keys());
    classState.lazy = new Map();
    classState.definitions = new Map();
    classState.keep = new Map();
    classState.registries = new Map();
    const packages = new Map<string, { name: string; dir: string; keys: string[] }>();
    for (const family of plannedClasses.families) {
      let lazy = classState.lazy.get(family.file);
      if (!lazy) classState.lazy.set(family.file, (lazy = new Map()));
      lazy.set(family.resolver, family.key);
      classState.definitions.set(family.key, family.definition);
      classState.keep.set(family.key, family.keep);
      // New twins must not split the registry chunk shared by the original components either.
      if (introduced.has(family.file))
        classState.registries.set(
          family.key,
          CLASS_REGISTRY +
            ":" +
            createHash("sha256")
              .update(posix(relative(root, family.file)))
              .digest("hex")
              .slice(0, 10),
        );
      const pkg = sourcePackage(family.file) ?? { name: "", dir: root };
      let entry = packages.get(pkg.dir);
      if (!entry) packages.set(pkg.dir, (entry = { ...pkg, keys: [] }));
      entry.keys.push(family.key);
      classTrace?.("active", family.component, relative(root, family.file), family.key, family.proven + " proven");
    }
    classState.packages = [...packages.values()];
    if (process.env.RIVET_CALLSITE_TRACE) {
      const out: Record<string, unknown> = {};
      for (const [id, results] of verdicts.callSites!.trace) out[id] = results;
      const marks: Record<string, unknown> = {};
      for (const file of facts.keys()) {
        const site = verdicts.callSites!.site(file),
          sites = verdicts.callSites!.sites(file),
          free = verdicts.callSites!.free(file);
        if (site.length || sites.length || free.length) marks[file] = { site, sites, free };
      }
      out["marks:"] = marks;
      // CTX-SOUND: components whose parsed calls did not match the facts (every call of theirs escapes).
      out["placement-mismatch:"] = [...new Set(placementMismatches)].map((id) => relative(root, id));
      // CTX-SOUND: independent components demoted to dependent (they may read a context provided above an unproven site).
      out["demoted:"] = verdicts.callSites!.demoted.map((id) => relative(root, id));
      for (const id of (process.env.RIVET_CALLSITE_WHY ?? "").split(",").filter(Boolean))
        out["why:" + id] = id.startsWith("^")
          ? verdicts.callSites!.whyAbove(resolve(root, id.slice(1).split("@")[0]!), id.split("@")[1])
          : verdicts.callSites!.why(resolve(root, id.split("@")[0]!), id.split("@")[1]);
      appendFileSync(process.env.RIVET_CALLSITE_TRACE, JSON.stringify(out) + "\n");
    }
    // PLACE: per proven call site, `site` vs `with-parent` (heuristic table = today's marks, byte-identical).
    const placement = placementOf(facts, verdicts, sourceBytes, shells);
    derivedVerdicts.clear();
    derivedExtraExports.clear();
    for (const [file, f] of facts)
      if (!plain.has(file)) {
        const boundaries = verdicts.boundaries(file);
        derivedVerdicts.set(file, {
          boundaries,
          independent: verdicts.independent(file),
          conditional: verdicts.conditional(file),
          static: verdicts.static(file),
          site: placement ? placement.site(file) : verdicts.callSites!.site(file),
          sites: placement ? placement.sites(file) : verdicts.callSites!.sites(file),
          free: verdicts.callSites!.free(file),
          native: verdicts.native(file),
        });
        const own = new Set(boundaries.map((name) => name.slice(name.lastIndexOf("#") + 1)));
        const types = typeExports.get(file)!;
        derivedExtraExports.set(
          file,
          f.reexports.size > 0 || [...f.exports].some(([exported, local]) => !own.has(local) && !own.has(exported) && !types.has(exported)),
        );
      }
    domDataLists = false;
    if (forSources.size) {
      const slots = await domSlotsHelper(ctx);
      for (const [file, source] of forSources)
        if (domListIn(compile(source, moduleOptions(file, source, true)).code, slots)) {
          domDataLists = true;
          break;
        }
    }
  };
  /** The app runtime's `_domSlots` (`server-derived-dom.ts`, next to the resolved `server-derived`), null when not found. */
  const domSlotsHelper = async (ctx: Rollup.PluginContext): Promise<DomSlots | null> => {
    const hit = await ctx.resolve("@rivetjs/runtime/server-derived", join(root, "index.html"), { skipSelf: true });
    const file = hit && !hit.external ? hit.id.split("?")[0]! : null;
    if (!file) return null;
    const helper = join(dirname(file), "server-derived-dom" + file.slice(file.lastIndexOf(".")));
    if (!existsSync(helper)) return null;
    try {
      return ((await import(pathToFileURL(helper).href)) as { _domSlots?: DomSlots })._domSlots ?? null;
    } catch {
      return null;
    }
  };
  /** Resume manifest (`.vite/rivet-resume.json`): `runtime` (the derived entry chunk), `symbols` (boundary
   * name → the chunk of its module), `sizes` (those chunks' bytes), `deps` (static import closure of the runtime and of
   * every boundary chunk: the server's fetch-ahead list `data-fo`, DERIVED-C), `builtins` (the built-in decoders' chunk: the
   * server names it in a route payload that needs it, `_rData`), `lazy` (IDLE-PREFETCH: chunk → the chunks of the lazy
   * parts its modules import; absent without lazy parts). */
  function derivedManifest(this: Rollup.PluginContext, bundle: Rollup.OutputBundle): void {
    const symbols: Record<string, string> = {},
      sizes: Record<string, number> = {},
      deps: Record<string, string[]> = {},
      islands: Record<string, string> = {},
      chunks = new Map<string, Rollup.OutputChunk>(),
      sized = new Set<Rollup.OutputChunk>(),
      roots: string[] = [];
    const lite: Record<string, string> = {};
    const liteProps: string[] = [];
    let runtime: string | null = null,
      builtins: string | null = null,
      domReader: string | null = null,
      liteRuntime: string | null = null;
    for (const output of Object.values(bundle)) {
      if (output.type !== "chunk") continue;
      chunks.set(output.fileName, output);
      if (!output.facadeModuleId) continue;
      if (output.facadeModuleId === DERIVED_ENTRY) {
        const real = _foldFacade(bundle, output, ["default"]);
        runtime = base + real.fileName;
        roots.push(real.fileName);
      }
      if (output.facadeModuleId === builtinsId) builtins = base + _foldFacade(bundle, output, []).fileName;
      if (domReaderId && output.facadeModuleId === domReaderId) domReader = base + output.fileName;
      // Lite graph (ZERO LITE-WIRE): the lite runtime + per module its lite entry (`lite.symbols`: boundary name → URL).
      if (output.facadeModuleId === LITE_RUNTIME) {
        // JS-DIET-2: in the `lite` group the chunk also answers a default-exported boundary's `module.default` (the full
        // runtime's fallback reads it as the component): then the runtime keeps its facade (one more, ~90 B file).
        const shared = liteGroup.size > 0 && [...liteEntries.values()].some((entry) => entry.names.some((name) => name.endsWith("#default")));
        const real = shared ? output : _foldFacade(bundle, output, ["default"]);
        liteRuntime = base + real.fileName;
        roots.push(real.fileName);
        continue;
      }
      if (output.facadeModuleId.startsWith(LITE_PREFIX)) {
        const entry = liteEntries.get(output.facadeModuleId.slice(LITE_PREFIX.length, -3));
        if (entry) {
          // JS-DIET-2: in the one `lite` group the entry is a facade of the chunk the runtime also names (one URL, one fetch):
          // its residual (`$a`, the lite runtime) and ordinary-module import (`$c`, the full runtime's fallback) exports.
          const real = _foldFacade(
            bundle,
            output,
            entry.names.flatMap((name) => [name.slice(name.lastIndexOf("#") + 1) + "$a", name.slice(name.lastIndexOf("#") + 1) + "$c"]),
          );
          for (const name of entry.names) {
            lite[name] = base + real.fileName;
            if (_liteReadsProps(entry.code, name.slice(name.lastIndexOf("#") + 1))) liteProps.push(name);
          }
          sized.add(real);
          roots.push(real.fileName);
        }
        continue;
      }
      // Framework island chunks (M6-PARITY): island key → URL + size + closure, as on the serialized manifest.
      const island = bridges ? bridges.islandKey(output.facadeModuleId) : null;
      if (island) ((islands[island] = base + output.fileName), (sizes[base + output.fileName] = Buffer.byteLength(output.code)), roots.push(output.fileName));
      const source = boundaryEntries.get(output.facadeModuleId) ?? output.facadeModuleId;
      const names = output.isEntry && derivedVerdicts.get(source)?.boundaries.length ? derivedNames.get(source) : undefined;
      if (!names?.length) continue;
      const real = _foldFacade(
        bundle,
        output,
        names.map((name) => name.slice(name.lastIndexOf("#") + 1)),
      );
      sized.add(real);
      for (const name of names) symbols[name] = base + real.fileName;
      roots.push(real.fileName);
    }
    if (liteRuntime) liteShared.call(this, chunks);
    // Lazy parts (IDLE-PREFETCH): per chunk, the chunks of the lazy parts its modules import (`lazyImports`); those chunks
    // join the roots, so `deps` holds their static closures. The server's later fetch list (tail `data-fl`) = what the
    // fetch-ahead list reaches through these edges, minus the fetch-ahead list.
    const lazy: Record<string, string[]> = {};
    if (lazyImports.size)
      for (const chunk of chunks.values()) {
        const targets = new Set<string>();
        for (const id of chunk.moduleIds) for (const target of lazyImports.get(id) ?? []) targets.add(target);
        if (!targets.size) continue;
        // The chunk an `import()` names: the part's facade (a dynamic entry), or the chunk holding the part's module.
        const parts = new Set<string>();
        for (const file of chunk.dynamicImports) {
          const to = chunks.get(file);
          if (to && ((to.facadeModuleId && targets.has(to.facadeModuleId)) || to.moduleIds.some((id) => targets.has(id)))) parts.add(file);
        }
        if (!parts.size) continue;
        lazy[base + chunk.fileName] = [...parts].sort().map((file) => base + file);
        for (const file of parts) roots.includes(file) || roots.push(file);
      }
    // After the loop: folding (`foldFacade`) appends export names to a chunk named earlier.
    for (const chunk of sized) sizes[base + chunk.fileName] = Buffer.byteLength(chunk.code);
    for (const file of roots) {
      const seen = new Set<string>(),
        stack = [...(chunks.get(file)?.imports ?? [])];
      while (stack.length) {
        const next = stack.pop()!;
        if (seen.has(next) || next === file) continue;
        seen.add(next);
        stack.push(...(chunks.get(next)?.imports ?? []));
      }
      if (seen.size) deps[base + file] = [...seen].sort().map((name) => base + name);
    }
    // `resume.domData` (DERIVED-C5): the derived client reads list data from the page (`DOM_DATA` loaded); servers write `d` then.
    const body = {
      runtime,
      symbols,
      sizes,
      deps,
      ...(Object.keys(islands).length ? { islands } : {}),
      ...(builtins ? { builtins } : {}),
      ...(domDataIn && domReader ? { domData: domReader } : {}),
      ...(Object.keys(lazy).length ? { lazy } : {}),
      // Pages whose every record is in `lite.symbols` load `lite.runtime` + those entries instead (server `flush`).
      ...(liteRuntime && Object.keys(lite).length
        ? { lite: { runtime: liteRuntime, symbols: lite, ...(liteProps.length ? { props: liteProps.sort() } : {}) } }
        : {}),
    };
    const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
    this.emitFile({ type: "asset", fileName: MANIFEST, source: JSON.stringify({ hash, ...body }, null, 2) + "\n" });
  }
  /** ZERO LITE-WIRE: a chunk both graphs reach (static or dynamic imports) means the lite modules changed the ordinary
   * chunking (a module Vite / Rolldown injects into both, e.g. Rolldown's runtime helpers): warn, naming the chunks. */
  function liteShared(this: Rollup.PluginContext, chunks: Map<string, Rollup.OutputChunk>): void {
    const lite = (id: string | null) => !!id && (id === LITE_RUNTIME || id.startsWith(LITE_PREFIX) || LITE_QUERY.test(id));
    const reach = (from: Rollup.OutputChunk[]) => {
      const seen = new Set<string>(),
        stack = from.map((chunk) => chunk.fileName);
      for (let file; (file = stack.pop()) !== undefined;) {
        if (seen.has(file)) continue;
        seen.add(file);
        const chunk = chunks.get(file);
        if (chunk) stack.push(...chunk.imports, ...chunk.dynamicImports);
      }
      return seen;
    };
    const entries = [...chunks.values()].filter((chunk) => chunk.isEntry);
    const ordinary = reach(entries.filter((chunk) => !lite(chunk.facadeModuleId)));
    const shared = [...reach(entries.filter((chunk) => lite(chunk.facadeModuleId)))].filter((file) => ordinary.has(file));
    if (shared.length)
      this.warn(
        `[rivet] lite resume: the lite graph shares ${shared.join(", ")} with the ordinary client graph (pages on the full runtime may load other chunks than without lite modules)`,
      );
  }
  const warned = new Set<string>();
  let diagnosticErrors = 0,
    diagnosticWarnings = 0;
  let diagnosticLogger: ViteDevServer["config"]["logger"] | undefined;
  // Compile + dev bookkeeping of one transformed `.tsx` / `.jsx` module.
  const finish = (ctx: Rollup.TransformPluginContext, filename: string, source: string, server: boolean, id: string) => {
    const result = compile(source, moduleOptions(filename, source, server, id));
    if (result.diagnostics.length) fail(ctx, result, filename);
    // One warning per code/file, retaining occurrence counts; repeated transforms stay silent.
    for (const { diagnostic: w, count } of groupDiagnostics(result.warnings ?? [])) {
      const key = `${filename}\0${w.code}\0${createHash("sha256").update(source).digest("hex")}`;
      if (warned.has(key)) continue;
      warned.add(key);
      diagnosticWarnings += count;
      ctx.warn(
        formatDiagnostic({ origin: "compiler", code: w.code, message: w.message, file: filename, line: w.line, column: w.column }, { root }) +
          (count > 1 ? `\n  occurrences: ${count} (same code and file)` : ""),
      );
    }
    // Dev server: boundary names → their module (dev manifest `symbols`).
    if (serve && resume) for (const name of result.boundaries ?? []) derivedDev.set(name, filename);
    if (resume && !server) derivedNames.set(filename, result.boundaries ?? []);
    if (resume && !server && !serve) {
      lazyImports.delete(id);
      for (const spec of _lazyParts(source))
        lazyPending.push(
          ctx.resolve(spec, id).then((target) => {
            if (target && !target.external) (lazyImports.get(id) ?? lazyImports.set(id, new Set()).get(id)!).add(target.id);
          }),
        );
    }
    // ZERO LITE-WIRE: a module with lite residuals gets its lite entry (`\0rivet-lite:<file>.js`, a strict chunk of its own)
    // and the build the lite runtime entry, once; a copy in the lite graph (`?rivet-lite`) emits nothing.
    if (resume && !server && !serve && result.lite && !LITE_QUERY.test(id)) {
      if (!liteEntries.size) ctx.emitFile({ type: "chunk", id: LITE_RUNTIME, name: "lite-runtime", preserveSignature: "strict" });
      if (!liteEntries.has(filename))
        ctx.emitFile({ type: "chunk", id: LITE_PREFIX + filename + ".js", name: basename(filename).replace(/\.[^.]+$/, ""), preserveSignature: "strict" });
      liteEntries.set(filename, result.lite);
    }
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
    const hot = serve && !server ? hotModule(code, moduleId(filename), source) : null;
    // Dev client: where each component is declared, for dev warnings (`<Card> (src/card.tsx:12:17)`).
    const stamps = serve && !server ? sourceStamps(source, displayPath(filename, root), hot ?? code) : "";
    return { code: (hot ?? code) + stamps, map };
  };
  /** Resume options of a resume module: its id (boundary names, keys), the source packages it imports, its verdicts. */
  const resumeOptions = (filename: string, source: string): Partial<CompileOptions> => {
    const sourcePackages = sourcePackagesOf(filename, source);
    // The build's verdicts for this module (absent in dev: the compiler's module-local closure).
    let verdict:
      | {
          boundaries?: string[];
          independent: string[];
          conditional?: string[];
          static?: string[];
          site?: string[];
          sites?: string[];
          free?: string[];
          native?: string[];
        }
      | undefined = derivedVerdicts.get(filename);
    // Dev (no build walk): module-local verdicts, as the walk marks them. A component with keyed state but no own handler
    // (a demo page holding a signal its fields bind) is a boundary, a component without a change source is conditional:
    // else every static instance (a ui QRCode / Status / Chip on a frame) and every field of such a page was a dependent
    // record with no boundary above it, adopted standalone with `{}` props — its first event re-rendered it from the
    // defaults. A `resume.roots` module's default export is independent all the same.
    if (!verdict && serve) {
      const local = devVerdict(filename, source);
      const boundaries = [...local.boundaries],
        conditional = local.conditional;
      const independent = isDerivedRoot(filename) ? [moduleFacts(source, filename).defaultName ?? "default"] : [];
      for (const name of independent) if (!boundaries.includes(name)) boundaries.push(name);
      if (boundaries.length) verdict = { boundaries, independent, conditional };
    } else if (!verdict && isDerivedRoot(filename)) verdict = { independent: [moduleFacts(source, filename).defaultName ?? "default"] };
    return {
      resume: { module: moduleId(filename), ...verdict },
      ...(resume?.incr ? { incr: true } : {}),
      ...(sourcePackages.length ? { sourcePackages } : {}),
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
    // Dev client: resume mode only for dev resume (`resume.dev`: the page adopts its boundaries).
    ...(isResumable(abs(filename)) && (!serve || server || resume?.dev) ? resumeOptions(filename, source) : {}),
    ...(sourceMap ? { sourceMap: true } : {}),
  });
  // Every diagnostic: `[RVnnnn] file:line:col: message` + its `fix:` / `docs:` lines (`diagnostics-format.ts`); the first
  // one's code / docs URL / location / code frame go to the overlay (`frame` set here: Vite's dev context returns an error
  // carrying `pluginCode` unchanged, so it would add neither the frame nor the plugin name), later ones carry their frame
  // in the message. Frames show the file on disk (compiled text may be `prepared`: static icons inlined).
  const fail = (ctx: { error(e: Rollup.RollupError | string): never }, result: CompileResult, filename: string): never => {
    diagnosticErrors += result.diagnostics.length;
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
  // VCLS (`static-class.ts`), production browser builds: a declaring module reads its resolvers lazily; a module that may
  // create an instance without `$cls` (the walk's flags, and any module the walk did not see that imports a family's
  // package) imports the registrations first, on line 1 (later lines and source maps stay put).
  const CLASS_PACKAGE_IMPORT = (name: string): RegExp => {
    const escaped = name.replace(/[.*+?^$()|[\]\\/{}]/g, "\\$&");
    return new RegExp("(?:\\bfrom|\\bimport)\\s*\\(?\\s*[\"']" + escaped + "(?:[\"'/])");
  };
  const classImports = (
    ctx: Rollup.TransformPluginContext,
    original: string,
    id: string,
    options: { ssr?: boolean } | undefined,
    out: Out | Promise<Out> | null | undefined,
  ): Out | Promise<Out> | null | undefined => {
    if (!classState.families.length || !built || serve || id.startsWith("\0" + CLASS_REGISTRY) || id.startsWith("\0rivet-class-")) return out;
    const consumer = ctx.environment?.config?.consumer;
    if (options?.ssr ?? (consumer ? consumer === "server" : ssrBuild)) return out;
    const filename = id.split("?", 1)[0]!;
    if (!id.startsWith("\0") && !/\.[cm]?[jt]sx?$/.test(filename)) return out;
    const lazy = classState.lazy.get(filename);
    let keys = classState.flags.get(filename);
    if (!classState.walked.has(filename)) {
      const net = new Set<string>();
      for (const pkg of classState.packages)
        if (pkg.name ? CLASS_PACKAGE_IMPORT(pkg.name).test(original) : !id.startsWith("\0") && !/[/\\]node_modules[/\\]/.test(filename))
          for (const key of pkg.keys) if (classState.definitions.get(key)?.file !== filename) net.add(key);
      if (net.size) keys = net;
    }
    if (!lazy && !keys?.size) return out;
    return Promise.resolve(out).then((value) => {
      let code = value ? value.code : original;
      if (lazy) code = lazyResolvers(code, lazy, classState.registries.get(lazy.values().next().value!)) ?? code;
      if (keys?.size) code = [...keys].map((key) => `import ${JSON.stringify(CLASS_REG + key)};`).join("") + code;
      return { code, map: value ? value.map : null };
    });
  };
  /** A definition's side-effect imports (`rivet-class-fx:<key>`): its stylesheets, through its re-exports. */
  const classSideEffects = async (ctx: Rollup.PluginContext, file: string, seen = new Set<string>()): Promise<string[]> => {
    if (seen.has(file)) return [];
    seen.add(file);
    const { bare, follow } = sideEffectImports(await readFile(file, "utf8"), file);
    const out: string[] = [];
    for (const spec of bare) {
      const hit = await ctx.resolve(spec, file, { skipSelf: true });
      if (hit && !hit.external) out.push(hit.id);
    }
    for (const spec of follow) {
      const hit = await ctx.resolve(spec, file, { skipSelf: true });
      const next = hit && !hit.external && !hit.id.startsWith("\0") ? hit.id.split("?", 1)[0]! : null;
      if (next && /\.[cm]?[jt]sx?$/.test(next)) out.push(...(await classSideEffects(ctx, next, seen)));
    }
    return out;
  };
  // The module transform (wrapped by `transform`, which adds VCLS's browser-build imports: `classImports`).
  function transformModule(this: Rollup.TransformPluginContext, original: string, id: string, options: { ssr?: boolean } | undefined) {
    const [filename = "", query = ""] = id.split("?", 2);
    if (localeClient(this, options) && !id.startsWith(LOCALE_FULL)) {
      if (original.includes(LOCALE_TABLE_MARK) && /\.[cm]?[jt]s$/.test(filename) && !id.startsWith("\0")) {
        const code = localeRewrite(filename, original);
        if (code !== null) return { code, map: null };
      }
    }
    const annotated = _pureAnnotate(filename, original, query);
    if (annotated !== null) return { code: annotated, map: null };
    // Island facades (`rivet({ bridges })`) are the only virtual modules compiled here.
    const facade = virtual(filename);
    if ((id.startsWith("\0") && !facade) || (/(?:^|[/\\])node_modules[/\\]/.test(filename) && !sourcePackage(filename) && !frameworkJsx(filename))) return null;
    // A `.ts` route module (an endpoint a page imports from): its server exports leave the browser build too.
    const routeScript = /\.[cm]?ts$/.test(filename) && !filename.endsWith(".d.ts") && isRoute(filename);
    // Build-time evaluation of plain script modules (`tv(…)` definitions, constant calls).
    if (!facade && !/\.[jt]sx$/.test(filename) && !routeScript && /\.[cm]?[jt]s$/.test(filename) && !filename.endsWith(".d.ts") && built && !serve)
      return classMerged(this, filename, original, options, comptimeOn() ? comptimeRewrite(this, filename, null, original) : null);
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
    if (params.has("raw") || params.has("url")) return null;
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
      return classMerged(this, filename, original, options, comptimeRewrite(this, filename, { code: split.code, map: split.map ?? null }, original));
    }
    const done = finish(this, filename, source, server, id);
    if (facade) return done;
    // Server output with island facade calls: props that can read a signal become getters (`island-props.ts`, E1), so
    // the bridge sees a live prop instead of a plain JSON value.
    if (server && bridges) {
      const ctx = this,
        api = bridges;
      const live = islandGetters(done.code, async (spec) => {
        const hit = await ctx.resolve(spec, id);
        return !!hit && !hit.external && api.facade(hit.id);
      }).then((code) => (code === null ? done : { code, map: done.map }));
      return classMerged(
        this,
        filename,
        original,
        options,
        live.then((out) => comptimeRewrite(this, filename, out, original)),
      );
    }
    return classMerged(this, filename, original, options, comptimeRewrite(this, filename, done, original));
  }
  return {
    name: "vite-plugin-rivet",
    enforce: "pre",
    api: {
      /** Scripts a dev page loads before `@vite/client`: the DevTools agent when enabled. */
      devtoolsScripts: (): string[] => (tools ? [tools.agentScript(base)] : []),
      /** Dev page scripts of the configured framework bridges (`BridgeEntry.devScripts`: React's Fast Refresh preamble), as URLs. */
      bridgeScripts: (): string[] => (bridges?.devScripts?.() ?? []).map((id) => base + "@id/" + id),
      /** Dev server: resume manifest and symbol descriptions for dev SSR (see `DevResume`). */
      devResume,
      /** `rivet({ serverOnly })`: modules browser code must never import (read by `rivetRouter()`). */
      rivetServerOnly: serverOnly,
      /** ZERO A1: a `resume.shells` entry from a plugin (`file` default export, or `name`), before the build starts. */
      resumeShell: (file: string, name?: string): void => void shellEntries.push(name ? `${file}#${name}` : file),
      resumeHost: (file: string, name?: string): void => void hostEntries.push(name ? `${file}#${name}` : file),
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
      diagnosticLogger = config.logger;
      ssrBuild = Boolean(config.build?.ssr);
      serve = config.command === "serve";
      // Dev always maps (stack traces, debugger); builds when `build.sourcemap` asks for maps.
      sourceMap = serve || Boolean(config.build?.sourcemap);
      root = config.root ?? root;
      base = config.base ?? "/";
      comptimeCache = config.cacheDir;
      built = config.command === "build";
      routed = !!config.plugins?.some((plugin) => plugin.name === "vite-plugin-rivet-router");
      if (patterns.include != null || patterns.exclude != null) selected = createFilter(patterns.include, patterns.exclude, { resolve: root });
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
      declaredLocales = localesOption ?? null;
      // `@rivetjs/i18n/vite`: its catalog locales are the app's.
      for (const plugin of config.plugins ?? [])
        if (plugin.name === "vite-plugin-rivet-i18n")
          declaredLocales ??= (plugin as { api?: { config?: { locales?: readonly string[] } } }).api?.config?.locales ?? null;
    },
    // JS-DIET-2: the lite graph of a one-lite-entry build as one chunk. Vite reads output options before the build, so the
    // group's test reads `liteGroup` (set at `buildEnd`) when Rolldown chunks: empty = it captures nothing. A
    // `codeSplitting: false` build stays as it is. (Added from the `config` hook as `environments.client` options, the group
    // changed other builds' output: the docs motion examples' Tailwind CSS grew.)
    outputOptions(options) {
      if (options.codeSplitting === false) return null;
      const split = typeof options.codeSplitting === "object" ? options.codeSplitting : {};
      return { ...options, codeSplitting: { ...split, groups: [...(split.groups ?? []), { name: "lite", test: (id: string) => liteGroup.has(id) }] } };
    },
    buildEnd() {
      liteGroup.clear();
      if (!serve && !ssrBuild && this.environment?.config?.consumer !== "server" && liteEntries.size === 1) {
        liteGroup.add(LITE_RUNTIME);
        for (const file of liteEntries.keys()) liteGroup.add(LITE_PREFIX + file + ".js");
      }
      if (!serve && (diagnosticErrors || diagnosticWarnings)) diagnosticLogger?.warn(`[rivet:compiler] ${summary(diagnosticErrors, diagnosticWarnings)}`);
    },
    async buildStart() {
      if (!serve) {
        warned.clear();
        diagnosticErrors = diagnosticWarnings = 0;
      }
      if (localeClient(this)) ((localeMarks.length = 0), localeFull.clear());
      // Compiler ↔ runtime ABI handshake (abi.ts), once per plugin instance: the app's resolved runtime.
      if (!abiChecked) {
        abiChecked = true;
        const hit = await this.resolve("@rivetjs/runtime/server", join(root, "index.html"), { skipSelf: true });
        const runtime = hit && !hit.external ? runtimePackage(hit.id.split("?")[0]!) : undefined;
        const problem = runtime && runtimeAbiProblem(runtime);
        if (problem) this.error(problem);
      }
      if (!resume) return;
      if (builtinsId === null) {
        const hit = await this.resolve("@rivetjs/runtime/resume-builtins", join(root, "index.html"), { skipSelf: true });
        builtinsId = hit && !hit.external ? hit.id.split("?")[0]! : "";
      }
      // Verdicts in every build environment (server + client compile with the same boundaries), then the client build
      // emits one chunk per module holding boundaries (its exports = the boundaries' components), the runtime entry and
      // the built-in decoders (`builtins`: route payloads with RegExp / binary / errors / registered classes, DERIVED-S).
      // The loader is inline (no loader module). Dev compiles without the walk (module-local closure).
      if (serve) return;
      await derivedWalk(this);
      if (ssrBuild || this.environment?.config?.consumer === "server") return;
      boundaryEntries.clear();
      liteEntries.clear();
      for (const [file, verdict] of derivedVerdicts)
        if (verdict.boundaries.length && !derivedExtraExports.get(file)) this.emitFile({ type: "chunk", id: file, preserveSignature: "strict" });
        else if (verdict.boundaries.length) {
          const id = BOUNDARY_ENTRY + file;
          boundaryEntries.set(id, file);
          this.emitFile({ type: "chunk", id, name: basename(file).replace(/\.[^.]+$/, ""), preserveSignature: "strict" });
        }
      // Island facades the walk reached without a boundary (an islands-only page): emitted too, so their loaders'
      // island chunks are built and listed in manifest `islands` (the lean boot loads them; the facade chunk stays unused).
      if (bridges)
        for (const [file, verdict] of derivedVerdicts)
          if (!verdict.boundaries.length && bridges.facade(file)) this.emitFile({ type: "chunk", id: file, preserveSignature: "strict" });
      this.emitFile({ type: "chunk", id: DERIVED_ENTRY, name: "derived-runtime", preserveSignature: "strict" });
      if (builtinsId) this.emitFile({ type: "chunk", id: builtinsId, name: "resume-builtins", preserveSignature: "strict" });
      domReaderId = domReaderRef = null;
      if (domDataOn()) {
        const hit = await this.resolve("@rivetjs/runtime/dom-derived-runtime", join(root, "index.html"), { skipSelf: true });
        const file = hit && !hit.external ? hit.id.split("?")[0]! : null;
        const reader = file && join(dirname(file), "dom-data-reader" + file.slice(file.lastIndexOf(".")));
        if (reader && existsSync(reader))
          domReaderRef = this.emitFile({ type: "chunk", id: (domReaderId = reader), name: "dom-data-reader", preserveSignature: "strict" });
      }
    },
    resolveId(id, importer) {
      if (boundaryEntries.has(id)) return id;
      // VCLS: the resolver registry (pure), a family's registration and its definition's side-effect imports.
      if (id === CLASS_REGISTRY || id.startsWith(CLASS_REGISTRY + ":")) return "\0" + id;
      if (id.startsWith(CLASS_REG) || id.startsWith(CLASS_FX)) return { id: "\0" + id, moduleSideEffects: true };
      if (id.startsWith(MOTION_CSS)) return { id: "\0" + id, moduleSideEffects: true };
      if (id.startsWith(LOCALE_FULL)) return id;
      // `@rivetjs/ui`'s merge switch (ZERO UI-JS2): merge everywhere but production browser builds, whatever the
      // environment's conditions (a worker SSR target resolves `browser`); the package `imports` map is the fallback.
      if (id === "#tv-merge" && importer && /[/\\]tv\.[jt]s$/.test(importer.split("?", 1)[0]!) && _UI_TV.test(importer.split("?", 1)[0]!)) {
        const file = importer.split("?", 1)[0]!;
        const client = built && !serve && !ssrBuild && this.environment?.config?.consumer !== "server";
        const target = join(dirname(file), (client ? "merge-off" : "merge-on") + file.slice(file.lastIndexOf(".")));
        if (existsSync(target)) return target;
      }
      // Public `DEV` flag: a build is production whatever its conditions (a `development` condition in a build config,
      // `--mode development`), so `if (DEV) …` in user code always folds away there; the dev server keeps the conditions.
      if (id === "@rivetjs/runtime/dev" && built)
        return this.resolve(id, importer, { skipSelf: true }).then((hit) =>
          hit && !hit.external ? { ...hit, id: hit.id.replace(/([/\\]dev[/\\])flag-on(\.[cm]?[jt]s)$/, "$1flag-off$2") } : hit,
        );
      if (id === LITE_RUNTIME || id === LITE_EMPTY || id.startsWith(LITE_PREFIX)) return id;
      // Lite graph (ZERO LITE-WIRE): an import of a lite module resolves as the ordinary one would (this plugin's aliases
      // included), then names that module's copy; stylesheets → an empty module.
      const liteImporter = !!importer && !serve && (importer === LITE_RUNTIME || importer.startsWith(LITE_PREFIX) || LITE_QUERY.test(importer));
      // Vite's dynamic import preload helper: a copy too (else the lite page loads its shared chunk as a file of its own).
      if (liteImporter && id === PRELOAD_HELPER) return liteCopy(id);
      if (liteImporter && importer && !id.startsWith("\0")) {
        const from =
          importer === LITE_RUNTIME
            ? join(root, "index.html")
            : importer.startsWith(LITE_PREFIX)
              ? importer.slice(LITE_PREFIX.length, -3)
              : importer.replace(LITE_QUERY, "");
        return this.resolve(id, from).then((hit) => {
          if (!hit || hit.external || hit.id.startsWith("\0")) return hit;
          if (LITE_CSS.test(hit.id) || hit.id.split("?", 1)[0]!.endsWith(_STYLE_SUFFIX)) return LITE_EMPTY;
          return { ...hit, id: liteCopy(hit.id) };
        });
      }
      if (id.startsWith(MERGE_PREFIX)) return { id, moduleSideEffects: true };
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
      // The manifest follows this entry to its code-bearing chunk (`_foldFacade`), so a co-load group may move it.
      if (id === DERIVED_ENTRY) return { id, meta: { rivetCoload: liteText.size > 0 } };
      // Builds: `@rivetjs/ui`'s resolver (and project `cn` / `cx` imports, `_mergeOnlyImports`) get tailwind-variants' `cn`
      // without the upstream `tv` runtime (`_pureAnnotate`).
      if ((id === "tailwind-variants" && !serve && importer && _UI_TV.test(importer.split("?")[0]!)) || id === "tailwind-variants" + _MERGE_ONLY)
        return this.resolve("tailwind-variants", importer, { skipSelf: true }).then((resolved) =>
          resolved && !resolved.external && !serve ? resolved.id + _MERGE_ONLY : resolved,
        );
      // Resume builds (DERIVED-C4): every module but the runtime's / reactivity's own makes its signals through the derived
      // alias (server: which boundary made and read each source — the wake lists' dependency facts; browser: adopt runs
      // number their plain signals), `runtime/derived-reactivity.ts` / `server-derived-reactivity.ts`.
      if (resume && (id === "@rivetjs/reactivity" || id === "@rivetjs/reactivity/store") && importer && !RUNTIME_OWN.test(importer.split("?")[0]!)) {
        const server = ssrBuild || this.environment?.config?.consumer === "server";
        if (server)
          return this.resolve(id === "@rivetjs/reactivity" ? "@rivetjs/runtime/server-derived-reactivity" : "@rivetjs/runtime/server-derived-store", importer, {
            skipSelf: true,
          });
        if (id === "@rivetjs/reactivity") return this.resolve("@rivetjs/runtime/derived-reactivity", importer, { skipSelf: true });
      }
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
      return null;
    },
    async load(id) {
      if (id === "\0" + CLASS_REGISTRY || id.startsWith("\0" + CLASS_REGISTRY + ":")) return { code: REGISTRY_SOURCE, moduleSideEffects: false };
      if (id.startsWith("\0" + CLASS_REG) || id.startsWith("\0" + CLASS_FX)) {
        const reg = id.startsWith("\0" + CLASS_REG);
        const key = id.slice((reg ? CLASS_REG : CLASS_FX).length + 1);
        const definition = classState.definitions.get(key);
        if (!definition) this.error(`static class ${key}: no definition in this build`);
        if (reg) return { code: registrationSource(key, definition.file, definition.name, classState.registries.get(key)), moduleSideEffects: true };
        const imports = await classSideEffects(this, definition.file);
        return { code: effectSource(imports, classState.keep.get(key) ?? []), moduleSideEffects: true };
      }
      // MOTION-CSS: one entrance rule (`static-motion.ts`; the walk of this build proved and lowered it).
      if (id.startsWith("\0" + MOTION_CSS)) return motionCss.get(id.slice(MOTION_CSS.length + 1, -4)) ?? "";
      // A locale table whole (its lazy chunk): the table's own source text (pure data).
      if (id.startsWith(LOCALE_FULL)) {
        const hash = id.lastIndexOf("#");
        const file = id.slice(LOCALE_FULL.length, hash);
        const name = id.slice(hash + 1);
        const table = localeFull.get(file + "#" + name) ?? localeTables(await readFile(file, "utf8"), file).find((entry) => entry.name === name);
        if (!table) this.error(`locale table ${name} of ${file} not found`);
        return { code: `export const ${name} = ${entriesText(table.entries)};\n`, moduleSideEffects: false };
      }
      // Build-time evaluation: the override merge provider (registers tailwind-merge for full tv resolvers).
      // Side effects by definition (it registers the merge): never tree-shaken with an importer's `sideEffects: false`.
      if (id.startsWith(MERGE_PREFIX)) {
        const code = await comptimeOn()?.loadMerge(id);
        return code ? { code, moduleSideEffects: true } : null;
      }
      const boundarySource = boundaryEntries.get(id);
      if (boundarySource !== undefined) {
        // Through Vite's pipeline first: the DOM compile records the boundary export names (`derivedNames`).
        const info = await this.load({ id: boundarySource });
        // Only names the compiled module exports (a local boundary without an export alias has no chunk export to keep).
        const own = new Set(info.exports ?? []);
        const exports = [...new Set((derivedNames.get(boundarySource) ?? []).map((name) => name.slice(name.lastIndexOf("#") + 1)))].filter((name) =>
          own.has(name),
        );
        const from = JSON.stringify(boundarySource);
        return exports.length
          ? `export { ${exports.map((name) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name))).join(", ")} } from ${from};\n`
          : `import ${from};\n`;
      }
      if (id === LITE_RUNTIME) return 'export { default } from "@rivetjs/runtime/dom-lite";\n';
      if (id === LITE_EMPTY) return { code: "", moduleSideEffects: false };
      if (id.startsWith(LITE_PREFIX)) return liteEntries.get(id.slice(LITE_PREFIX.length, -3))?.code ?? "";
      // RT-DIET: the lite graph's dynamic imports are its rare paths only (the fallback runtime, a boundary's ordinary
      // module `<Name>$c`): no dependency preloading, so the always-loaded lite runtime chunk carries no preload helper
      // (~1.4 KB min). Same signature as Vite's (`load`, deps, importer URL): the import itself, unchanged.
      if (id === liteCopy(PRELOAD_HELPER)) return "export const __vitePreload = (load) => load();\n";
      const clean = id.split("?", 1)[0]!;
      const client = !ssrBuild && this.environment?.config?.consumer !== "server";
      // Resume builds: the browser runtime ships the adopt run's switches (`DERIVED` `_for` hook + `LAZY_ROWS` adopt hooks).
      if (resume && client) {
        const code = derivedSwitch(clean);
        if (code !== null) return code;
      }
      if (id === DERIVED_ENTRY) return 'export { default } from "@rivetjs/runtime/dom-derived-runtime";\n';
      // `resume.domData` (DERIVED-C5): the browser reader (`DOM_DATA` in `dom-derived.ts`) and the server's list registry +
      // `d` encoder (`dom-data-derived.ts` → `server-derived-dom.ts`); the resume manifest says so when the reader loaded.
      if (domDataOn()) {
        const code = domDataSwitch(clean);
        if (code !== null) {
          if (code.includes("DOM_DATA") && client) domDataIn = true;
          // A client build: the emitted reader chunk's URL (dev / tests: the module next to the switch).
          if (code.includes("DOM_READER") && client && domReaderRef)
            return `export const DOM_DATA = true;\nexport const DOM_READER = import.meta.ROLLUP_FILE_URL_${domReaderRef};\n`;
          return code;
        }
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
      return null;
    },
    // Locale tables: the kept entries and languages, now that every client module's literals are known.
    renderChunk(code) {
      if (!localeMarks.length || !code.includes("__rivet_l")) return null;
      const languages = localeLanguages();
      const list = JSON.stringify([...languages].sort());
      const next = code
        .replace(
          /\.\.\.\s*\(?\s*(["'`])__rivet_lt_(\d+)__\1\s*\)?/g,
          (_, _quote, index: string) => "..." + entriesText(keptEntries(localeMarks[+index]!.table, languages)),
        )
        .replace(/(["'`])__rivet_ll_(\d+)__\1/g, () => list);
      if (/__rivet_l[lt]_\d+__/.test(next)) this.error("locale table markers left in a chunk (locale-tables.ts)");
      return { code: next, map: null };
    },
    // Post: chunk code is final (Vite's preload helpers rewritten), so sizes match the emitted files.
    generateBundle: {
      order: "post",
      async handler(_options, bundle) {
        if (ssrBuild || this.environment?.config?.consumer === "server") return;
        if (joinsRecord && joinsDir) {
          const data: JoinsFile = { v: 1, joins: [...joinsRecord.joins].sort(), needed: [...joinsRecord.needed].sort(), all: joinsRecord.all };
          writeFileSync(join(joinsDir, JOINS_FILE), JSON.stringify(data) + "\n");
        }
        _hintEagerCompile(bundle, (output) => output.isEntry);
        if (!resume) return;
        await Promise.all(lazyPending.splice(0));
        derivedManifest.call(this, bundle);
      },
    },
    transform(original, id, options) {
      return classImports(this, original, id, options, transformModule.call(this, original, id, options));
    },
    async closeBundle() {
      // The last environment's bundle closes the evaluator (a later build of this plugin instance makes a new one).
      const pass = comptime;
      comptime = null;
      await pass?.close();
      const classes = classEvaluator;
      classEvaluator = null;
      await classes?.close();
    },
    // T6: a deleted (or renamed away) module drops its dev caches — sheet, last client code, dev boundary names.
    watchChange(id, change) {
      if (change.event !== "delete") return;
      sheets.delete(id);
      clientCode.delete(id);
      devVerdicts.delete(id);
      for (const [name, file] of derivedDev) if (file === id) derivedDev.delete(name);
    },
    // css`` edits that leave the compiled module unchanged update only its stylesheet.
    async hotUpdate({ file, modules, read }) {
      // A framework source edit (E16): importers re-importing it under `?t=` would run a second copy
      // beside the page's; reload the page instead.
      const client = this.environment.config.consumer !== "server";
      if (client && modules.length && frameworkSource(file)) {
        this.environment.hot.send({ type: "full-reload" });
        return [];
      }
      // Dev resume: a resume module edit reloads the page (adopted boundaries are not hot-replaced; the server environment
      // still invalidates its modules, so the reload renders the new code), except a css``-only edit: only its sheet updates.
      // With the router the page's dev entry decides (`entry.dev.tsx`: a resumed page reloads, one switched to client
      // rendering — DevTools inspection — hot-replaces in place).
      const reload = resume?.dev && client && !routed && modules.length > 0 && isResumable(file);
      const full = () => {
        this.environment.hot.send({ type: "full-reload" });
        return [];
      };
      if (!sheets.has(file)) return reload ? full() : undefined;
      const graph = this.environment.moduleGraph;
      const sheet = [...(graph.getModulesByFile(file + _STYLE_SUFFIX) ?? [])];
      const source = prepared(file, await read());
      // Same options as the transform (resume mode included), so an unchanged module compiles identically.
      const result = compile(source, moduleOptions(file, source, !client));
      if (result.diagnostics.length || result.css === undefined) return reload ? full() : undefined;
      sheets.set(file, result.css);
      if (!sheet.length) return reload ? full() : undefined;
      for (const module of sheet) graph.invalidateModule(module);
      if (!client) return [...modules, ...sheet];
      const unchanged = clientCode.get(file) === result.code;
      clientCode.set(file, result.code);
      if (!unchanged && reload) return full();
      return unchanged ? sheet : [...modules, ...sheet];
    },
  };
}
