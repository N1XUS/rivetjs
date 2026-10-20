// Vite plugins for a docs site: content routes generated before the router scans `src/routes`, and
// the `virtual:docs/*` modules the kit's components and routes import, mapped onto the app's files.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { Plugin, Rollup, ViteDevServer } from "vite";
import { docsContent } from "./tools/content/plugin.ts";
import { docsDevSearch } from "./tools/dev-search.ts";
import { CSS_DIR, EXAMPLES_JSON, FRAMES_DIR, FRAMES_INDEX, SHARED_ASSETS } from "./tools/examples.ts";
import { frameStyleLists, mergeFrameStyles } from "./tools/frame-styles.ts";

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
/**
 * `rivetRouter({ resume: { lazyOwned } })` for a docs app: the example-frame registry (`virtual:docs/example-frames` →
 * `src/generated/example-frames.tsx`, one `import()` per example) is imported by the frame route; its targets load
 * through the route's own loader, never by prefetch — listed as chunk lazies they made a route-mode frame page
 * prefetch every example (ROUTE-CHUNKS placed parts, 2026-10-18).
 */
export const DOCS_LAZY_OWNED: readonly string[] = [FRAMES_INDEX];
/**
 * `rivetRouter({ resume: { preload: { rules } } })` for a docs app: the frame controls (theme menu, mobile drawer) and the
 * cdk components they (and the search dialog) are built on load on intent (pointer / focus). Hover handlers of cdk
 * components would otherwise make the planner prefetch ~39 cdk modules once visible. With `chunks: "route"` these modules
 * also leave the eager main chunk (its intent sibling, `route:main:intent`) and the page fetch-ahead (`data-fo`): a docs
 * page boots and fetches ~150 KB instead of ~500 KB with cdk collections (DOCS-JS, 2026-10-20).
 * The router's generated App (`.rivet/app.tsx`: route tables of every page, link interception, router client) is only
 * used from a link intent / click (docs pages navigate with full loads): its own intent chunk `route:main:intent:router`
 * (`resume-route_main-router`), out of the eager shell (−37 KB route tables + ~25 KB router client per page) and apart
 * from the frame menus (DOCS-COLD, 2026-10-20).
 */
export const DOCS_PRELOAD_RULES: readonly { match: string; strategy: "intent"; chunk?: string }[] = [
  { match: ".rivet/app.tsx#", strategy: "intent", chunk: "router" },
  { match: "@rivetjs/cdk/", strategy: "intent" },
  { match: "@rivetjs/docs-kit/components/ThemeMenu.tsx#", strategy: "intent" },
  { match: "@rivetjs/docs-kit/components/MobileMenu.tsx#", strategy: "intent" },
  { match: "@rivetjs/docs-kit/components/SiteFrame.tsx#", strategy: "intent" },
];
/** Dev server: the frame stylesheet lookup the SSR module calls (`docsFrames` installs it). */
const DEV_FRAME_STYLES = Symbol.for("rivet.docs.frameStyles");

/**
 * `virtual:docs/*` → app files. Large generated data is never a module on the server: `examples` (examples.json: every
 * example's code) and `api` (api.json) are parsed from disk while pages render (bundling a 70 MB examples module /
 * 8 MB api.json cost the site build tens of GB, 2026-10-08). In a client build `examples` is an empty object (its
 * code is server-rendered; pages navigate with full loads) and `api` an empty model (API pages have no browser code:
 * bundled, api.json was a 4.9 / 7.2 MB client chunk (cdk-docs / ui-docs) the App chunk imported, and 0.1–0.3 GB of
 * the client build's memory, 2026-10-09); the dev client gets the files (a page renders in the browser after a hot update).
 */
function docsModules(): Plugin {
  let root = process.cwd();
  let dev = false;
  return {
    name: "rivet-docs-modules",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
      dev = config.command === "serve";
    },
    resolveId(source) {
      if (!source.startsWith("virtual:docs/")) return null;
      const name = source.slice("virtual:docs/".length);
      const server = this.environment?.config.consumer === "server";
      if (name === "frame-styles") return FRAME_STYLES + (server ? "" : "?client");
      const file = FILES[name];
      if (!file) throw new Error(`docs-kit: unknown module ${source}`);
      if ((name === "examples" || name === "api") && server) return FROM_DISK + name;
      if (name === "examples") return EXAMPLES_CLIENT;
      if (name === "api" && !dev) return API_CLIENT;
      return resolve(root, file);
    },
    load(id) {
      if (id === EXAMPLES_CLIENT)
        return dev ? `import examples from ${JSON.stringify(resolve(root, EXAMPLES_JSON))};\nexport { examples };` : "export const examples = {};";
      if (id === API_CLIENT) return "export default { entries: [], symbols: [] };";
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
 * Docs-kit plugins: put them before `rivetRouter(...)`. `docsContent` generates content routes and the example frames
 * before the router scans; `docsBrand` resolves its module before `docsModules` rejects unknown names; `docsFrames`
 * links each frame page's stylesheets; `docsDevSearch` serves `/pagefind/*` on the dev server (in-memory index).
 */
export function docsSite(): Plugin[] {
  return [docsWatch(), docsContent(), docsBrand(), docsModules(), docsFrames(), docsDevSearch()];
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
