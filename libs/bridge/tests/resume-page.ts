// Resumed-page fixtures for Chromium (runtime harness libs/runtime/tests/resume/harness.ts): a page source with
// facades is server-rendered through the bridge harness (resume mode), its DOM symbols + the core's root symbols are
// served as symbol chunks, `@rivetjs/bridge/server` maps to the DOM `_island` (what the T5 facade variant imports),
// `@rivetjs/bridge/client` to the real driver, `/islands/counter.js` to the fake client adapter (`window.__log`).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compile } from "@rivetjs/compiler";
import { compileSymbolModule, type ResumeSymbol } from "../../runtime/tests/resume/compile.ts";
import { rewrite, type Served } from "../../runtime/tests/resume/harness.ts";
import { page } from "./harness.ts";

/** Served files of the resumed page `Page()` of `source` at `/`; `patch` rewrites a served bridge module (measurements); `extra`: manifest island chunks / loader, render `preload`. */
export async function resumedPage(
  source: string,
  patch: (path: string, code: string) => string = (_, code) => code,
  extra: { islands?: Record<string, string>; loader?: string; preload?: { ahead?: boolean; lean?: boolean } } = {},
): Promise<Record<string, Served>> {
  type Compiled = { code: string; diagnostics: unknown[]; symbols: ResumeSymbol[] };
  const resumeCompile = (code: string, module: string) => {
    const result = (compile as unknown as (s: string, o: object) => Compiled)(code, { target: "dom", filename: module, resume: { module } });
    assert.deepEqual(result.diagnostics, []);
    return result;
  };
  const lib = (file: string) => new URL("../" + file, import.meta.url);
  const strip = async (file: URL) => stripTypeScriptTypes(await readFile(file, "utf8"));
  const bridge = (code: string) =>
    rewrite(code)
      .replaceAll('"@rivetjs/bridge/client"', '"/bridge/client.js"')
      .replaceAll('"@rivetjs/bridge/server"', '"/bridge/dom.js"')
      .replaceAll('"./client.ts"', '"/bridge/client.js"')
      .replaceAll('"./callbacks.ts"', '"/bridge/callbacks.js"')
      .replaceAll('"./triggers.ts"', '"/bridge/triggers.js"')
      .replaceAll('"./intent.ts"', '"/bridge/intent.js"')
      .replaceAll('"./hot.ts"', '"/bridge/hot.js"')
      .replaceAll('"@rivetjs/bridge/intent"', '"/bridge/intent.js"')
      .replaceAll('"./fake-adapter.ts"', '"/fake-adapter.js"')
      .replaceAll('"../adapter.ts"', '"/bridge/adapter.js"')
      .replaceAll('"./adapter.ts"', '"/bridge/adapter.js"')
      .replaceAll('"/dev/off.ts"', '"/bridge/dev-off.js"');

  const { mod, manifest } = await page<{ Page: () => never }>(source);
  // `islands` (island key → chunk URL, the build manifest's map): lets the server pick the lean tail; `loader` = the
  // manifest's loader module (`/resume-loader-module.ts` is served by the runtime harness); `preload` = render option.
  const built = { ...manifest, ...(extra.islands ? { islands: extra.islands } : {}), ...(extra.loader ? { loader: extra.loader } : {}) };
  const html = (await resumableToString(() => mod.Page(), { manifest: built, ...(extra.preload ? { preload: extra.preload } : {}) } as never)) as string;
  const pageDom = resumeCompile(source, "src/page.tsx");
  const rootDom = resumeCompile(await readFile(lib("root.tsx"), "utf8"), "@rivetjs/bridge/root.tsx");
  const domDom = compile(await readFile(lib("dom.tsx"), "utf8"), { target: "dom", filename: "dom.tsx" }) as unknown as Compiled;
  assert.deepEqual(domDom.diagnostics, []);

  const files: Record<string, Served> = {
    "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
    "/fixture.mjs": bridge(pageDom.code),
    "/root.mjs": bridge(rootDom.code),
    "/bridge/dom.js": bridge(domDom.code),
    "/bridge/client.js": bridge(await strip(lib("client.ts"))),
    "/bridge/callbacks.js": bridge(await strip(lib("callbacks.ts"))),
    "/bridge/triggers.js": bridge(await strip(lib("triggers.ts"))),
    "/bridge/intent.js": bridge(await strip(lib("intent.ts"))),
    "/bridge/hot.js": bridge(await strip(lib("hot.ts"))),
    "/bridge/adapter.js": bridge(await strip(lib("adapter.ts"))),
    "/bridge/dev-off.js": await strip(lib("dev-off.ts")),
    "/fake-adapter.js": bridge(await strip(new URL("./fake-adapter.ts", import.meta.url))),
    "/fake-client.js": bridge(await strip(new URL("./fake-client.ts", import.meta.url))) + "\nwindow.__log = log;",
    "/islands/counter.js": 'export { Counter as default, fakeClient as adapter } from "/fake-client.js";',
  };
  const byChunk: Record<string, { from: string; symbols: ResumeSymbol[] }> = {};
  for (const [from, symbols] of [
    ["/fixture.mjs", pageDom.symbols],
    ["/root.mjs", rootDom.symbols],
  ] as const)
    for (const symbol of symbols) (byChunk["/c/" + symbol.component + ".js"] ??= { from, symbols: [] }).symbols.push(symbol);
  for (const [path, { from, symbols }] of Object.entries(byChunk)) files[path] = bridge(compileSymbolModule(symbols, from));

  for (const path in files) if (typeof files[path] === "string") files[path] = patch(path, files[path] as string);
  return files;
}
