// TypeScript language service plugin: the Rivet compiler's view of each TSX file inside every
// TS-based editor (VS Code, WebStorm, typescript-language-server / vtsls). Thin adapter over
// @rivetjs/language-core; tsserver loads the CommonJS bundle (`dist/index.cjs`, see build.ts).
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type TS from "typescript";
import {
  FIXABLE_CODES,
  LINK_MODULES,
  analyzeFile,
  codeFixes,
  createLanguageCore,
  doctor,
  findCompiler,
  internalPath,
  linkTargets,
  matchRoute,
  nodeAt,
  routeCompletion,
  viteRoot,
  workspaceCompilerWasm,
  type CheckDiagnostic,
  type CheckSite,
  type EditorRoute,
  type FileCheck,
  type LanguageCore,
  type ProjectManifest,
} from "@rivetjs/language-core";

export interface PluginConfig {
  /** Modules whose `Link` export takes a route path in `to` (default the router's). */
  linkModules?: string[];
  /** Resume inlay hints: `client` (browser-only closures, default), `all`, or off. */
  inlayHints?: "client" | "all" | false;
  /** Type-aware checks: RV3101 route-link warnings (default on). */
  typeAware?: boolean;
  /** Absolute path of a `rivet_compiler.wasm` to use instead of the workspace's / bundled one. */
  compilerWasm?: string;
}

/** tsserver codes are numbers: RVxxxx → 7xxxx (a range TypeScript itself does not use). */
const CODE = (code: string) => 70000 + Number(code.slice(2));
/** Numeric codes with quick fixes (tsserver asks fixes by code). */
const FIX_NUMBERS = new Set(FIXABLE_CODES.map(CODE));

/** Bundled compiler next to the CommonJS bundle (absent when running from source). */
const bundledWasm = (): string | null => (typeof __dirname === "string" ? join(__dirname, "rivet_compiler.wasm") : null);

/** Language cores by compiler module (tsserver runs every project in one process; projects of
 * different workspaces may resolve different compilers). Keyed by path + mtime: a rebuilt or newly
 * installed wasm is picked up, a failed load is retried once the file changes. */
const cores = new Map<string, { mtime: number; core: LanguageCore | null }>();

function loadCore(wasm: string, log: (message: string) => void): LanguageCore | null {
  let mtime: number;
  try {
    mtime = statSync(wasm).mtimeMs;
  } catch {
    return null;
  }
  const hit = cores.get(wasm);
  if (hit && hit.mtime === mtime) return hit.core;
  const compiler = findCompiler([wasm], log);
  if (compiler) log(`rivet: compiler ${compiler.wasm}`);
  const core = compiler && createLanguageCore({ compiler });
  cores.set(wasm, { mtime, core });
  return core;
}

