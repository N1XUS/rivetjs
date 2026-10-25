// Resume build output hygiene (ZERO FE-BUNDLE B1 / B2): facade folding (the manifest names the chunk holding an entry's
// code, not its 1-line re-export facade) and the eager-compile hint shifting the emitted `.map` asset too.
import { test } from "vitest";
import assert from "node:assert/strict";
import type { Rollup } from "vite";
import { _foldFacade, _hintEagerCompile } from "../vite.ts";

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
