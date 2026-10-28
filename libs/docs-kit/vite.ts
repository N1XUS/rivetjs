// Vite plugins for a docs site: content routes generated before the router scans `src/routes`, and
// the `virtual:docs/*` modules the kit's components and routes import, mapped onto the app's files.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, Rollup, ViteDevServer } from "vite";
import { _hintEagerCompile, serverOnlyStub } from "@rivetjs/compiler/vite";
import { kit } from "@rivetjs/kit/vite";
import { docsContent } from "./tools/content/plugin.ts";
import { docsDevSearch } from "./tools/dev-search.ts";
import { CSS_DIR, EXAMPLES_JSON, FRAME_SHELLS, FRAMES_DIR, FRAMES_INDEX, SHARED_ASSETS } from "./tools/examples.ts";
import { frameStyleLists, mergeFrameStyles } from "./tools/frame-styles.ts";
import type { StubParts } from "./page-stub.ts";

/** `virtual:docs/<name>` → file relative to the app root. */
const FILES: Record<string, string> = {
  site: "site.config.ts",
  "api-config": "api.config.ts",
  nav: "src/generated/nav.ts",
  pages: "src/generated/pages.ts",
  examples: EXAMPLES_JSON,
  "example-frames": FRAMES_INDEX,
  starters: "src/generated/starters.ts",
  api: "src/generated/api.json",
};

/** Server copies of generated data, read from disk while pages render (never transformed or bundled as modules). */
const FROM_DISK = "\0virtual:docs/disk:";
const EXAMPLES_CLIENT = "\0virtual:docs/examples-client";
const API_CLIENT = "\0virtual:docs/api-client";
const FRAME_STYLES = "\0virtual:docs/frame-styles";
/** Client build asset: example id → its frame page's stylesheet URLs (`docsFrames`). */
export const FRAME_STYLES_FILE = ".vite/docs-frame-styles.json";
/** Dev server: the frame stylesheet lookup the SSR module calls (`docsFrames` installs it). */
const DEV_FRAME_STYLES = Symbol.for("rivet.docs.frameStyles");

/**
 * `virtual:docs/*` → app files. Large generated data is never a module on the server: `examples` (examples.json: every
 * example's code) and `api` (api.json) are parsed from disk while pages render (bundling a 70 MB examples module /
 * 8 MB api.json cost the site build tens of GB, 2026-10-08). In a client build `examples` is an empty object (a
 * generated page's own records come from `examples?ids=…`, a module of just those; hand-written routes use loaders) and `api` an empty model (API pages have no browser code:
 * bundled, api.json was a 4.9 / 7.2 MB client chunk (cdk-docs / ui-docs) the App chunk imported, and 0.1–0.3 GB of
 * the client build's memory, 2026-10-09); the dev client gets the files (a page renders in the browser after a hot update).
 * `api` is declared server-only (`api.rivetServerOnly`, SERVER-REACH): the router renders the API routes (their pages
 * read it) as document routes, a component reaching it fails the build (RV3011), and the client build's stand-in throws
 * on use (`serverOnlyStub`) instead of an empty model.
 */