function init({ typescript: ts }: { typescript: typeof TS }): TS.server.PluginModule {
  let globalConfig: PluginConfig = {};
  const projects = new WeakSet<TS.server.Project>();
  /** Projects with the plugin applied (diagnostics refreshed on configuration changes). */
  const live = new Set<TS.server.Project>();
  /** Compiler candidates per project directory + `compilerWasm` (module resolution is not free). */
  const candidates = new Map<string, (string | null)[]>();
  let sessionHandlers = false;

  const coreFor = (project: TS.server.Project, config: PluginConfig): LanguageCore | null => {
    const dir = project.getCurrentDirectory();
    const key = (config.compilerWasm ?? "") + "\0" + dir;
    let list = candidates.get(key);
    if (!list) candidates.set(key, (list = [config.compilerWasm ?? null, workspaceCompilerWasm(dir), bundledWasm()]));
    const log = (message: string) => project.projectService.logger.info(message);
    for (const wasm of list) {
      const core = wasm && loadCore(wasm, log);
      if (core) return core;
    }
    return null;
  };

  return {
    create(info) {
      const ls = info.languageService;
      const project = info.project;
      projects.add(project);
      live.add(project);
      const config = (): PluginConfig => ({ ...(info.config as PluginConfig), ...globalConfig });
      const active = () => project.getCompilerOptions().jsxImportSource === "@rivetjs/runtime";
      const log = (message: string) => project.projectService.logger.info("rivet: " + message);
      const guard = <T>(fallback: T, run: () => T): T => {
        try {
          return run();
        } catch (error) {
          log(`internal error: ${(error as Error).stack ?? error}`);
          return fallback;
        }
      };
      /** Rivet file context, or null when the plugin has nothing to add. `result` compiles on first
       * read (cached per text): route-link features never pay for a compile. */
      const context = (fileName: string) => {
        if (!active()) return null;
        const core = coreFor(project, config());
        const program = ls.getProgram();
        const file = program?.getSourceFile(fileName);
        if (!core || !program || !file || !core.isRivetFile(fileName)) return null;
        let result: FileCheck | undefined;
        return {
          core,
          program,
          file,
          get result(): FileCheck {
            return (result ??= core.check(fileName, file.text));
          },
        };
      };

      const linkModules = () => config().linkModules ?? LINK_MODULES;
      const links = (file: TS.SourceFile, checker: TS.TypeChecker, position?: number) => linkTargets(ts, file, checker, linkModules(), position);
      const routeFor = (fileName: string, href: string): { project: ProjectManifest; route: EditorRoute; params: Record<string, string> } | null => {
        const core = coreFor(project, config());
        const manifest = core?.project(fileName);
        const path = internalPath(href);
        if (!manifest?.manifest.routes?.length || path === null) return null;
        const match = matchRoute(manifest.manifest.routes, path);
        return match && { project: manifest, ...match };
      };

      /** Every Rivet diagnostic for a file (compiler + RV3010 + RV3101), TS duplicates dropped. */
      const rivetDiagnostics = (fileName: string): { file: TS.SourceFile; diagnostics: CheckDiagnostic[]; result: FileCheck } | null => {
        const ctx = context(fileName);
        if (!ctx) return null;
        const { typeAware, linkModules } = config();
        return {
          file: ctx.file,
          ...analyzeFile(ts, ctx.core, ctx.program, ctx.file, { ...(typeAware === undefined ? {} : { typeAware }), ...(linkModules ? { linkModules } : {}) }),
        };
      };

      const proxy: TS.LanguageService = Object.create(null);
      for (const key of Object.keys(ls) as (keyof TS.LanguageService)[]) {
        const method = ls[key];
        (proxy as unknown as Record<string, unknown>)[key] = typeof method === "function" ? (method as Function).bind(ls) : method;
      }

      proxy.getSemanticDiagnostics = (fileName) => {
        const prior = ls.getSemanticDiagnostics(fileName);
        return guard(prior, () => {
          const found = rivetDiagnostics(fileName);
          if (!found) return prior;
          // `preload` values are typed too (jsx-runtime): keep TypeScript's error only.
          const ours = found.diagnostics.filter(
            (d) => !(d.code === "RV1102" && prior.some((p) => p.start !== undefined && p.start >= d.start && p.start < d.end)),
          );
          return [
            ...prior,
            ...ours.map((d): TS.Diagnostic => ({
              file: found.file,
              start: d.start,
              length: Math.max(0, d.end - d.start),
              messageText: d.message,
              category: d.severity === "warning" ? ts.DiagnosticCategory.Warning : ts.DiagnosticCategory.Error,
              code: CODE(d.code),
              source: "rivet",
            })),
          ];
        });
      };

      proxy.getCodeFixesAtPosition = (fileName, start, end, errorCodes, formatOptions, preferences) => {
        const prior = ls.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences);
        if (!errorCodes.some((code) => FIX_NUMBERS.has(code))) return prior;
        return guard(prior, () => {
          const found = rivetDiagnostics(fileName);
          if (!found) return prior;
          const fixes = found.diagnostics
            .filter((d) => errorCodes.includes(CODE(d.code)) && d.start <= end && d.end >= start)
            .flatMap((d) => codeFixes(ts, found.file, d))
            .map((fix): TS.CodeFixAction => ({
              fixName: fix.fixName,
              description: fix.description,
              changes: [{ fileName, textChanges: fix.edits.map((e) => ({ span: { start: e.start, length: e.end - e.start }, newText: e.newText })) }],
            }));
          return [...prior, ...fixes];
        });
      };

      if (ls.getSupportedCodeFixes)
        proxy.getSupportedCodeFixes = (fileName?: string) => [...ls.getSupportedCodeFixes!(fileName), ...[...FIX_NUMBERS].map(String)];

      proxy.provideInlayHints = (fileName, span, preferences) => {
        const prior = ls.provideInlayHints(fileName, span, preferences);
        const mode = config().inlayHints ?? "client";
        if (!mode) return prior;
        return guard(prior, () => {
          const ctx = context(fileName);
          if (!ctx?.result.sites.length) return prior;
          const hints = ctx.result.sites
            .filter((site) => (mode === "all" || site.runsOn === "client") && site.start >= span.start && site.start <= span.start + span.length)
            .map((site): TS.InlayHint => ({
              text: siteLabel(site),
              position: site.start,
              kind: ts.InlayHintKind.Type,
              whitespaceAfter: true,
            }));
          return [...prior, ...hints];
        });
      };

      proxy.getQuickInfoAtPosition = (fileName, position, ...rest) => {
        const prior = (ls.getQuickInfoAtPosition as (...args: unknown[]) => TS.QuickInfo | undefined)(fileName, position, ...rest);
        return guard(prior, () => {
          const ctx = context(fileName);
          if (!ctx) return prior;
          const docs: string[] = [];
          let span: TS.TextSpan | undefined;
          for (const site of ctx.result.sites)
            if (position >= site.anchorStart && position < site.anchorEnd) {
              docs.push(siteDoc(site));
              span ??= { start: site.anchorStart, length: site.anchorEnd - site.anchorStart };
            }
          const node = nodeAt(ts, ctx.file, position, position);
          if (node && ts.isIdentifier(node)) {
            const by = ctx.result.sites.filter((site) =>
              site.captures.some((c) => c.name === node.text && (c.start === node.getStart(ctx.file) || (position >= site.start && position < site.end))),
            );
            if (by.length) docs.push(`**Rivet** · \`${node.text}\` is captured by resumable code (${by.map((s) => `\`${s.name || s.kind}\``).join(", ")}).`);
          }
          const [link] = links(ctx.file, ctx.program.getTypeChecker(), position);
          if (link) {
            const match = routeFor(fileName, link.literal.text);
            if (match) {
              const params = Object.entries(match.params)
                .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                .join(", ");
              docs.push(`**Rivet route** \`${match.route.id}\` (\`${match.route.pattern}\`) · ${match.route.file}${params ? ` · params ${params}` : ""}`);
              span ??= { start: link.literal.getStart(ctx.file), length: link.literal.end - link.literal.getStart(ctx.file) };
            }
          }
          if (!docs.length) return prior;
          const documentation: TS.SymbolDisplayPart[] = [...(prior?.documentation ?? []), ...docs.map((text) => ({ kind: "text", text: "\n\n" + text }))];
          return prior
            ? { ...prior, documentation }
            : { kind: ts.ScriptElementKind.unknown, kindModifiers: "", textSpan: span ?? { start: position, length: 0 }, displayParts: [], documentation };
        });
      };

      proxy.getCompletionsAtPosition = (fileName, position, options, formatting) => {
        const prior = ls.getCompletionsAtPosition(fileName, position, options, formatting);
        return guard(prior, () => {
          const ctx = context(fileName);
          if (!ctx) return prior;
          const [link] = links(ctx.file, ctx.program.getTypeChecker(), position);
          const routes = ctx.core.routes(fileName);
          if (!link || link.narrowed || !routes.length) return prior;
          const replacementSpan = { start: link.literal.getStart(ctx.file) + 1, length: link.literal.end - link.literal.getStart(ctx.file) - 2 };
          const seen = new Set(prior?.entries.map((e) => e.name));
          const entries: TS.CompletionEntry[] = [];
          for (const route of routes) {
            const { path, complete } = routeCompletion(route);
            if (seen.has(path)) continue;
            seen.add(path);
            entries.push({
              name: path,
              kind: ts.ScriptElementKind.string,
              kindModifiers: "",
              sortText: complete ? "0" : "1",
              replacementSpan,
              labelDetails: { description: route.id },
            });
          }
          if (prior) return { ...prior, entries: [...prior.entries, ...entries] };
          return { isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: true, entries };
        });
      };

      proxy.getDefinitionAndBoundSpan = (fileName, position) => {
        const prior = ls.getDefinitionAndBoundSpan(fileName, position);
        return guard(prior, () => {
          const ctx = context(fileName);
          if (!ctx) return prior;
          const [link] = links(ctx.file, ctx.program.getTypeChecker(), position);
          const match = link && routeFor(fileName, link.literal.text);
          if (!link || !match) return prior;
          const start = link.literal.getStart(ctx.file);
          return {
            textSpan: { start, length: link.literal.end - start },
            definitions: [
              ...(prior?.definitions ?? []),
              {
                fileName: ctx.core.routeFile(match.project, match.route),
                textSpan: { start: 0, length: 0 },
                kind: ts.ScriptElementKind.moduleElement,
                name: match.route.id,
                containerKind: ts.ScriptElementKind.unknown,
                containerName: "",
              },
            ],
          };
        });
      };

      // Editor-extension requests (VS Code: `typescript.tsserverRequest`), registered once per session.
      if (info.session && !sessionHandlers) {
        sessionHandlers = true;
        const projectOf = (file: string) => info.project.projectService.getDefaultProjectForFile(ts.server.toNormalizedPath(file), false);
        info.session.addProtocolHandler("_rivet:sites", (request) => {
          const file = (request.arguments as { file: string }).file;
          const owner = projectOf(file);
          const source = owner?.getLanguageService().getProgram()?.getSourceFile(file);
          const core = owner && coreFor(owner, config());
          const result =
            source && core?.isRivetFile(file) && owner!.getCompilerOptions().jsxImportSource === "@rivetjs/runtime" ? core.check(file, source.text) : null;
          // `label`: the inlay hint text (VS Code renders hints natively from it, see apps/vscode).
          const sites = (result?.sites ?? []).map((site) => ({ ...site, label: siteLabel(site) }));
          return { responseRequired: true, response: { resume: result?.resume ?? false, sites } };
        });
        info.session.addProtocolHandler("_rivet:doctor", (request) => {
          const file = (request.arguments as { file: string }).file;
          const owner = projectOf(file);
          const options = owner?.getCompilerOptions() ?? {};
          const configured = owner?.projectKind === ts.server.ProjectKind.Configured ? owner.getProjectName() : undefined;
          const findings = doctor({
            fileName: file,
            configFile: configured,
            jsx: options.jsx === undefined ? undefined : ts.JsxEmit[options.jsx]?.toLowerCase(),
            jsxImportSource: options.jsxImportSource,
            tsVersion: ts.version,
            pluginLoaded: Boolean(owner && projects.has(owner)),
            project: (owner && coreFor(owner, config())?.project(file)) ?? null,
          });
          return { responseRequired: true, response: { findings } };
        });
      }
      return proxy;
    },

    /** Generated `.rivet/*.d.ts` (route types) join app projects whose tsconfig does not include them:
     * the `.rivet/` of each app (Vite root) the project's Rivet files belong to, and the tsconfig's own. */
    getExternalFiles(project) {
      if (project.getCompilerOptions().jsxImportSource !== "@rivetjs/runtime" || project.projectKind !== ts.server.ProjectKind.Configured) return [];
      const roots = new Set([dirname(project.getProjectName())]);
      const byDir = new Map<string, string | null>();
      for (const name of project.getRootFiles() ?? []) {
        if (!/\.[jt]sx$/.test(name) || /[/\\]node_modules[/\\]/.test(name)) continue;
        const dir = dirname(name);
        let root = byDir.get(dir);
        if (root === undefined) byDir.set(dir, (root = viteRoot(name)));
        if (root) roots.add(root);
      }
      return [...roots].flatMap((root) => {
        const dir = join(root, ".rivet");
        if (!existsSync(dir)) return [];
        try {
          return readdirSync(dir)
            .filter((name) => name.endsWith(".d.ts"))
            .map((name) => join(dir, name));
        } catch {
          return [];
        }
      });
    },

    /** Editor settings (VS Code `configurePlugin`) over tsconfig plugin config; re-runs diagnostics of
     * every open Rivet project (inlay hints / hovers read the config per request). */
    onConfigurationChanged(config: PluginConfig) {
      globalConfig = { ...globalConfig, ...config };
      candidates.clear();
      for (const project of live) {
        if (project.isClosed()) live.delete(project);
        else project.refreshDiagnostics();
      }
    },
  };
}

