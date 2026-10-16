import { test } from "vitest";
import assert from "node:assert/strict";
import { rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  ManifestCache,
  applyEdits,
  codeFixes,
  createLanguageCore,
  doctor,
  internalPath,
  loadCompiler,
  matchRoute,
  preloadSuggestions,
  routeCompletion,
  type EditorRoute,
} from "../index.ts";
import { compiler, repo, tempApp } from "./helpers.ts";

const routes: EditorRoute[] = [
  { id: "items/new", pattern: "/items/new", file: "src/routes/items/new.tsx" },
  { id: "items/[id]", pattern: "/items/:id", file: "src/routes/items/[id].tsx" },
  { id: "docs/[...rest]", pattern: "/docs/*rest", file: "src/routes/docs/[...rest].tsx" },
  { id: "index", pattern: "/", file: "src/routes/index.tsx" },
];

test("internal links match routes with the router's rules", () => {
  assert.equal(internalPath("https://x.dev/a"), null);
  assert.equal(internalPath("//cdn/a"), null);
  assert.equal(internalPath("items"), null);
  assert.equal(internalPath("/items/1?tab=a#top"), "/items/1");
  assert.equal(matchRoute(routes, "/")?.route.id, "index");
  assert.equal(matchRoute(routes, "/items/new")?.route.id, "items/new");
  assert.deepEqual(matchRoute(routes, "/items/42")?.params, { id: "42" });
  assert.deepEqual(matchRoute(routes, "/docs/a/b")?.params, { rest: "a/b" });
  assert.equal(matchRoute(routes, "/items/42/edit"), null);
  assert.equal(matchRoute(routes, "/nope"), null);
  assert.equal(matchRoute(routes, "/items//1"), null);
  assert.deepEqual(routeCompletion(routes[1]!), { path: "/items/", complete: false });
  assert.deepEqual(routeCompletion(routes[3]!), { path: "/", complete: true });
});

