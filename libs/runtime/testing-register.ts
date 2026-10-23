// `node --import @rivetjs/runtime/testing/register --test` preload: `.tsx`/`.jsx` modules compile through
// the Rivet compiler (needs `@rivetjs/compiler` installed), so component tests run without a bundler.
// Target: DOM by default. Server for `*.server.test.{ts,tsx,js,jsx,mts,mjs}` files and every
// `.tsx`/`.jsx` module they (transitively, through `.tsx`/`.jsx` modules and `.ts`/`.mts` imports, e.g. an
// `index.ts` barrel) import, or for the whole process with `RIVET_TEST_TARGET=server`. A `.ts` file is tagged
// whether a relative path or a package specifier reaches it (cdk imports `../i18n/index.ts` and
// `@rivetjs/cdk/i18n` alike: one instance, one context token); `@rivetjs/reactivity` / `@rivetjs/runtime`
// specifiers never are, so the runtime singletons load once. Server-graph
// modules carry a `?rivet-target=server` URL query, so a process can hold both compilations of one component.
// DOM-target modules compile as the Vite plugin compiles client modules (DOM v2, the only DOM lowering).
// Stylesheet imports (`import "./x.css"`, e.g. `@rivetjs/ui` component CSS) load as empty modules, as a bundler
// would hand them to its CSS pipeline: node has no CSS loader (ERR_UNKNOWN_FILE_EXTENSION).
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compile } from "@rivetjs/compiler";
import { formatDiagnostic } from "@rivetjs/compiler/format";

// Compiler warnings already printed (file, position, message): once per process, never dropped.
const warned = new Set<string>();

const jsx = /\.[jt]sx$/;
const ts = /\.m?ts$/;
const relative = /^\.{1,2}\//;
const singleton = /^@rivetjs\/(reactivity|runtime)(\/|$)/;
const serverTest = /\.server\.test\.[cm]?[jt]sx?$/;
const query = "rivet-target";
const everyServer = process.env.RIVET_TEST_TARGET === "server";

const isServer = (url: URL) => everyServer || url.searchParams.get(query) === "server" || serverTest.test(url.pathname);

registerHooks({
  resolve(specifier, context, next) {
    const result = next(specifier, context);
    if (!context.parentURL?.startsWith("file:") || !result.url.startsWith("file:")) return result;
    const url = new URL(result.url);
    const carries =
      jsx.test(url.pathname) ||
      (ts.test(url.pathname) && (relative.test(specifier) || (!singleton.test(specifier) && !url.pathname.includes("/node_modules/"))));
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
    const server = isServer(url);
    const result = compile(readFileSync(filename, "utf8"), {
      target: server ? "server" : "dom",
      filename,
      sourceMap: true,
    });
    if (result.diagnostics.length)
      throw new SyntaxError(
        "Rivet compile failed:\n" +
          result.diagnostics.map((d) => `  ${d.filename || filename}${d.line ? `:${d.line}:${d.column ?? 0}` : ""} ${d.message}`).join("\n"),
      );
    for (const w of result.warnings ?? []) {
      const key = `${filename}\0${w.line ?? 0}:${w.column ?? 0}\0${w.message}`;
      if (warned.has(key)) continue;
      warned.add(key);
      console.warn(formatDiagnostic({ origin: "compiler", code: w.code, message: w.message, file: filename, line: w.line, column: w.column }));
    }
    const map = result.map ? "\n//# sourceMappingURL=data:application/json;base64," + Buffer.from(result.map).toString("base64") : "";
    return { format: "module", source: result.code + map, shortCircuit: true };
  },
});
