// Chunk placement: DOM v2 `_spread` lives in its own module (`dom-v2-spread.ts`), so an eager chunk that
// uses other v2 helpers does not carry the spread code or the style runtime it imports (`_applyStyle`);
// they load with the (lazy) chunk whose template spreads — e.g. the router's `<Link {...rest}>`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { rolldown } from "rolldown";

const root = new URL("../../../", import.meta.url).pathname;
const runtime = root + "libs/runtime";
const sources: Record<string, string> = {
  eager: `import { _tpl, _insert, _on } from "@rivetjs/runtime/dom"; export const v2 = [_tpl, _insert, _on]; export const load = () => import("lazy");`,
  lazy: `import { _spread } from "@rivetjs/runtime/dom"; export const spread = _spread;`,
};

test("an eager v2 chunk does not carry _spread or the style runtime", async () => {
  const build = await rolldown({
    input: { eager: "eager" },
    cwd: runtime,
    platform: "browser",
    logLevel: "silent",
    resolve: { conditionNames: ["import", "production", "default"] },
    plugins: [{ name: "entries", resolveId: (id) => (id in sources ? id : null), load: (id) => sources[id] ?? null }],
  });
  const { output } = await build.generate({ format: "esm", minify: true });
  const chunks = new Map(output.flatMap((o) => (o.type === "chunk" ? [[o.fileName, o] as const] : [])));
  const eager = new Set<string>();
  const visit = (name: string) => {
    if (eager.has(name)) return;
    eager.add(name);
    for (const next of chunks.get(name)!.imports) visit(next);
  };
  visit([...chunks.values()].find((c) => c.isEntry)!.fileName);
  const eagerModules = [...eager].flatMap((name) => chunks.get(name)!.moduleIds.map((id) => id.slice(root.length)));
  assert.ok(eagerModules.includes("libs/runtime/dom-v2.ts"), "eager closure uses dom-v2");
  for (const file of ["libs/runtime/dom-v2-spread.ts", "libs/runtime/style.ts"]) assert.ok(!eagerModules.includes(file), `eager closure bundles ${file}`);
  const all = [...chunks.values()].flatMap((c) => c.moduleIds.map((id) => id.slice(root.length)));
  assert.ok(all.includes("libs/runtime/dom-v2-spread.ts") && all.includes("libs/runtime/style.ts"), "the lazy chunk carries the spread");
});
