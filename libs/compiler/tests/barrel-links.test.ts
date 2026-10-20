import { test } from "vitest";
import assert from "node:assert/strict";
import { parseAst } from "vite";
import { barrelUses, type LinkModule } from "../barrel-links.ts";
import { isBarrel } from "../chunk-groups.ts";

const graph = (files: Record<string, string>, exports: Record<string, string[]> = {}) => {
  const modules = new Map<string, LinkModule>();
  for (const [id, code] of Object.entries(files)) {
    const importedIds = [...code.matchAll(/from\s*["']([^"']+)["']/g)].map((m) =>
      m[1]!.startsWith(".") ? "/p/" + m[1]!.replace(/^\.\//, "") : "/nm/" + m[1]!,
    );
    modules.set(id, { id, code, importedIds: [...new Set(importedIds)], exports: exports[id] ?? [], barrel: isBarrel(code) });
  }
  return modules;
};
const parse = (code: string) => parseAst(code) as unknown as { body: readonly unknown[] };
const resolveBare = async (spec: string) => "/nm/" + spec;

test("barrel links: named and default imports resolve through re-export chains to the modules behind them", async () => {
  const modules = graph({
    "/p/page.js": `import { ShoppingBag, Box as B } from "lucide";\nimport Def from "./lib.js";\nimport * as ns from "./ns.js";\nexport const items = [ShoppingBag, B, Def, ns];\n`,
    "/nm/lucide": `export { default as ShoppingBag } from "./icons/shopping-bag.js";\nexport * from "./more.js";\nexport { default as Unused } from "./icons/unused.js";\n`,
    "/nm/more.js": `export { default as Box } from "./icons/box.js";\nexport { default as Other } from "./icons/other.js";\n`,
    "/nm/icons/shopping-bag.js": "export default 1;\n",
    "/nm/icons/box.js": "export default 2;\n",
    "/nm/icons/other.js": "export default 3;\n",
    "/nm/icons/unused.js": "export default 4;\n",
    "/p/lib.js": `export { default } from "./impl.js";\n`,
    "/p/impl.js": "export default 5;\n",
    "/p/ns.js": `export { a } from "./na.js";\n`,
    "/p/na.js": "export const a = 6;\n",
  });
  // Barrel ids in the fixture resolve relative to the barrel's directory.
  for (const id of ["/nm/lucide", "/nm/more.js"]) {
    const m = modules.get(id)!;
    modules.set(id, { ...m, importedIds: [...m.code!.matchAll(/from\s*"\.\/([^"]+)"/g)].map((x) => "/nm/" + x[1]!) });
  }
  const uses = await barrelUses(modules, parse, resolveBare);
  // Namespace imports stay with the barrel stop (unknown use); unused names link nothing.
  assert.deepEqual(uses.get("/p/page.js"), ["/nm/icons/box.js", "/nm/icons/shopping-bag.js", "/p/impl.js"]);
  assert.equal(uses.size, 1);
});

test("barrel links: `export *` cycles between barrels terminate and still resolve the names behind them", async () => {
  const modules = graph({
    "/p/user.js": `import { own, leaf } from "./a.js";\nexport const x = [own, leaf];\n`,
    "/p/a.js": `export * from "./b.js";\nexport { own } from "./own.js";\n`,
    "/p/b.js": `export * from "./a.js";\nexport { leaf } from "./leaf.js";\n`,
    "/p/own.js": "export const own = 1;\n",
    "/p/leaf.js": "export const leaf = 2;\n",
  });
  const uses = await barrelUses(modules, parse, resolveBare);
  assert.deepEqual(uses.get("/p/user.js"), ["/p/leaf.js", "/p/own.js"]);
});
