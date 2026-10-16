// `serve` change detection (tools/watch.ts): which changed files matter and what they rebuild.
import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { test } from "vitest";
import { classify, hasWork, ignored, mergePlans, watchedDirs, type Graphs } from "../tools/watch.ts";
import { pagesOf } from "../tools/rebuild.ts";

const repo = "/repo";
const root = "/repo/apps/site";
const ids = ["menu-basic", "select-css", "tabs-basic"];
const graphs: Graphs = {
  site: new Set(["libs/cdk/menu/index.ts", "libs/docs-kit/components/DocPage.tsx", "libs/runtime/dom.ts"]),
};
const plan = (files: string[], g: Graphs = graphs) =>
  classify(
    files.map((f) => resolve(repo, f)),
    { root, repo, graphs: g, exists: (id) => ids.includes(id) },
  );

test("ignored: generated files, build output, tests and docs are not sources", () => {
  const is = (path: string) => ignored(resolve(repo, path), root, repo);
  for (const path of [
    "apps/site/dist/client/index.html",
    "apps/site/.artifacts/examples/menu-basic/src/routes/index.tsx",
    "apps/site/src/routes/(docs)/components/menu.tsx",
    "apps/site/src/routes/search.tsx",
    "apps/site/src/routes/examples/[id].tsx",
    "apps/site/src/generated/nav.ts",
    "apps/site/src/generated/examples.json",
    "apps/site/src/generated/example-frames/menu-basic.tsx",
    "apps/site/src/generated/example-css/0123456789.css",
    "apps/site/.rivet/entry.server.tsx",
    "apps/site/CLAUDE.md",
    "libs/cdk/tests/menu.test.ts",
    "libs/cdk/menu/CLAUDE.md",
    "libs/compiler/rust/src/compile/dom_v2.rs",
    "libs/cdk/node_modules/x/index.js",
    "apps/other/content/a.md",
    "apps/site/content/components/.!62139!menu.md",
    "apps/site/content/.DS_Store",
    "libs/cdk/menu/index.ts~",
    // Atomic-write temps (renamed over the target right after).
    "libs/ui/src/components/slider/slider.tsx.tmp.65857.c9a91d4f22c2",
    "apps/site/content/components/menu.md.tmp.123.abc",
    "apps/site/src/generated/api.json.4242.mgx1a2b.tmp",
    "apps/site/examples/menu-basic/src/routes/index.tsx.tmp",
    "libs/cdk/menu/index.ts___jb_tmp___",
    "libs/cdk/menu/index.ts___jb_old___",
    "apps/site/content/components/menu.md.crswap",
    "libs/cdk/menu/4913",
    "templates/starter-static/src/document.ts.tmp.9.f00",
  ])
    assert.equal(is(path), true, path);
  for (const path of [
    "apps/site/content/components/menu.md",
    "apps/site/content/_nav/forms.ts",
    "apps/site/examples/menu-basic/src/routes/index.tsx",
    "apps/site/src/routes/_layout.tsx",
    "apps/site/src/generated/api.json",
    "apps/site/api.config.ts",
    "apps/site/site.config.ts",
    "libs/cdk/menu/index.ts",
    "libs/compiler/rivet_compiler.wasm",
    "templates/starter-static/vite.config.ts",
    // Real sources that only look temp-ish.
    "libs/cdk/tmp/index.ts",
    "libs/cdk/menu/state.tmp.ts",
    "apps/site/content/components/tmp.md",
  ])
    assert.equal(is(path), false, path);
});

test("classify: a content page → content + affected pages only", () => {
  const p = plan(["apps/site/content/components/menu.md"]);
  assert.deepEqual([p.content, p.site, p.examples, p.api], [true, "pages", [], false]);
  assert.deepEqual(p.changed, ["apps/site/content/components/menu.md"]);
});

test("classify: an example's file → that example + its pages; a deleted / shared example file → every page", () => {
  const p = plan(["apps/site/examples/select-css/src/routes/index.tsx", "apps/site/examples/select-css/example.ts"]);
  assert.deepEqual([p.examples, p.content, p.site], [["select-css"], true, "pages"]);
  const gone = plan(["apps/site/examples/old-demo/example.ts"]);
  assert.deepEqual([gone.examples, gone.site], [[], "full"]);
  assert.equal(plan(["apps/site/examples/_assets/robot.jpg"]).site, "full");
  assert.equal(hasWork(plan(["apps/site/examples/README.md"])), false);
});

test("classify: a library file → full site when the site graph has it", () => {
  assert.equal(plan(["libs/cdk/menu/index.ts"]).site, "full");
  // Not in the graph: nothing to do.
  const unrelated = plan(["libs/forms/index.ts"]);
  assert.deepEqual([unrelated.site, unrelated.examples], ["none", []]);
  assert.equal(hasWork(unrelated), false);
  // No site graph recorded yet: rebuild the site.
  assert.equal(plan(["libs/forms/index.ts"], { site: undefined }).site, "full");
});

test("classify: build tooling (compiler, Vite plugins, docs-kit tools) → full site", () => {
  for (const file of [
    "libs/compiler/rivet_compiler.wasm",
    "libs/compiler/vite.ts",
    "libs/router/build/vite.ts",
    "libs/docs-kit/tools/content/markdown.ts",
    "libs/i18n/vite.ts",
  ])
    assert.equal(plan([file]).site, "full", file);
});

test("classify: app source, config, api.config, templates", () => {
  assert.equal(plan(["apps/site/src/routes/_layout.tsx"]).site, "full");
  assert.equal(plan(["apps/site/vite.config.ts"]).site, "full");
  const api = plan(["apps/site/api.config.ts"]);
  assert.deepEqual([api.api, api.site], [true, "full"]);
  const template = plan(["templates/starter-static/src/styles.css"]);
  assert.deepEqual([template.content, template.site], [true, "full"]);
});

test("mergePlans: union of both batches", () => {
  const a = plan(["apps/site/content/a.md", "apps/site/examples/select-css/example.ts"]);
  const b = plan(["libs/cdk/menu/index.ts"]);
  const merged = mergePlans(a, b);
  assert.deepEqual([merged.site, merged.examples, merged.content], ["full", ["select-css"], true]);
  assert.deepEqual(
    watchedDirs(resolve(import.meta.dirname, "../../../apps/docs"), resolve(import.meta.dirname, "../../..")).map((dir) => dir.split("/").slice(-1)[0]),
    ["content", "examples", "src", "templates", "libs"],
  );
});

test("pagesOf: content route files → page paths; any other generated file → every page", () => {
  assert.deepEqual(pagesOf(["src/routes/(docs)/components/menu.tsx", "src/routes/(docs)/start/index.tsx"]), ["/components/menu/", "/start/"]);
  assert.deepEqual(pagesOf([]), []);
  assert.equal(pagesOf(["src/routes/(docs)/components/menu.tsx", "src/generated/nav.ts"]), null);
  assert.equal(pagesOf(["src/routes/search.tsx"]), null);
});
