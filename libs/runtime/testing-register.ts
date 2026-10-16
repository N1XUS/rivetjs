// `node --import @rivetjs/runtime/testing/register --test` preload: `.tsx`/`.jsx` modules compile through
// the Rivet compiler (needs `@rivetjs/compiler` installed), so component tests run without a bundler.
// Target: DOM by default. Server for `*.server.test.{ts,tsx,js,jsx,mts,mjs}` files and every
// `.tsx`/`.jsx` module they (transitively, through `.tsx`/`.jsx` modules and relative `.ts`/`.mts` imports,
// e.g. an `index.ts` barrel) import, or for the whole process with `RIVET_TEST_TARGET=server`. Package
// specifiers are never tagged, so runtime singletons (`@rivetjs/reactivity`, …) load once. Server-graph
// modules carry a `?rivet-target=server` URL query, so a process can hold both compilations of one component.
// DOM-target modules compile as the Vite plugin compiles client modules (DOM v2, the only DOM lowering).
// Stylesheet imports (`import "./x.css"`, e.g. `@rivetjs/ui` component CSS) load as empty modules, as a bundler
// would hand them to its CSS pipeline: node has no CSS loader (ERR_UNKNOWN_FILE_EXTENSION).
// Resume mode (`?rivet-resume=server|dom|chunk`, `@rivetjs/runtime/testing/resume`): the module compiles with
// `resume: { module: <workspace-root-relative path> }` for the server or the browser, carried to its relative `.tsx`/`.jsx`
// imports; `chunk` is its browser symbol module (`_compileSymbolModule`, importing the `dom` compilation). Server
// compilations record module id → file URL and symbol id → capture names for `serializeAndRevive`.
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative as relativePath, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as compiler from "@rivetjs/compiler";
import { compile } from "@rivetjs/compiler";
import { formatDiagnostic } from "@rivetjs/compiler/format";

// Compiler warnings already printed (file, position, message): once per process, never dropped.
const warned = new Set<string>();

const jsx = /\.[jt]sx$/;
const ts = /\.m?ts$/;
const relative = /^\.{1,2}\//;
const serverTest = /\.server\.test\.[cm]?[jt]sx?$/;
const query = "rivet-target";
const everyServer = process.env.RIVET_TEST_TARGET === "server";

const resumeQuery = "rivet-resume";
type ResumeSymbol = { id: string; labels?: string[]; captures: string[] };
const resumeCompiler = compiler as unknown as {
  compile(source: string, options: object): { code: string; diagnostics: { message: string; line?: number; column?: number; filename?: string }[]; symbols: ResumeSymbol[] };
  _compileSymbolModule(symbols: ResumeSymbol[], from: string): string;
};
const registry = (): { modules: Map<string, string>; captures: Map<string, readonly string[]> } =>
  ((globalThis as { [key: symbol]: never })[Symbol.for("rivet.testing.resume")] ??= { modules: new Map(), captures: new Map() } as never);

const isServer = (url: URL) => everyServer || url.searchParams.get(query) === "server" || serverTest.test(url.pathname);

registerHooks({
  resolve(specifier, context, next) {
    const result = next(specifier, context);
    if (!context.parentURL?.startsWith("file:") || !result.url.startsWith("file:")) return result;
    const url = new URL(result.url);
    const resume = new URL(context.parentURL).searchParams.get(resumeQuery);
    if (resume === "server" || resume === "dom") {
      if (!jsx.test(url.pathname) || !relative.test(specifier) || url.searchParams.has(resumeQuery)) return result;
      url.searchParams.set(resumeQuery, resume);
      return { ...result, url: url.href };
    }
    const carries = jsx.test(url.pathname) || (ts.test(url.pathname) && relative.test(specifier));
    if (!carries || url.searchParams.has(query) || everyServer || !isServer(new URL(context.parentURL))) return result;
    url.searchParams.set(query, "server");
    return { ...result, url: url.href };
  },
  load(href, context, next) {
    if (!href.startsWith("file:")) return next(href, context);
    const url = new URL(href);
    if (url.pathname.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
    if (!jsx.test(url.pathname)) return next(href, context);
    const filename = fileURLToPath(url);
    const resume = url.searchParams.get(resumeQuery);
    if (resume) return { format: "module", source: resumeModule(filename, resume), shortCircuit: true };
    const server = isServer(url);
    const result = compile(readFileSync(filename, "utf8"), {
      target: server ? "server" : "dom",
      filename,
      sourceMap: true,
    });
    if (result.diagnostics.length)
      throw new SyntaxError(
        "Rivet compile failed:\n" +
          result.diagnostics
            .map((d) => `  ${d.filename || filename}${d.line ? `:${d.line}:${d.column ?? 0}` : ""} ${d.message}`)
            .join("\n"),
      );
    for (const w of result.warnings ?? []) {
      const key = `${filename}\0${w.line ?? 0}:${w.column ?? 0}\0${w.message}`;
      if (warned.has(key)) continue;
      warned.add(key);
      console.warn(formatDiagnostic({ origin: "compiler", code: w.code, message: w.message, file: filename, line: w.line, column: w.column }));
    }
    const map = result.map
      ? "\n//# sourceMappingURL=data:application/json;base64," + Buffer.from(result.map).toString("base64")
      : "";
    return { format: "module", source: result.code + map, shortCircuit: true };
  },
});

// Resume module ids are paths from the workspace root (nearest ancestor whose package.json has `workspaces`, else the
// nearest package.json), so they do not depend on the directory the test runner starts in.
const roots = new Map<string, string>();
function resumeRoot(dir: string): string {
  const cached = roots.get(dir);
  if (cached !== undefined) return cached;
  let found = "";
  for (let at = dir; ; ) {
    const file = join(at, "package.json");
    if (existsSync(file)) {
      found ||= at;
      try {
        if ((JSON.parse(readFileSync(file, "utf8")) as { workspaces?: unknown }).workspaces) {
          found = at;
          break;
        }
      } catch {
        /* unreadable manifest: keep walking */
      }
    }
    const up = dirname(at);
    if (up === at) break;
    at = up;
  }
  const root = found || process.cwd();
  roots.set(dir, root);
  return root;
}

/** A module compiled in resume mode (`server` / `dom`) or its browser symbol module (`chunk`). */
function resumeModule(filename: string, kind: string): string {
  const module = relativePath(resumeRoot(dirname(filename)), filename).split(sep).join("/");
  const result = resumeCompiler.compile(readFileSync(filename, "utf8"), { target: kind === "server" ? "server" : "dom", filename, resume: { module } });
  if (result.diagnostics.length)
    throw new SyntaxError("Rivet compile failed:\n" + result.diagnostics.map((d) => `  ${d.filename || filename}${d.line ? `:${d.line}:${d.column ?? 0}` : ""} ${d.message}`).join("\n"));
  if (kind === "server") {
    const { modules, captures } = registry();
    modules.set(module, pathToFileURL(filename).href);
    for (const s of result.symbols) captures.set(s.id, s.labels ?? s.captures);
    return result.code;
  }
  if (kind === "dom") return result.code;
  return resumeCompiler._compileSymbolModule(result.symbols, pathToFileURL(filename).href + "?" + resumeQuery + "=dom");
}
