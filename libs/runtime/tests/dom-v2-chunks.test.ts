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

test("a chunk importing _serverBranch from /dom does not bundle the resume adoption module", async () => {
  // `_serverBranch` reads dom-adopt through the `_adoption.key` hook: a component chunk using it (kit Transition, cdk
  // animation / shared-element-transition) must not pull `dom-adopt.ts` in — a module shared with the resume entry
  // was split into its own `dom-adopt-*.js` chunk, one more request before the first interaction.
  const build = await rolldown({
    input: { component: "component" },
    cwd: runtime,
    platform: "browser",
    logLevel: "silent",
    resolve: { conditionNames: ["import", "production", "default"] },
    plugins: [
      {
        name: "entries",
        resolveId: (id) => (id === "component" ? id : null),
        load: (id) => (id === "component" ? `import { _serverBranch, _tpl } from "@rivetjs/runtime/dom"; export const c = [_serverBranch, _tpl];` : null),
      },
    ],
  });
  const { output } = await build.generate({ format: "esm", minify: true });
  const modules = output.flatMap((o) => (o.type === "chunk" ? o.moduleIds.map((id) => id.slice(root.length)) : []));
  assert.ok(modules.includes("libs/runtime/dom-v2.ts"));
  assert.ok(!modules.includes("libs/runtime/dom-adopt.ts"), "dom-adopt.ts bundled with _serverBranch");
});

test("the resume runtime does not carry _spread: dom-resume reads the takeover hook from its own slot module", async () => {
  // `dom-resume.ts` imported `_takeover` from `dom-v2-spread.ts`: the spread module (and `style.ts`) sat in the resume
  // runtime's graph on every page, also when no template on it spreads (DIET-CODE 2026-10-22: `dom-v2-takeover.ts`).
  const build = await rolldown({
    input: { entry: "entry" },
    cwd: runtime,
    platform: "browser",
    logLevel: "silent",
    resolve: { conditionNames: ["import", "production", "default"] },
    plugins: [
      {
        name: "entries",
        resolveId: (id) => (id === "entry" || id === "lazy" ? id : null),
        load: (id) =>
          id === "entry"
            ? `import { createResume } from "@rivetjs/runtime/dom-resume"; export const r = createResume; export const load = () => import("lazy");`
            : id === "lazy"
              ? sources.lazy!
              : null,
      },
    ],
  });
  const { output } = await build.generate({ format: "esm", minify: true });
  const chunks = output.flatMap((o) => (o.type === "chunk" ? [o] : []));
  const eager = new Set<string>();
  const visit = (name: string) => {
    if (eager.has(name)) return;
    eager.add(name);
    for (const next of chunks.find((c) => c.fileName === name)!.imports) visit(next);
  };
  visit(chunks.find((c) => c.isEntry)!.fileName);
  const eagerModules = chunks.filter((c) => eager.has(c.fileName)).flatMap((c) => c.moduleIds.map((id) => id.slice(root.length)));
  assert.ok(eagerModules.includes("libs/runtime/dom-resume.ts") && eagerModules.includes("libs/runtime/dom-v2-takeover.ts"), "resume runtime closure");
  for (const file of ["libs/runtime/dom-v2-spread.ts", "libs/runtime/style.ts"]) assert.ok(!eagerModules.includes(file), `resume runtime bundles ${file}`);
  const all = chunks.flatMap((c) => c.moduleIds.map((id) => id.slice(root.length)));
  assert.ok(all.includes("libs/runtime/dom-v2-spread.ts"), "the lazy chunk carries the spread");
});