function docsModules(): Plugin {
  let root = process.cwd();
  let dev = false;
  // Client build: the first importer of `virtual:docs/api` (named by the stand-in's error).
  let apiImporter: string | undefined;
  return {
    name: "rivet-docs-modules",
    enforce: "pre",
    api: { rivetServerOnly: ["virtual:docs/api"] },
    configResolved(config) {
      root = config.root;
      dev = config.command === "serve";
    },
    resolveId(source, importer) {
      if (!source.startsWith("virtual:docs/")) return null;
      const name = source.slice("virtual:docs/".length);
      const server = this.environment?.config.consumer === "server";
      // `examples?ids=a,b` (ZERO Z9): a generated page's own examples. Server: the whole disk-backed manifest (one
      // module for every page); client build: a module of just those records (the page chunk carries them, not the
      // route payload); dev client: the whole file, as `examples`.
      if (name.startsWith("examples?ids=")) return server ? FROM_DISK + "examples" : dev ? EXAMPLES_CLIENT : EXAMPLES_CLIENT + name.slice("examples".length);
      if (name === "frame-styles") return FRAME_STYLES + (server ? "" : "?client");
      const file = FILES[name];
      if (!file) throw new Error(`docs-kit: unknown module ${source}`);
      if ((name === "examples" || name === "api") && server) return FROM_DISK + name;
      if (name === "examples") return EXAMPLES_CLIENT;
      if (name === "api" && !dev) return ((apiImporter ??= importer), API_CLIENT);
      return resolve(root, file);
    },
    load(id) {
      if (id.startsWith(EXAMPLES_CLIENT + "?ids=")) {
        const file = resolve(root, EXAMPLES_JSON);
        this.addWatchFile(file);
        const all = examplesOnDisk(file);
        const ids = id
          .slice(EXAMPLES_CLIENT.length + "?ids=".length)
          .split(",")
          .map(decodeURIComponent);
        // Only what `<Example>` renders (`ExampleView`): no summary / tags / status / pages / test steps / usedOn.
        const view = (e: Record<string, unknown>) => Object.fromEntries(VIEW_FIELDS.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]));
        return `export const examples = ${JSON.stringify(Object.fromEntries(ids.filter((key) => all[key]).map((key) => [key, view(all[key] as Record<string, unknown>)])))};`;
      }
      if (id === EXAMPLES_CLIENT)
        return dev ? `import examples from ${JSON.stringify(resolve(root, EXAMPLES_JSON))};\nexport { examples };` : "export const examples = {};";
      if (id === API_CLIENT) return serverOnlyStub("virtual:docs/api", apiImporter ? [relative(root, apiImporter.split("?")[0]!).split(sep).join("/")] : []);
      if (!id.startsWith(FROM_DISK)) return null;
      const name = id.slice(FROM_DISK.length);
      const file = resolve(root, FILES[name]!);
      // An edit (regenerated examples, a new api.json) invalidates this module like the file itself.
      this.addWatchFile(file);
      const parsed = `JSON.parse(readFileSync(${JSON.stringify(file)}, "utf8"))`;
      return [`import { readFileSync } from "node:fs";`, name === "api" ? `export default ${parsed};` : `export const examples = ${parsed};`].join("\n");
    },
  };
}

/** The `ExampleData` fields `components/Example.tsx` renders (`ExampleView`). */
const VIEW_FIELDS = ["title", "height", "auto", "phone", "codeOnly", "files"] as const;
/** examples.json parsed once per (path, mtime): every generated page's `examples?ids=` module reads it (client build). */
const examplesCache = new Map<string, { mtime: number; data: Record<string, unknown> }>();
function examplesOnDisk(file: string): Record<string, unknown> {
  const mtime = statSync(file).mtimeMs;
  const hit = examplesCache.get(file);
  if (hit && hit.mtime === mtime) return hit.data;
  const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  examplesCache.set(file, { mtime, data });
  return data;
}

const CSS_REQUEST = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
const NOT_LINKED = /[?&](?:inline|url|raw)\b/;

/**
 * Example frames (`components/frame.tsx`): each frame page links its example's stylesheets only (the closure of the
 * example's frame module: its group stylesheet, CSS its components import), never the docs'. `virtual:docs/frame-styles`
 * `frameStyles(id)`: build = the client bundle's lists (`FRAME_STYLES_FILE`, read by the server bundle at render),
 * dev = the SSR module graph of the frame module (`?direct` links, like the router's route CSS). Also resolves an
 * example's relative `src/assets/<path>` it does not have to the shared `examples/_assets/<path>`.
 */
