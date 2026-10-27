// Editor-agnostic Rivet language features over source text + `.rivet/editor.json`: compiler
// diagnostics (both targets, resume mode per manifest), resume sites, routes. Hosts (tsserver
// plugin, `rivet check`, a future LSP) are thin adapters over this module.
import { resolve } from "node:path";
import type TS from "typescript";
import { docsUrl } from "@rivetjs/compiler/codes";
import type { CheckDiagnostic, CheckSite, Compiler } from "./compiler.ts";
import { linkDiagnostics } from "./links.ts";
import { ManifestCache, moduleId, type EditorRoute, type ProjectManifest } from "./manifest.ts";
import { isRouteModule, untaggedServerExports } from "./server-exports.ts";
import { selfWrites } from "./self-write.ts";
import { sourcePackagesOf } from "./sources.ts";

export * from "./compiler.ts";
export * from "./manifest.ts";
export * from "./routes.ts";
export * from "./fixes.ts";
export * from "./doctor.ts";
export * from "./links.ts";
export * from "./explain.ts";
export * from "./server-exports.ts";
export * from "./self-write.ts";

export interface FileCheck {
  diagnostics: CheckDiagnostic[];
  /** Resume sites (resume-compiled files only). */
  sites: CheckSite[];
  /** Resume-compiled (per manifest). */
  resume: boolean;
  /** Root-relative module id (resume boundary name prefix); null without a manifest. */
  moduleId: string | null;
  project: ProjectManifest | null;
}

export interface LanguageCore {
  readonly compiler: Compiler;
  /** Files the Rivet Vite plugin compiles (`.tsx`/`.jsx` outside node_modules). */
  isRivetFile(fileName: string): boolean;
  /** Compiler view of one file; cached until its text or manifest changes. */
  check(fileName: string, text: string): FileCheck;
  project(fileName: string): ProjectManifest | null;
  /** File routes of the file's app (empty without a manifest or router). */
  routes(fileName: string): readonly EditorRoute[];
  /** Absolute page module of a route. */
  routeFile(project: ProjectManifest, route: EditorRoute): string;
}

/** Never resume-compiled by the build: test files (not in a page graph) and bridge-owned island modules (adapter suffixes). */
const NOT_RESUME_FILE = /\.(test|spec|react|preact|solid|vue|svelte)\.[jt]sx$/;
/** A `@jsxImportSource` pragma naming another runtime: a framework bridge owns the module (pragma ownership). */
const FOREIGN_JSX = /@jsxImportSource\s+(?!@rivetjs\/runtime\b)[\w@]/;

/** Files whose last check result a core keeps (least recently checked evicted first). */
export const CHECK_CACHE_SIZE = 500;

export function createLanguageCore({ compiler, manifests = new ManifestCache() }: { compiler: Compiler; manifests?: ManifestCache }): LanguageCore {
  // Insertion order = recency (a hit is re-inserted); bounded: tsserver lives as long as the editor.
  const cache = new Map<string, { text: string; project: ProjectManifest | null; result: FileCheck }>();
  return {
    compiler,
    isRivetFile: (fileName) => /\.[jt]sx$/.test(fileName) && !/[/\\]node_modules[/\\]/.test(fileName),
    check(fileName, text) {
      const project = manifests.find(fileName);
      const hit = cache.get(fileName);
      if (hit) cache.delete(fileName);
      if (hit && hit.text === text && hit.project === project) {
        cache.set(fileName, hit);
        return hit.result;
      }
      const id = project ? moduleId(project.root, fileName) : null;
      // A resume app (its manifest lists resume seeds) compiles every Rivet file of the app in resume mode: the manifest names
      // the seeds (route modules), the build walks the resume graph from them, so an imported component module is checked
      // like a route (RV2001 in `src/components/*.tsx`; D2 2026-10-27). Not resume: test files (`*.test.tsx` /
      // `*.spec.tsx`, never in the page graph) and modules a framework bridge owns (`*.react.tsx`, a foreign pragma).
      const resume = Boolean(id && project!.manifest.resumeModules?.length && !NOT_RESUME_FILE.test(fileName) && !FOREIGN_JSX.test(text.slice(0, 2048)));
      const sourcePackages = resume ? sourcePackagesOf(fileName, text) : [];
      const { diagnostics, sites } = compiler.check(text, {
        filename: fileName,
        ...(resume ? { resume: { module: id! } } : {}),
        ...(sourcePackages.length ? { sourcePackages } : {}),
      });
      const result: FileCheck = { diagnostics, sites, resume, moduleId: id, project };
      cache.set(fileName, { text, project, result });
      if (cache.size > CHECK_CACHE_SIZE) cache.delete(cache.keys().next().value!);
      return result;
    },
    project: (fileName) => manifests.find(fileName),
    routes: (fileName) => manifests.find(fileName)?.manifest.routes ?? [],
    routeFile: (project, route) => resolve(project.root, route.file),
  };
}

export interface AnalyzeOptions {
  /** Type-aware checks: RV3101 route links (default true; false skips them). */
  typeAware?: boolean;
  /** Modules whose `Link` takes route paths (default the router's). */
  linkModules?: readonly string[];
}

/** Every Rivet diagnostic of a program file (compiler + RV3010 + RV1017 + RV3101), as the editor shows them. */
export function analyzeFile(
  ts: typeof TS,
  core: LanguageCore,
  program: TS.Program,
  file: TS.SourceFile,
  options: AnalyzeOptions = {},
): { diagnostics: CheckDiagnostic[]; result: FileCheck } {
  const result = core.check(file.fileName, file.text);
  let diagnostics = result.diagnostics;
  // TypeScript reports syntax errors itself, with better recovery.
  if (program.getSyntacticDiagnostics(file).length) diagnostics = diagnostics.filter((d) => d.code !== "RV1000");
  const manifest = result.project?.manifest;
  // RV3010: route modules only (the build's `serverExports` compile pass; the editor compiles without it).
  if (manifest && isRouteModule(result.project!.root, manifest.routesDir, file.fileName)) diagnostics = [...diagnostics, ...untaggedServerExports(ts, file)];
  // RV1017: signal self-writes in tracked scopes (type-aware: the program's checker decides what a signal is).
  const writes = selfWrites(ts, file, program.getTypeChecker());
  if (writes.length) diagnostics = [...diagnostics, ...writes];
  if (manifest?.routes && options.typeAware !== false)
    diagnostics = [
      ...diagnostics,
      ...linkDiagnostics(ts, file, program.getTypeChecker(), manifest.routes, {
        ...(options.linkModules ? { modules: options.linkModules } : {}),
        routesDir: manifest.routesDir,
      }),
    ];
  // Every code links its docs page (`@rivetjs/compiler/codes` registry). Line/column from the UTF-16
  // offset with TypeScript's line rules (CR-only, U+2028/U+2029 line breaks; the compiler counts `\n`).
  diagnostics = diagnostics.map((d) => {
    const at = d.line !== undefined && d.start <= file.text.length ? file.getLineAndCharacterOfPosition(d.start) : null;
    const position = at ? { line: at.line + 1, column: at.character + 1 } : {};
    return { ...d, ...position, docs: d.docs ?? docsUrl(d.code) };
  });
  return { diagnostics, result };
}