test("manifest: nearest .rivet/editor.json, re-read when it changes", () => {
  const root = tempApp({ "src/a.tsx": "", ".rivet/editor.json": JSON.stringify({ version: 1, resumeModules: ["src/a.tsx"] }) });
  try {
    const cache = new ManifestCache();
    const found = cache.find(join(root, "src/a.tsx"));
    assert.equal(found?.root, root);
    assert.deepEqual(found?.manifest.resumeModules, ["src/a.tsx"]);
    assert.equal(cache.find(join(root, "src/a.tsx")), found, "cached while unchanged");
    writeFileSync(join(root, ".rivet/editor.json"), JSON.stringify({ version: 1, resumeModules: [] }));
    utimesSync(join(root, ".rivet/editor.json"), new Date(), new Date(Date.now() + 5000));
    assert.deepEqual(cache.find(join(root, "src/a.tsx"))?.manifest.resumeModules, []);
    assert.equal(new ManifestCache().find(join(repo, "libs/language-core/index.ts")), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("check: resume mode per manifest, both targets, cached per text", () => {
  const source = `export function A() { const w = window.innerWidth; return <p>{w}</p>; }\n`;
  const root = tempApp({ "src/a.tsx": source, "src/b.tsx": source, ".rivet/editor.json": JSON.stringify({ version: 1, resumeModules: ["src/a.tsx"] }) });
  try {
    const core = createLanguageCore({ compiler });
    const a = core.check(join(root, "src/a.tsx"), source);
    assert.equal(a.resume, true);
    assert.equal(a.moduleId, "src/a.tsx");
    assert.deepEqual(a.diagnostics.map((d) => d.code), ["RV2001"]);
    assert.equal(core.check(join(root, "src/a.tsx"), source), a);
    const b = core.check(join(root, "src/b.tsx"), source);
    assert.equal(b.resume, false);
    assert.deepEqual(b.diagnostics, []);
    assert.ok(core.isRivetFile("/x/a.tsx") && core.isRivetFile("/x/a.jsx"));
    assert.ok(!core.isRivetFile("/x/a.ts") && !core.isRivetFile("/x/node_modules/p/a.tsx"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("loadCompiler rejects a module without the check op", () => {
  assert.throws(() => loadCompiler(join(repo, "package.json")));
});

/** Apply the first (or `which`) fix for `code` and recompile: the diagnostic is gone. */
function fixed(source: string, code: string, resume = false, which = 0): string {
  const options = { filename: "a.tsx", ...(resume ? { resume: { module: "a.tsx" } } : {}) };
  const diagnostic = compiler.check(source, options).diagnostics.find((d) => d.code === code);
  assert.ok(diagnostic, `${code} reported for ${source}`);
  const file = ts.createSourceFile("a.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fix = codeFixes(ts, file, diagnostic)[which];
  assert.ok(fix, `fix for ${code}`);
  const out = applyEdits(source, fix.edits);
  assert.ok(!compiler.check(out, options).diagnostics.some((d) => d.code === code), `${code} remains in:\n${out}`);
  return out;
}

test("quick fixes remove the diagnostic", () => {
  assert.deepEqual(preloadSuggestions("idel").slice(0, 1), ["idle"]);
  assert.deepEqual(preloadSuggestions("vis").slice(0, 1), ["visible"]);
  assert.match(fixed(`export const A = () => <div preload="idel" onClick={() => 1} />;`, "RV1102"), /preload="idle"/);
  assert.match(fixed(`export const A = () => <br class="x">text</br>;`, "RV1008"), /<br class="x" \/>/);
  assert.match(
    fixed(`import { signal } from "@rivetjs/reactivity";\nexport function A() { const s = signal(""); return <textarea model:value={s}>x</textarea>; }`, "RV1009"),
    /<textarea model:value=\{s\} \/>/,
  );
  const effect = fixed(
    `import { signal } from "@rivetjs/reactivity";\nexport function A() {\n  const s = signal(0);\n  window.addEventListener("resize", () => s.set(1));\n  return <p>{s()}</p>;\n}\n`,
    "RV2001",
    true,
  );
  assert.match(effect, /import \{ clientEffect \} from "@rivetjs\/runtime\/dom";/);
  assert.match(effect, /clientEffect\(\(\) => \{\n {4}window\.addEventListener/);
  const ref = fixed(`export function A() {\n  return <input ref={(el) => el.focus()} />;\n}\n`, "RV2002", true);
  assert.match(ref, /^import \{ ref \} from "@rivetjs\/runtime\/dom";\n/);
  assert.match(ref, /const inputRef = ref<HTMLElementTagNameMap\["input"\]>\(\);\n {2}return <input ref=\{inputRef\} \/>/);
  const local = fixed(`export function A() {\n  return <input ref={(el) => el.focus()} />;\n}\n`, "RV2002", true, 1);
  assert.match(local, /let inputRef!: HTMLElementTagNameMap\["input"\];\n {2}return <input ref=\{\(el\) => \(inputRef = el\)\} \/>/);
  const named = fixed(`import * as dom from "@rivetjs/runtime/dom";\nexport const A = (p: { items: string[] }) => <dom.For each={p.items}>{(x: string) => <i>{x}</i>}</dom.For>;\n`, "RV3002");
  assert.match(named, /import \{ For \} from "@rivetjs\/runtime\/dom";/);
  assert.match(named, /<For each=\{p\.items\}>.*<\/For>/);
});

test("doctor: inferred project, wrong JSX settings, missing manifest and route types", () => {
  const root = tempApp({ "vite.config.ts": "", "src/a.tsx": "" });
  try {
    const base = { fileName: join(root, "src/a.tsx"), tsVersion: ts.version, pluginLoaded: true, project: null };
    const ids = (input: Parameters<typeof doctor>[0]) => doctor(input).map((f) => f.id);
    assert.deepEqual(ids({ ...base, configFile: undefined, jsx: undefined, jsxImportSource: undefined }), ["inferred-project", "manifest"]);
    assert.deepEqual(ids({ ...base, configFile: "tsconfig.json", jsx: "react-jsx", jsxImportSource: undefined, pluginLoaded: false }), ["jsx-settings", "plugin", "manifest"]);
    assert.deepEqual(ids({ ...base, configFile: "tsconfig.json", jsx: "preserve", jsxImportSource: "@rivetjs/runtime", tsVersion: "0.0.1" }), ["typescript-version", "manifest"]);
    const project = { root, manifest: { version: 1 as const, routesDir: "src/routes", routes: [] } };
    assert.deepEqual(ids({ ...base, configFile: "tsconfig.json", jsx: "preserve", jsxImportSource: "@rivetjs/runtime", project }), ["route-types"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("check: `.bind` RV2012 / RV2013 / RV2014 are warnings unless the receiver is provably a function (T10 fix 2)", () => {
  const H = `import { signal } from "@rivetjs/reactivity";\nimport { makeStmt } from "./db";\n`;
  const page = (params: string, setup: string, call: string) =>
    H +
    `export function Page(${params}) { const n = signal(0); const add = (by: number) => n.set(n() + by); ${setup} return <b onClick={() => ${call}}>{n()}</b>; }`;
  const own = "props: { stmt: { bind(x: number): { id: number } } }";
  const found = (source: string) =>
    compiler
      .check(source, { filename: "src/a.tsx", resume: { module: "src/a.tsx" } })
      .diagnostics.filter((d) => /^RV201[234]$/.test(d.code))
      .map((d) => `${d.code} ${d.severity}`);
  // Review false positives: legal objects with their own `bind` (call result, prop, destructured param, spread) → warnings.
  assert.deepEqual(found(page("", "const stmt = makeStmt(); const s = stmt.bind(4);", "n.set(s.id)")), ["RV2013 warning"]);
  assert.deepEqual(found(page(own, "const s = props.stmt.bind(4);", "n.set(s.id)")), ["RV2013 warning"]);
  assert.deepEqual(found(page(`{ stmt }: { stmt: { bind(x: number): { id: number } } }`, "const s = stmt.bind(4);", "n.set(s.id)")), ["RV2013 warning"]);
  assert.deepEqual(found(page("", "const stmt = makeStmt(); const xs: [number] = [4]; const s = stmt.bind(...xs);", "n.set(s.id)")), ["RV2012 warning"]);
  // RV2014 only for a reached key: another key read → clean; the bound key read → warning.
  assert.deepEqual(found(page("", "const o = { k: 1, s: makeStmt().bind(4) };", "n.set(o.k)")), []);
  assert.deepEqual(found(page("", "const api = { inc: add.bind(null, 1) };", "api.inc()")), ["RV2014 warning"]);
  // Provable function receiver: error.
  assert.deepEqual(found(page("", "const args: [null, number] = [null, 2]; const go = add.bind(...args);", "go()")), ["RV2012 error"]);
  // Green.
  assert.deepEqual(found(page("", "const go = add.bind(null, 2);", "go()")), []);
});