function docsFrames(): Plugin {
  let root = process.cwd();
  let clientOut = "";
  const framesDir = () => resolve(root, FRAMES_DIR) + sep;
  const idOf = (file: string | null | undefined) => {
    const path = file?.split("?")[0];
    return path?.startsWith(framesDir()) && path.endsWith(".tsx") ? path.slice(framesDir().length, -".tsx".length) : undefined;
  };
  return {
    name: "rivet-docs-frames",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
      const out = config.environments?.client?.build?.outDir ?? config.build.outDir;
      clientOut = isAbsolute(out) ? out : resolve(root, out);
      // ZERO A1: pages that render in `FrameShell` (`FRAME_SHELLS`, written by `generateExamples`) and `FrameShell` itself
      // are never adopted by a host: the compiler drops their slot markers unless their own boundaries need them.
      const api = config.plugins.find((plugin) => plugin.name === "vite-plugin-rivet")?.api as
        { resumeShell?: (file: string, name?: string) => void; resumeHost?: (file: string, name?: string) => void } | undefined;
      const list = resolve(root, FRAME_SHELLS);
      if (api?.resumeShell && existsSync(list)) {
        api.resumeShell(FRAME_ROOT, "FrameShell");
        // ZERO CALLSITE: a frame page renders under `FrameShell` or `FrameRoot` only (`components/frame-page.tsx`).
        api.resumeHost?.(FRAME_ROOT, "FrameShell");
        api.resumeHost?.(FRAME_ROOT);
        for (const file of JSON.parse(readFileSync(list, "utf8")) as string[]) api.resumeShell(resolve(root, file));
      }
    },
    async resolveId(source, importer) {
      if (!importer || !source.startsWith(".")) return null;
      const examples = resolve(root, "examples") + sep;
      if (!importer.startsWith(examples)) return null;
      const [path, query] = source.split(/(?=[?#])/, 2) as [string, string | undefined];
      const target = resolve(dirname(importer.split("?")[0]!), path);
      const rel = relative(examples, target).split(sep);
      // examples/<id>/src/assets/<path> → examples/_assets/<path> when the example has no such file.
      if (rel.length < 4 || rel[1] !== "src" || rel[2] !== "assets" || existsSync(target)) return null;
      const shared = resolve(examples, SHARED_ASSETS, ...rel.slice(3));
      return existsSync(shared) ? shared + (query ?? "") : null;
    },
    transform(code, id) {
      // Frame pages render without the docs app's client router (`components/frame-page.tsx`), and their document
      // without the docs' document prefetch (speculation rules for docs pages).
      const file = id.split("?")[0]!;
      const only = framesOnly();
      if (only) {
        // `check-examples`: a build of the chosen frames only (no docs pages, other frames out of the graph).
        const fail = (message: string) => this.error(message);
        if (file.endsWith(`${sep}.rivet${sep}routes.ts`)) return onlyFrameRoutes(code, fail);
        if (file.endsWith(`${sep}.rivet${sep}app.tsx`)) return onlyFramePages(code, fail);
        if (file === resolve(root, FRAMES_INDEX)) return onlyFrames(code, only, fail);
      }
      if (file.endsWith(`${sep}.rivet${sep}entry.dev.tsx`)) return frameDevEntry(code, (message) => this.error(message));
      if (!file.endsWith(`${sep}.rivet${sep}entry.server.tsx`)) return null;
      // The document: `documentPrefetch(shell, …)` with `rivetRouter({ prefetch })`, else a re-export of the shell.
      const reexport = /^export \{ default as document \} from ("[^"]+");$/m;
      if (!/^export function page\(/m.test(code) || !(/^export const document = /m.test(code) || reexport.test(code)))
        this.error("docs-kit: unexpected .rivet/entry.server.tsx shape");
      return (
        code
          .replace(/^export function page\(/m, "function routerPage(")
          .replace(/^export const document = /m, "const routedDocument = ")
          .replace(reexport, "import shell from $1;\nconst routedDocument = shell;") +
        [
          "",
          "// docs-kit (vite.ts docsFrames): example frame pages render without the client router.",
          'import { framePageOf as _framePageOf } from "@rivetjs/docs-kit/components/frame-page.tsx";',
          'import { frameIdOf as _frameIdOf } from "@rivetjs/docs-kit/frame-theme.ts";',
          "export function page(input: PageInput) {",
          "  return _framePageOf(input) ?? routerPage(input);",
          "}",
          "export const document: typeof routedDocument = (input) => (_frameIdOf(input.url.pathname) ? shell(input) : routedDocument(input));",
          "",
        ].join("\n")
      );
    },
    load(id) {
      if (id === FRAME_STYLES + "?client") return "export const frameStyles = () => [];";
      if (id !== FRAME_STYLES) return null;
      if (this.environment.mode === "dev") return `export const frameStyles = (id) => globalThis[Symbol.for("rivet.docs.frameStyles")]?.(id) ?? [];`;
      const file = resolve(clientOut, FRAME_STYLES_FILE);
      return [
        `import { readFileSync } from "node:fs";`,
        "let styles;",
        `export const frameStyles = (id) => (styles ??= JSON.parse(readFileSync(${JSON.stringify(file)}, "utf8")))[id] ?? [];`,
      ].join("\n");
    },
    configureServer(server: ViteDevServer) {
      (globalThis as Record<symbol, unknown>)[DEV_FRAME_STYLES] = async (id: string) => {
        const graph = server.environments.ssr.moduleGraph;
        const css: string[] = [];
        const seen = new Set<string>();
        const visit = (node: { id: string | null; url: string; importedModules: Set<unknown> } | undefined) => {
          if (!node?.id || seen.has(node.id)) return;
          seen.add(node.id);
          for (const imported of node.importedModules) visit(imported as typeof node);
          if (CSS_REQUEST.test(node.url) && !NOT_LINKED.test(node.url)) {
            const href = node.url + (node.url.includes("?") ? "&" : "?") + "direct";
            if (!css.includes(href)) css.push(href);
          }
        };
        visit(graph.getModuleById(resolve(root, FRAMES_DIR, id + ".tsx")) as Parameters<typeof visit>[0]);
        return css;
      };
    },
    generateBundle(_options, bundle) {
      if (this.environment.config.consumer !== "client") return;
      const base = this.environment.config.base ?? "/";
      const chunks = Object.values(bundle).filter((output): output is Rollup.OutputChunk => output.type === "chunk");
      // The chunk holding each wrapper module (its facade, or merged into another chunk).
      const holders = new Map<string, Rollup.OutputChunk>();
      for (const chunk of chunks)
        for (const module of chunk.moduleIds) {
          const id = idOf(module);
          if (id && (!holders.has(id) || chunk.facadeModuleId === module)) holders.set(id, chunk);
        }
      // Group sheet + ONE merged component sheet per frame (`tools/frame-styles.ts`).
      const groupDir = resolve(root, CSS_DIR) + sep;
      const { frames: styles, assets } = mergeFrameStyles(bundle, frameStyleLists(chunks, holders, base), base, (chunk) =>
        chunk.moduleIds.some((module) => module.split("?")[0]!.startsWith(groupDir)),
      );
      for (const asset of assets) this.emitFile({ type: "asset", fileName: asset.fileName, source: asset.source });
      this.emitFile({ type: "asset", fileName: FRAME_STYLES_FILE, source: JSON.stringify(styles) + "\n" });
    },
  };
}

/** The Rivet logo (repo root `logo.svg`): one source for every site's brand mark and favicon. */
const LOGO = resolve(import.meta.dirname, "../../logo.svg");
const BRAND = "\0virtual:docs/brand";

/**
 * `virtual:docs/brand` (`logo`: URL of the logo) and the logo file itself: emitted into the client
 * build as `assets/logo-<content hash>.svg` (immutable cache like every asset), served at the same
 * URL by the dev server.
 */
function docsBrand(): Plugin {
  const source = readFileSync(LOGO);
  const file = `assets/logo-${createHash("sha256").update(source).digest("hex").slice(0, 8)}.svg`;
  return {
    name: "rivet-docs-brand",
    enforce: "pre",
    resolveId(id) {
      return id === "virtual:docs/brand" ? BRAND : null;
    },
    load(id) {
      if (id !== BRAND) return null;
      this.addWatchFile(LOGO);
      return `export const logo = ${JSON.stringify("/" + file)};`;
    },
    configureServer(server) {
      server.middlewares.use("/" + file, (_req, res) => {
        res.setHeader("Content-Type", "image/svg+xml");
        res.end(source);
      });
    },
    generateBundle() {
      if (this.environment.config.consumer === "client") this.emitFile({ type: "asset", fileName: file, source });
    },
  };
}

/** The docs page script (ZERO Z13): `components/page-script.ts` (highlighter, search shortcuts, TOC spy), a plain module script. */
const PAGE_SCRIPT = realpathSync(fileURLToPath(new URL("./components/page-script.ts", import.meta.url)));
/**
 * The page script's lazy chrome parts (THEME-JS 2026-10-28): button selector → the module `page-script.ts` imports for it
 * (same selectors there). The stub (`page-stub.ts`) preloads a part's closure on an event on its button.
 */
const CHROME_PARTS = (
  [
    [".theme-button[data-chrome]", "./components/theme-menu-open.tsx"],
    [".menu-button[data-chrome]", "./components/mobile-menu-open.tsx"],
    [".search-button", "./search/dialog.tsx"],
  ] as const
).map(([selector, file]): [selector: string, file: string] => [selector, realpathSync(fileURLToPath(new URL(file, import.meta.url)))]);

/**
 * `SCRIPTS_FILE` `parts` (THEME-JS): per chrome part, its chunk + that chunk's static imports, transitively (what the
 * page script's `import()` preloads), minus the page script's own closure (preloaded with it); URLs deduped across parts
 * (`StubParts`). A part without a chunk (not built, tree-shaken) is left out.
 */
export function chromeParts(
  chunks: readonly Rollup.OutputChunk[],
  page: string,
  parts: readonly (readonly [selector: string, file: string])[],
  base: string,
): StubParts {
  const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const closure = (file: string, into: string[], skip: ReadonlySet<string>) => {
    const seen = new Set<string>();
    for (const stack = [file]; stack.length;) {
      const next = stack.pop()!;
      if (seen.has(next) || skip.has(next)) continue;
      seen.add(next);
      into.push(next);
      stack.push(...[...(byFile.get(next)?.imports ?? [])].reverse());
    }
    return into;
  };
  const pageChunk = chunks.find((chunk) => chunk.facadeModuleId === page);
  const loaded = new Set(pageChunk ? closure(pageChunk.fileName, [], new Set()) : []);
  const urls: string[] = [];
  const lists: StubParts["lists"] = [];
  for (const [selector, file] of parts) {
    const chunk = chunks.find((output) => output.facadeModuleId === file);
    if (!chunk) continue;
    const files = closure(chunk.fileName, [], loaded).map((name) => {
      const url = base + name;
      const index = urls.indexOf(url);
      return index < 0 ? urls.push(url) - 1 : index;
    });
    lists.push([selector, files]);
  }
  return { urls, lists };
}
const SCRIPTS = "\0virtual:docs/scripts";
/** Client build asset: `{ page: url, routes: { [pathname]: url } }` of the emitted scripts, read by the server bundle at render. */
export const SCRIPTS_FILE = ".vite/docs-scripts.json";

/** `docsSite()` options. */
export interface DocsSiteOptions {
  /**
   * Plain module scripts of single pages (DOCS-FAST): page path → module (relative to the Vite root), e.g.
   * `{ "/": "src/components/home/intro.ts" }`. Each is its own entry chunk (`assets/docs-route-<n>-<hash>.js`, no resume
   * runtime); `document.ts` links it on that page only, `fetchpriority="low"` (visible effects that must not compete
   * with the page's first paint).
   */
  scripts?: Record<string, string>;
}

/**
 * `virtual:docs/scripts` (`pageScript()`: URL of the docs page script, `routeScript(pathname)`: URL of that page's own
 * script (`DocsSiteOptions.scripts`), or undefined): the client build emits `components/page-script.ts` and every page
 * script as its own entry chunk (`assets/docs-page-<hash>.js`; not resume chunks, the page needs no runtime for them)
 * and writes `SCRIPTS_FILE`; the server bundle reads that file; the dev server serves the sources (`/@fs/…`).
 * `document.ts` links the page script on every docs page (not example frames).
 */
function docsScripts(routes: Record<string, string> = {}): Plugin {
  let clientOut = "";
  let dev = false;
  let base = "/";
  let files: [path: string, file: string][] = [];
  return {
    name: "rivet-docs-scripts",
    enforce: "pre",
    configResolved(config) {
      dev = config.command === "serve";
      base = config.base ?? "/";
      clientOut = resolve(config.root, config.environments?.client?.build?.outDir ?? config.build.outDir);
      files = Object.entries(routes).map(([path, file]) => [path, realpathSync(resolve(config.root, file))]);
    },
    resolveId(id) {
      return id === "virtual:docs/scripts" ? SCRIPTS + (this.environment?.config.consumer === "server" ? "" : "?client") : null;
    },
    load(id) {
      if (id === SCRIPTS + "?client")
        return "export const pageScript = () => undefined;\nexport const pageScriptImports = () => [];\nexport const pageScriptParts = () => ({ urls: [], lists: [] });\nexport const routeScript = (_path) => undefined;";
      if (id !== SCRIPTS) return null;
      if (dev)
        return [
          `export const pageScript = () => ${JSON.stringify(base + "@fs" + PAGE_SCRIPT)};`,
          "export const pageScriptImports = () => [];",
          "export const pageScriptParts = () => ({ urls: [], lists: [] });",
          `const routes = ${JSON.stringify(Object.fromEntries(files.map(([path, file]) => [path, base + "@fs" + file])))};`,
          "export const routeScript = (path) => routes[path];",
        ].join("\n");
      const file = resolve(clientOut, SCRIPTS_FILE);
      return [
        `import { existsSync, readFileSync } from "node:fs";`,
        "let scripts;",
        `const read = () => (scripts ??= existsSync(${JSON.stringify(file)}) ? JSON.parse(readFileSync(${JSON.stringify(file)}, "utf8")) : {});`,
        "export const pageScript = () => read().page;",
        "export const pageScriptImports = () => read().pageImports ?? [];",
        "export const pageScriptParts = () => read().parts ?? { urls: [], lists: [] };",
        "export const routeScript = (path) => read().routes?.[path];",
      ].join("\n");
    },
    buildStart() {
      if (dev || this.environment?.config.consumer !== "client") return;
      this.emitFile({ type: "chunk", id: PAGE_SCRIPT, name: "docs-page" });
      files.forEach(([, file], index) => this.emitFile({ type: "chunk", id: file, name: `docs-route-${index}` }));
    },
    generateBundle(_options, bundle) {
      if (this.environment.config.consumer !== "client") return;
      const chunks = Object.values(bundle).filter((output): output is Rollup.OutputChunk => output.type === "chunk");
      const url = (file: string) => {
        const chunk = chunks.find((output) => output.facadeModuleId === file);
        return chunk ? base + chunk.fileName : undefined;
      };
      const page = url(PAGE_SCRIPT);
      // The page script's static imports (the preload helper): `document.ts`'s stub preloads them with the script, so
      // the first intent waits one round trip, not two (DOCS-ZERO).
      const imports = chunks.find((output) => output.facadeModuleId === PAGE_SCRIPT)?.imports.map((file) => base + file) ?? [];
      const scripts = Object.fromEntries(files.flatMap(([path, file]) => (url(file) ? [[path, url(file)]] : [])));
      // The lazy chrome parts' closures (THEME-JS): the stub preloads one on an event on its button, with the script.
      const parts = chromeParts(chunks, PAGE_SCRIPT, CHROME_PARTS, base);
      if (page) this.emitFile({ type: "asset", fileName: SCRIPTS_FILE, source: JSON.stringify({ page, pageImports: imports, parts, routes: scripts }) + "\n" });
    },
  };
}

/**
 * The dev server does not watch build output inside the app root (`dist/`, `.artifacts/`): a build next to
 * `serve --dev` writes thousands of files, and chokidar's FSEvents handler took the event loop (docs pages hung,
 * heap grew until OOM, 2026-10-08).
 */
function docsWatch(): Plugin {
  return {
    name: "rivet-docs-watch",
    config: () => ({ server: { watch: { ignored: ["**/.artifacts/**", "**/dist/**"] } } }),
  };
}

/**
 * Client chunking (SEARCH-CHUNK 2026-10-27): Shiki and its dependencies (not the grammars: each stays its own lazy
 * chunk) go to a chunk of their own, `highlighter-core-<hash>.js`, that the lazy `components/highlighter.ts` entry
 * imports. Rolldown merges its runtime (`__exportAll`, the helper behind every namespace object) into an entry chunk
 * that already uses it; Shiki's `property-information` namespace import made that the 189 KB highlighter entry, so
 * every chunk with a namespace object (merged route / boundary facades, the search palette) imported the highlighter
 * statically — 202 docs chunks, the palette's cold open 223 KB. Out of an entry, the runtime stays its own
 * 187 B `rolldown-runtime` chunk.
 *
 * Site chrome (ZERO ABI-SPLIT 2026-10-27): the live theme menu / mobile drawer chunks (`components/theme-menu-open.tsx`,
 * `mobile-menu-open.tsx`, fetched on pointer / focus intent) and their static imports carry the V8 eager-compile hint
 * (`_hintEagerCompile`): their functions compile while the module loads on hover, not lazily inside the press that
 * opens the cdk menu (warm theme click, 4× CPU: V8 CompileCode ~13 ms of the pointerdown).
 */
function docsChunks(): Plugin {
  const shiki = /[\\/]node_modules[\\/](?:shiki|@shikijs)[\\/]/;
  const grammar = /[\\/]langs[\\/]/;
  const chrome = /[\\/]docs-kit[\\/]components[\\/](?:theme|mobile)-menu-open\.tsx$/;
  return {
    name: "rivet-docs-chunks",
    config: () => ({
      environments: {
        client: {
          build: {
            rolldownOptions: { output: { codeSplitting: { groups: [{ name: "highlighter-core", test: (id) => shiki.test(id) && !grammar.test(id) }] } } },
          },
        },
      },
    }),
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        if (this.environment?.config?.consumer === "server") return;
        _hintEagerCompile(bundle, (output) => chrome.test(output.facadeModuleId!));
      },
    },
  };
}

/**
 * Docs-kit plugins: put them before `rivetRouter(...)`. `docsContent` generates content routes and the example frames
 * before the router scans; `docsBrand` resolves its module before `docsModules` rejects unknown names; `docsFrames`
 * links each frame page's stylesheets; `docsDevSearch` serves `/pagefind/*` on the dev server (in-memory index).
 */
/**
 * `components/frame.tsx`, whose default export (`FrameRoot`) is an example frame page's independent root boundary (frame
 * pages that take props): list it in `rivetRouter({ resume: { roots: [FRAME_ROOT] } })` next to `docsSite()`.
 */
export const FRAME_ROOT = realpathSync(fileURLToPath(new URL("./components/frame.tsx", import.meta.url)));

/**
 * The kit Vite plugin's font loader only, for the docs fonts' `?font` imports (`fonts.ts`): renamed, since the router
 * turns component head on when it sees `vite-plugin-rivet-kit` (docs pages keep route `head` exports, the early head),
 * and without kit's client aliases (`@rivetjs/kit` → `/dom`, `@rivetjs/runtime/image` → `/image/dom`), so the sites'
 * bundles resolve as before.
 */
function docsFonts(): Plugin {
  const base = kit();
  const resolveId = base.resolveId as Extract<Plugin["resolveId"], (...args: never[]) => unknown>;
  return {
    ...base,
    name: "rivet-docs-fonts",
    resolveId(id, importer, options) {
      return id === "@rivetjs/kit" || id === "@rivetjs/runtime/image" ? null : resolveId.call(this, id, importer, options);
    },
  };
}

export function docsSite(options: DocsSiteOptions = {}): Plugin[] {
  return [docsWatch(), docsChunks(), docsContent(), docsBrand(), docsScripts(options.scripts), docsModules(), docsFrames(), docsDevSearch(), docsFonts()];
}

/**
 * Dev server, browser: the router's `.rivet/entry.dev.tsx` on example frame URLs. A frame client-renders through
 * `components/frame-dev-mount.tsx` (its graph is the example's own: no docs layout, nav or `.rivet/app.tsx`), only
 * for hot updates of its own modules (`frameUpdate`), and ignores `rivet:data` (docs routes' server edits): content /
 * nav regeneration by other edits must not re-render, reset or reload open frames.
 */
export function frameDevEntry(code: string, fail: (message: string) => never): string {
  const mounter = 'const mounter = () => import("./dev-mount.tsx");';
  const update = 'payload.updates.some((update) => update.type === "js-update" && ';
  const data = 'hot.on("rivet:data", () => resumed && location.reload());';
  if (!code.includes(mounter) || !code.includes(update) || !code.includes(data)) fail("docs-kit: unexpected .rivet/entry.dev.tsx shape");
  return (
    'import { frameIdOf as _frameIdOf, frameUpdate as _frameUpdate } from "@rivetjs/docs-kit/frame-theme.ts";\n' +
    "const _frame = _frameIdOf(location.pathname) !== undefined;\n" +
    code
      .replace(mounter, 'const mounter = () => (_frame ? import("@rivetjs/docs-kit/components/frame-dev-mount.tsx") : import("./dev-mount.tsx"));')
      .replace(update, update + "(!_frame || _frameUpdate(update.path)) && ")
      .replace(data, 'hot.on("rivet:data", () => resumed && !_frame && location.reload());')
  );
}

/** Env var of a frames-only build (`tools/check-examples.ts`): comma-separated example ids. */
export const FRAMES_ONLY_ENV = "DOCS_KIT_FRAMES_ONLY";
const FRAME_ROUTE = /^examples\/\[id\]\/frame\//;

function framesOnly(): Set<string> | undefined {
  const ids = process.env[FRAMES_ONLY_ENV];
  return ids ? new Set(ids.split(",").filter(Boolean)) : undefined;
}

/** Frames-only build: the router's `.rivet/routes.ts` keeps the example frame routes (one route per line). */
export function onlyFrameRoutes(code: string, fail: (message: string) => never): string {
  let kept = 0;
  const out = code
    .split("\n")
    .filter((line) => {
      const route = /^  (?:\{ id: |)"([^"]+)"(?:,|: once\()/.exec(line);
      if (!route) return true;
      const frame = FRAME_ROUTE.test(route[1]!);
      kept += frame ? 1 : 0;
      return frame;
    })
    .join("\n");
  if (kept === 0) fail("docs-kit: frames-only build: no example frame route in .rivet/routes.ts");
  return out;
}

/** Frames-only build: `.rivet/app.tsx` page imports other than the frame routes reject (indices kept). */
export function onlyFramePages(code: string, fail: (message: string) => never): string | null {
  // Also the router's resume pieces of the module (`rivet-resume-chunk:…/app.tsx?App`): only those holding page imports.
  if (!code.includes('import("../src/routes/')) return null;
  let kept = 0;
  const out = code.replace(/\(\) => import\("\.\.\/src\/routes\/([^"]+)\.tsx"\)/g, (all, route: string) => {
    if (FRAME_ROUTE.test(route)) return (kept++, all);
    return '() => Promise.reject(new Error("docs-kit: frames-only build"))';
  });
  if (kept === 0) fail("docs-kit: frames-only build: no example frame page in .rivet/app.tsx");
  return out;
}

/** Frames-only build: the generated frames index keeps the `ids` (one example per line). */
export function onlyFrames(code: string, ids: ReadonlySet<string>, fail: (message: string) => never): string {
  const found = new Set<string>();
  const out = code
    .split("\n")
    .filter((line) => {
      const entry = /^  "([^"]+)": \{ paths: /.exec(line);
      if (!entry) return true;
      if (ids.has(entry[1]!)) found.add(entry[1]!);
      return ids.has(entry[1]!);
    })
    .join("\n");
  const missing = [...ids].filter((id) => !found.has(id));
  if (missing.length) fail(`docs-kit: frames-only build: no live example ${missing.join(", ")}`);
  return out;
}