const KIND: Record<CheckSite["kind"], string> = {
  event: "event handler",
  attr: "attribute binding",
  bind: "text binding",
  region: "component region",
  model: "model binding",
  ref: "ref callback",
  effect: "clientEffect",
  clientEvent: "clientEvent",
  computed: "computed",
  equals: "equals comparator",
  fn: "local function",
  slot: "slot content",
  spread: "spread attributes",
  props: "live props",
};

/** Inlay hint: where it runs and what it captures. */
function siteLabel(site: CheckSite): string {
  const where = site.runsOn === "client" ? "client" : "server+client";
  const names = site.captures.map((c) => c.name);
  return names.length ? `${where} · ${names.length > 3 ? names.slice(0, 3).join(", ") + ", …" : names.join(", ")}` : where;
}

function siteDoc(site: CheckSite): string {
  const where =
    site.runsOn === "client"
      ? "runs only in the browser after the page resumes"
      : "runs during server rendering and again in the browser when its reads change";
  const captures = site.captures.length
    ? site.captures
        .map(
          (c) =>
            `\`${c.name}\`${c.kind === "fn" ? " (local function → symbol)" : c.kind === "ref" ? " (element ref)" : c.kind === "cell" ? " (shared let cell)" : ""}`,
        )
        .join(", ")
    : "nothing";
  const symbol = site.id ? ` \`${site.id}\`` : "";
  return `**Rivet resume** · ${KIND[site.kind]}${symbol} · ${where} · captures ${captures}`;
}

export default init;
