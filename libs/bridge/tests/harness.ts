// Bridge server test harness: the core's `.tsx` modules compiled in resume mode (derived model) as the Vite plugin
// compiles a `rivet.source` package (module ids `@rivetjs/bridge/<file>`), linked through data URLs; fixture pages
// (facades + Rivet components) compiled the same way. Runtime specifiers resolve to the workspace files, so every module shares one
// runtime instance with the test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compile } from "@rivetjs/compiler";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";

interface Compiled {
  code: string;
  diagnostics: { message: string }[];
  /** Derived boundary names (`<module>#<export>`). */
  boundaries?: string[];
}
const compileResume = (source: string, target: "server" | "dom", module: string): Compiled =>
  (compile as unknown as (s: string, o: object) => Compiled)(source, { target, filename: module, resume: { module } });
const run = (source: string, target: "server" | "dom", module: string): Compiled => {
  const result = compileResume(source, target, module);
  assert.deepEqual(result.diagnostics, []);
  return result;
};
/** The compiler diagnostics of a fixture page (resume mode, DOM target). */
export const diagnosticsOf = (source: string, module = "src/page.tsx") =>
  compileResume(source, "dom", module).diagnostics as { code?: string; message: string }[];
const lib = (file: string) => new URL("../" + file, import.meta.url);
const data = (code: string) => "data:text/javascript;base64," + Buffer.from(code).toString("base64");
const resolve = (code: string) =>
  code.replace(/(from |import\()"(@rivetjs\/[^"]*)"/g, (_, kw: string, specifier: string) => kw + JSON.stringify(import.meta.resolve(specifier)));

const rootSource = readFileSync(lib("root.tsx"), "utf8");
const root = data(resolve(run(rootSource, "server", "@rivetjs/bridge/root.tsx").code));
const serverModule = (dev: boolean) => {
  let code = run(readFileSync(lib("server.tsx"), "utf8"), "server", "@rivetjs/bridge/server.tsx").code;
  code = code.replaceAll('"./root.tsx"', JSON.stringify(root));
  for (const name of ["ids", "slots", "adapter", "lean"]) code = code.replaceAll(`"./${name}.ts"`, JSON.stringify(lib(name + ".ts").href));
  code = code.replaceAll('"#dev"', JSON.stringify(lib(dev ? "dev-on.ts" : "dev-off.ts").href));
  return data(resolve(code));
};
/** `@rivetjs/bridge/server` as the production (`dev: false`) or development build. */
export const SERVER = { prod: serverModule(false), dev: serverModule(true) };

/** Compile a fixture page (facades + components) for the server; `@rivetjs/bridge/server` → the given build; `links`: specifier → URL. */
export async function page<T>(
  source: string,
  { dev = false, module = "src/page.tsx", links = {} }: { dev?: boolean; module?: string; links?: Record<string, string> } = {},
): Promise<{ mod: T; manifest: ResumeManifest }> {
  let code = run(source, "server", module).code;
  code = code.replaceAll('"@rivetjs/bridge/server"', JSON.stringify(dev ? SERVER.dev : SERVER.prod));
  code = code.replaceAll('"./fake-adapter.ts"', JSON.stringify(new URL("./fake-adapter.ts", import.meta.url).href));
  // Other relative specifiers of the fixture (data URLs cannot resolve them): `links` maps them to file URLs.
  for (const [specifier, url] of Object.entries(links)) code = code.replaceAll(JSON.stringify(specifier), JSON.stringify(url));
  const boundaries = run(source, "dom", module).boundaries ?? [];
  const manifest: ResumeManifest = {
    hash: "h",
    runtime: "/rt.js",
    symbols: Object.fromEntries(boundaries.map((name) => [name, "/c/" + name.split("#")[1] + ".js"])),
  };
  return { mod: (await import(data(resolve(code)))) as T, manifest };
}

/** The derived boundaries tail (`<script type="rivet/boundaries">`) of a page, parsed. */
export interface Tail {
  b: [id: number, parent: number, flags: number, name: string, values: unknown[], ...rest: unknown[]][];
  i?: unknown;
  m?: Record<string, string>;
  [key: string]: unknown;
}
export const tailOf = (html: string): Tail | null => {
  const json = /<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)?.[1];
  return json ? (JSON.parse(json) as Tail) : null;
};
/** The lean islands records (`<script type="rivet/islands">`) of a page. */
export const islandsOf = (html: string): unknown[][] | null => {
  const json = /<script type="rivet\/islands"[^>]*>(.*?)<\/script>/s.exec(html)?.[1];
  return json ? (JSON.parse(json) as unknown[][]) : null;
};
