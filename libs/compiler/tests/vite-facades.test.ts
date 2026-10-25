// Resume build output hygiene (ZERO FE-BUNDLE B1 / B2): facade folding (the manifest names the chunk holding an entry's
// code, not its 1-line re-export facade) and the eager-compile hint shifting the emitted `.map` asset too.
import { test } from "vitest";
import assert from "node:assert/strict";
import type { Rollup } from "vite";
import { _foldFacade, _hintEagerCompile, _MERGE_ONLY, _mergeOnlyImports, _pureAnnotate, _TW_STATE, _typeExports, _UI_TV } from "../vite.ts";

const chunk = (fileName: string, code: string, extra: Partial<Rollup.OutputChunk> = {}): Rollup.OutputChunk =>
  ({
    type: "chunk",
    fileName,
    code,
    exports: [],
    imports: [],
    dynamicImports: [],
    moduleIds: [],
    isEntry: false,
    facadeModuleId: null,
    ...extra,
  }) as unknown as Rollup.OutputChunk;
const bundleOf = (...outputs: (Rollup.OutputChunk | Rollup.OutputAsset)[]): Rollup.OutputBundle =>
  Object.fromEntries(outputs.map((o) => [o.fileName, o])) as Rollup.OutputBundle;

test("facade folding: the wanted names join the target chunk's export clause, same bindings", async () => {
  const target = chunk("assets/dom-derived-A.js", "var sc={start(){}},q=1;export{q as t,sc as i};\n//# sourceMappingURL=dom-derived-A.js.map\n", {
    exports: ["t", "i"],
  });
  const facade = chunk(
    "assets/derived-runtime-B.js",
    '//# allFunctionsCalledOnLoad\nimport{i as e,t as n}from"./dom-derived-A.js";export{e as default,n as _b};\n',
    {
      isEntry: true,
      imports: ["assets/dom-derived-A.js"],
    },
  );
  const real = _foldFacade(bundleOf(target, facade), facade, ["default", "_b"]);
  assert.equal(real, target);
  assert.equal(target.code, "var sc={start(){}},q=1;export{q as t,sc as i,sc as default,q as _b};\n//# sourceMappingURL=dom-derived-A.js.map\n");
  assert.deepEqual(target.exports.sort(), ["_b", "default", "i", "t"]);
  // The folded chunk is a valid module whose new names are the facade's.
  const mod = await import("data:text/javascript," + encodeURIComponent(target.code.replace(/\/\/# sourceMappingURL=.*/, "")));
  assert.equal(mod.default, mod.i);
  assert.equal(mod._b, 1);
});

test("facade folding: plain names, an export the target already has under the same binding, idempotent", () => {
  const target = chunk("assets/x.js", "function Card(){}export{Card};", { exports: ["Card"] });
  const facade = chunk("assets/y.js", 'import{Card}from"./x.js";export{Card};');
  assert.equal(_foldFacade(bundleOf(target, facade), facade, ["Card"]), target);
  assert.equal(target.code, "function Card(){}export{Card};");
});

test("facade folding: kept on a name collision, a non-facade chunk or an unexpected shape", () => {
  const target = chunk("assets/x.js", "var a=1,b=2;export{a as default,b as t};", { exports: ["default", "t"] });
  const clash = chunk("assets/y.js", 'import{t as e}from"./x.js";export{e as default};');
  assert.equal(_foldFacade(bundleOf(target, clash), clash, ["default"]), clash, "default is another binding in the target");
  assert.equal(target.code, "var a=1,b=2;export{a as default,b as t};");
  const code = chunk("assets/z.js", 'import{t as e}from"./x.js";var o=Object.assign(e,{Root:e});export{o as t};');
  assert.equal(_foldFacade(bundleOf(target, code), code, ["t"]), code, "a chunk with code of its own is not a facade");
  const missing = chunk("assets/w.js", 'import{q as e}from"./x.js";export{e as Q};');
  assert.equal(_foldFacade(bundleOf(target, missing), missing, ["Q"]), missing, "the target does not export the imported name");
  const elsewhere = chunk("assets/v.js", 'import{t as e}from"./nowhere.js";export{e as Q};');
  assert.equal(_foldFacade(bundleOf(target, elsewhere), elsewhere, ["Q"]), elsewhere);
  const partial = chunk("assets/u.js", 'import{t as e}from"./x.js";export{e as Q};');
  assert.equal(_foldFacade(bundleOf(target, partial), partial, ["Q", "R"]), partial, "a wanted name the facade does not export");
});

test("facade folding: only the wanted names are added (a strict facade re-exports the whole module signature)", () => {
  const target = chunk("assets/x.js", "var a=1,b=2,c=3;export{a as t,b as n,c as r};", { exports: ["t", "n", "r"] });
  const facade = chunk("assets/y.js", 'import{t as e,n as f,r as g}from"./x.js";export{e as ColorWheel,f as colorWheelProps,g as colorWheelInputChange};');
  assert.equal(_foldFacade(bundleOf(target, facade), facade, ["ColorWheel"]), target);
  assert.equal(target.code, "var a=1,b=2,c=3;export{a as t,b as n,c as r,a as ColorWheel};");
});

test("eager-compile hint: the chunk and its emitted .map asset shift one line together", () => {
  const map = { version: 3, sources: ["a.ts"], mappings: "AAAA", names: [] };
  const entry = chunk("assets/a.js", "export const a=1;\n", { isEntry: true, facadeModuleId: "/a.ts", map: { ...map } as unknown as Rollup.SourceMap });
  const asset = { type: "asset", fileName: "assets/a.js.map", source: JSON.stringify(map) } as unknown as Rollup.OutputAsset;
  const binary = chunk("assets/b.js", "export const b=1;\n", { isEntry: true, facadeModuleId: "/b.ts" });
  const binaryMap = { type: "asset", fileName: "assets/b.js.map", source: new TextEncoder().encode(JSON.stringify(map)) } as unknown as Rollup.OutputAsset;
  const bundle = bundleOf(entry, asset, binary, binaryMap);
  _hintEagerCompile(bundle, (o) => o.isEntry);
  assert.ok(entry.code.startsWith("//# allFunctionsCalledOnLoad\n"));
  assert.equal(entry.map!.mappings, ";AAAA");
  assert.equal(JSON.parse(asset.source as string).mappings, ";AAAA");
  assert.equal(JSON.parse(binaryMap.source as string).mappings, ";AAAA");
  // Once only.
  _hintEagerCompile(bundle, (o) => o.isEntry);
  assert.equal(JSON.parse(asset.source as string).mappings, ";AAAA");
});

test("tailwind-variants layout: every rewrite applies to the installed version", async () => {
  const { readFile, readdir } = await import("node:fs/promises");
  const { createRequire } = await import("node:module");
  const { dirname, join } = await import("node:path");
  const dir = dirname(createRequire(import.meta.url).resolve("tailwind-variants/lite"));
  const read = (file: string) => readFile(join(dir, file), "utf8");
  const lite = _pureAnnotate(join(dir, "lite.js"), await read("lite.js"));
  assert.match(lite ?? "", /var runtime = \/\* @__PURE__ \*\/ getTailwindVariants\(classAdapter\);\nvar tv = \/\* @__PURE__ \*\/ \(\(\) => runtime\.tv\)\(\);/);
  const merge = _pureAnnotate(join(dir, "index.js"), await read("index.js"), _MERGE_ONLY.slice(1)) ?? "";
  assert.doesNotMatch(merge, /getTailwindVariants\(|\/\/ src\/index\.ts/);
  assert.match(merge, /\nexport \{ cn, cnMerge, cnAdapter, cx \};\n$/);
  assert.match(merge, new RegExp(`^import \\{ state, [^}]*\\} from '\\./chunk-[\\w-]+\\.js\\${_TW_STATE}';$`, "m"));
  const index = _pureAnnotate(join(dir, "index.js"), await read("index.js")) ?? "";
  assert.match(index, new RegExp(`\\nimport \\{ cn, cnMerge, cnAdapter, cx \\} from '\\./index\\.js\\${_MERGE_ONLY}';\\n`));
  assert.ok(index.length < 2000, "index.js keeps only the tv runtime: " + index.length);
  const chunks = (await readdir(dir)).filter((file) => /^chunk-.*\.js$/.test(file));
  const stateful = [];
  for (const file of chunks) if (_pureAnnotate(join(dir, file), await read(file))) stateful.push(file);
  assert.equal(stateful.length, 1, "one chunk creates the state");
  const copy = _pureAnnotate(join(dir, stateful[0]!), await read(stateful[0]!), _TW_STATE.slice(1)) ?? (await read(stateful[0]!));
  assert.match(copy, /^var state = createState\(\);$/m, "the copy keeps it");
  assert.doesNotMatch(copy, /from '\.\/chunk-[\w-]+\.js';/, "over the merge side's helper copies");
  assert.equal(_pureAnnotate("/x/node_modules/other/dist/index.js", "var runtime = getTailwindVariants(cnAdapter);"), null);
  assert.equal(_pureAnnotate(join(dir, "index.js"), "export const x = 1;"), null, "another version: untouched");
  assert.ok(_UI_TV.test("/r/libs/ui/styles/src/utils/tv.ts") && _UI_TV.test("/r/node_modules/@rivetjs/ui/styles/src/utils/tv.js"));
  assert.ok(!_UI_TV.test("/r/libs/ui/src/utils/tv.ts"));
});

test("tailwind-variants layout: the rewritten module set behaves as upstream (tv + cn, one shared state)", async () => {
  const { readFile, readdir, writeFile, mkdtemp, rm } = await import("node:fs/promises");
  const { createRequire } = await import("node:module");
  const { dirname, join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { pathToFileURL } = await import("node:url");
  const dir = dirname(createRequire(import.meta.url).resolve("tailwind-variants/lite"));
  const out = await mkdtemp(join(tmpdir(), "rivet-tw-"));
  // Each (file, query) module becomes its own file: `x.js?q` → `x.q.js`.
  const name = (file: string, query: string) => (query ? file.replace(/\.js$/, "." + query + ".js") : file);
  const specifiers = (code: string) => code.replace(/'\.\/([\w-]+\.js)\?([\w-]+)'/g, (_, file: string, query: string) => `'./${name(file, query)}'`);
  try {
    for (const file of [...(await readdir(dir)).filter((f) => /^chunk-.*\.js$/.test(f)), "index.js", "lite.js"])
      for (const query of ["", _MERGE_ONLY.slice(1), _TW_STATE.slice(1)]) {
        const code = await readFile(join(dir, file), "utf8");
        await writeFile(join(out, name(file, query)), specifiers(_pureAnnotate(join(dir, file), code, query) ?? code));
      }
    const ours = (await import(pathToFileURL(join(out, "index.js")).href)) as typeof import("tailwind-variants");
    const merge = (await import(pathToFileURL(join(out, name("index.js", _MERGE_ONLY.slice(1)))).href)) as typeof import("tailwind-variants");
    const upstream = await import("tailwind-variants");
    assert.equal(ours.cn, merge.cn, "index.js re-exports the merge module's cn");
    for (const input of ["button p-2 p-4", "card w-96 w-full text-sm text-lg", "a  b", ""]) assert.equal(merge.cn(input), upstream.cn(input), input);
    const def = { base: "p-2 text-sm", variants: { size: { lg: "p-4 text-lg" } } };
    assert.equal(ours.tv(def)({ size: "lg", class: "p-8" }), upstream.tv(def)({ size: "lg", class: "p-8" }));
    // A custom twMergeConfig set through tv reaches cn's cache: the state is shared.
    const config = { twMergeConfig: { extend: { classGroups: { shadow: [{ shadow: ["x1", "x2"] }] } } } };
    assert.equal(ours.tv({ base: "shadow-x1" }, config)({ class: "shadow-x2" }), upstream.tv({ base: "shadow-x1" }, config)({ class: "shadow-x2" }));
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test("merge-only imports: project cn / cx imports move to the copy; tv, types and other names stay", () => {
  const q = "tailwind-variants" + _MERGE_ONLY;
  assert.equal(_mergeOnlyImports('import { cn } from "tailwind-variants";\n'), `import { cn } from "${q}";\n`);
  assert.equal(
    _mergeOnlyImports("import { cx as join, cn, type ClassValue } from 'tailwind-variants';"),
    `import { cx as join, cn, type ClassValue } from '${q}';`,
  );
  for (const source of [
    'import { tv, cn } from "tailwind-variants";',
    'import type { VariantProps } from "tailwind-variants";',
    'import { type VariantProps } from "tailwind-variants";',
    'import { cx } from "tailwind-variants/lite";',
    'import * as T from "tailwind-variants";',
  ])
    assert.equal(_mergeOnlyImports(source), source);
});

test("boundary facades: type-only exports do not count as extra module exports", () => {
  const source = [
    "export type Props = { a: string };",
    "export interface Options { b: number }",
    "export declare type Raw = string;",
    "type Local = 1; export type { Local, Local as Renamed };",
    "const x = 1; export { x, type Props as P2 };",
    "export function Button() {}",
  ].join("\n");
  assert.deepEqual([..._typeExports(source)].sort(), ["Local", "Options", "P2", "Props", "Raw", "Renamed"]);
});
