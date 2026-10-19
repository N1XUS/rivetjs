// Diagnostic code registry (codes.json) ↔ emitters: every code the compiler (rust/src), the Vite plugin (vite.ts) or the language
// service (libs/language-core) can emit is registered, compile output carries codes + severities, and
// the Vite plugin reports them ([RVnnnn] prefix, pluginCode, docs url).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CODES, RESERVED, check, codeInfo, compile, docsUrl } from "../index.ts";
import { rivet } from "../vite.ts";

const here = new URL("..", import.meta.url).pathname;
const sources = (dir: string, ext: RegExp): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && ext.test(entry.name) && !entry.parentPath.includes("node_modules") && !entry.parentPath.includes("/tests"))
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"));
const emitted = (texts: string[]) => new Set(texts.flatMap((text) => [...text.matchAll(/"(RV\d{4})"/g)].map((m) => m[1]!)));
const num = (code: string) => Number(code.slice(2));

test("every code the compiler or language service emits is registered", () => {
  const compiler = emitted(sources(join(here, "rust/src"), /\.rs$/));
  const language = emitted(sources(join(here, "../language-core"), /\.ts$/));
  assert.ok(compiler.size > 40, `found ${compiler.size} compiler codes`);
  // The Vite plugin's own build errors (`pluginCode: "RV2010"`, `[RV2010] …` message prefixes).
  const viteText = readFileSync(join(here, "vite.ts"), "utf8");
  const vite = new Set([...emitted([viteText]), ...[...viteText.matchAll(/\[(RV\d{4})\]/g)].map((m) => m[1]!)]);
  assert.ok(vite.has("RV2010"), "vite.ts emits RV2010");
  for (const code of [...compiler, ...language, ...vite]) assert.ok(codeInfo(code), `${code} is emitted but not registered in codes.json`);
  // Compiler diagnostics fail the build, except the compile warnings (T10 fix 2: `warnings`, never suppressing code).
  const warnings = new Set(["RV2013", "RV2014", "RV2015", "RV2104", "RV2105", "RV2106"]);
  for (const code of compiler) assert.equal(codeInfo(code)!.severity, warnings.has(code) ? "warning" : "error", code);
  assert.equal(codeInfo("RV2101")!.severity, "warning");
  assert.equal(codeInfo("RV3101")!.severity, "warning");
});

test("registry: unique codes, docs URLs, reserved ranges free", () => {
  const seen = new Set<string>();
  for (const info of CODES) {
    assert.match(info.code, /^RV\d{4}$/);
    assert.ok(!seen.has(info.code), "duplicate " + info.code);
    seen.add(info.code);
    assert.ok(info.title.length > 0);
    assert.equal(info.docs, docsUrl(info.code));
    assert.match(info.docs, /^https:\/\/.+RV\d{4}$/);
  }
  assert.deepEqual(
    RESERVED.map((r) => [r.from, r.to, r.owner]),
    [
      ["RV2500", "RV2599", "@rivetjs/runtime"],
      ["RV3102", "RV3199", "@rivetjs/router"],
    ],
  );
  for (const range of RESERVED)
    for (const info of CODES)
      assert.ok(num(info.code) < num(range.from) || num(info.code) > num(range.to), `${info.code} inside reserved ${range.from}-${range.to}`);
});

const codeOf = (source: string, options: Parameters<typeof compile>[1] = {}) =>
  compile(source, { filename: "m.tsx", ...options }).diagnostics.map((d) => d.code);

test("styles (RV5001-RV5003), slots (RV6001-RV6004) and message tags (RV4004) have their own codes", () => {
  const styles = { styles: { scope: "m.tsx" } } as const;
  const css = `import { css } from "@rivetjs/runtime/css";\n`;
  assert.deepEqual(codeOf(css + "const s = css`.a { color: red`;", styles), ["RV5001"]);
  assert.deepEqual(codeOf(css + "const s = css`.a { color: red }`;\nexport const A = () => <p class={s.b} />;", styles), ["RV5002"]);
  assert.deepEqual(codeOf(`export const A = () => <p style="color: red" />;`), ["RV5003"]);
  assert.deepEqual(codeOf(`export const A = (p: any) => <p style={{ color: "url(x)" }} />;`), ["RV5003"]);
  assert.deepEqual(codeOf(`export const A = () => <slot />;`), ["RV6001"]);
  assert.deepEqual(codeOf(`export function A(props: any) { return <slot r:name="1x" />; }`), ["RV6002"]);
  assert.deepEqual(codeOf(`export const A = () => <div><p r:slot="x" /></div>;`), ["RV6003"]);
  assert.deepEqual(codeOf(`declare const C: any;\nexport const A = () => <C x={1}><p r:slot="x" /></C>;`), ["RV6004"]);
  for (const d of compile(`export const A = () => <slot />;`).diagnostics) assert.equal(d.severity, "error");
});

test("check reports the same codes as compile", () => {
  const { diagnostics } = check(`export const A = () => <p style="color: red" />;`, { filename: "m.tsx" });
  assert.deepEqual([...new Set(diagnostics.map((d) => d.code))], ["RV5003"]);
});

test("Vite errors carry [RVnnnn], pluginCode and the docs url", () => {
  const plugin = rivet();
  const transform = plugin.transform as unknown as (this: unknown, code: string, id: string) => unknown;
  let error: { message: string; pluginCode?: unknown; url?: string } | undefined;
  const ctx = {
    error(value: typeof error) {
      error = value;
      throw Error(value!.message);
    },
  };
  assert.throws(() => transform.call(ctx, "export const A = (p: any) => <p>{...p}</p>;", "/app/bad.tsx"));
  assert.match(error!.message, /^\[RV1002\] \/app\/bad\.tsx:1:\d+: Spread children are not supported: /);
  assert.equal(error!.pluginCode, "RV1002");
  assert.equal(error!.url, docsUrl("RV1002"));
});
