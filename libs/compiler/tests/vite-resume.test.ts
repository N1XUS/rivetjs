import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";
import { rivet } from "../vite.ts";

/** Shape of the emitted `.vite/rivet-resume.json` as read by these tests. */
interface BuiltManifest {
  hash: string;
  runtime: string;
  loader: string;
  symbols: Record<string, string>;
  sizes: Record<string, number>;
  deps: Record<string, string[]>;
  depsModules: boolean;
  lazy: Record<string, string[]>;
  preload: Record<string, string>;
  groups: string[][];
}

test("resume client build emits one symbol chunk per component and a manifest", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-resume-"));
  try {
    await mkdir(resolve(root, "src"));
    await writeFile(
      resolve(root, "src/page.tsx"),
      `import { signal } from "@rivetjs/reactivity";
const label = (n: number) => "count " + n;
const later = () => import("./later.js");
export function First() {
  const count = signal(0);
  return <button onClick={() => later().then(() => count.update((v) => v + 1))}>{label(count())}</button>;
}
export function Second() {
  const on = signal(false);
  return <p class={on() ? "SECOND_ON" : "SECOND_OFF"} onClick={() => import("./inline.js").then(() => on.set(!on()))}>second body text</p>;
}
`,
    );
    await writeFile(resolve(root, "src/later.js"), "export const LATER = 1;\n");
    // Relative import() inside a symbol body: resolves against the source module.
    await writeFile(resolve(root, "src/inline.js"), "export const INLINE = 1;\n");
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [
        rivet({
          resume: {
            modules: ["src/page.tsx"],
            chunks: "component",
            preload: {
              rules: [
                { match: "src/page.tsx#Second", strategy: "idle" },
                { match: /Second/, strategy: "eager" },
              ],
            },
          },
        }),
      ],
      build: { outDir: "dist", manifest: true, minify: false },
    });
    const manifest: BuiltManifest = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8"));
    assert.match(manifest.hash, /^[0-9a-f]{16}$/);
    assert.match(manifest.runtime, /^\/assets\/resume-entry-.*\.js$/);
    // The resume loader module (scheduled prefetch, idle evaluation): its own hashed chunk, importing nothing.
    assert.match(manifest.loader, /^\/assets\/resume-loader-.*\.js$/);
    const loaderCode = await readFile(resolve(root, "dist" + manifest.loader), "utf8");
    assert.match(loaderCode, /export\s*\{|export default/);
    assert.doesNotMatch(loaderCode, /^\s*import\s/m);
    const ids = Object.keys(manifest.symbols).sort();
    // Content-hash ids (`<Component>$<6 base-36>`), two per component.
    assert.deepEqual(
      ids.map((id) => id.replace(/\$[0-9a-z]{3,13}$/, "$h")),
      ["src/page.tsx#First$h", "src/page.tsx#First$h", "src/page.tsx#Second$h", "src/page.tsx#Second$h"],
    );
    const first = manifest.symbols[ids[0]!],
      second = manifest.symbols[ids[2]!];
    assert.notEqual(first, second);
    assert.equal(manifest.symbols[ids[1]!], first);
    // Chunk sizes for preload tie-breaks; first matching rule wins.
    assert.equal(manifest.sizes[first], Buffer.byteLength(await readFile(resolve(root, "dist" + first))));
    // Shared chunks in a symbol chunk's static closure have sizes too (the server's background prefetch budget).
    assert.ok(manifest.deps[first]!.length > 0);
    for (const url of manifest.deps[first]!) assert.equal(manifest.sizes[url], Buffer.byteLength(await readFile(resolve(root, "dist" + url))), url);
    // Deps modules next to each symbol chunk / the runtime: `export default` its static import closure (`deps`; empty
    // for a chunk that imports nothing, so the loader never requests a missing one).
    assert.equal(manifest.depsModules, true);
    for (const url of [...new Set(Object.values(manifest.symbols)), manifest.runtime])
      assert.equal(
        await readFile(resolve(root, "dist" + url.replace(/\.js$/, ".deps.js")), "utf8"),
        `export default ${JSON.stringify(manifest.deps[url] ?? [])};\n`,
        url,
      );
    // Lazy imports reachable from the First chunk (through the shared module-scope chunk).
    assert.equal(manifest.lazy[first].length, 1);
    assert.match(manifest.lazy[first][0], /^\/assets\/later-.*\.js$/);
    assert.ok(manifest.lazy[second].some((url) => /^\/assets\/inline-.*\.js$/.test(url)));
    assert.deepEqual(manifest.preload, { [ids[2]!]: "idle", [ids[3]!]: "idle" });
    const firstCode = await readFile(resolve(root, "dist" + first), "utf8");
    const secondCode = await readFile(resolve(root, "dist" + second), "utf8");
    // Component bodies are never shipped: no templates, no other component's code.
    assert.doesNotMatch(firstCode, /SECOND_ON|second body text|__rivetSpec|signal\(0\)/);
    assert.match(firstCode, /export\s*\{/);
    assert.doesNotMatch(secondCode, /count /);
    // Shared scope chunks keep module-scope values only; component functions are tree-shaken away.
    for (const file of await readdir(resolve(root, "dist/assets")))
      assert.doesNotMatch(await readFile(resolve(root, "dist/assets", file), "utf8"), /second body text|__rivetSpec/, file);
    const runtime = await readFile(resolve(root, "dist" + manifest.runtime), "utf8");
    assert.match(runtime, /createResume|rivet:resume-error/);
    // Resume chunks (and their static imports) compile eagerly; lazily imported modules stay lazy.
    for (const code of [runtime, firstCode, secondCode]) assert.ok(code.startsWith("//# allFunctionsCalledOnLoad\n"));
    assert.ok(!(await readFile(resolve(root, "dist" + manifest.lazy[first][0]), "utf8")).startsWith("//# allFunctionsCalledOnLoad"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("framework component elements with constant props ship no code in handler chunks", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-static-"));
  try {
    await mkdir(resolve(root, "src"));
    await writeFile(
      resolve(root, "src/page.tsx"),
      `import { signal } from "@rivetjs/reactivity";
import { Picture } from "@rivetjs/runtime/image";
import { Link } from "@rivetjs/router/link";
const hero = { src: "/hero.jpg", width: 4, height: 3, layout: "fixed", sources: [{ type: "image/jpeg", srcset: "/hero.jpg" }] } as const;
export function Page() {
  const n = signal(0);
  return <div><Picture image={hero} alt="" /><Link to="/x">x</Link><button onClick={() => n.set(n() + 1)}>+</button><output>{n()}</output></div>;
}
`,
    );
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [rivet({ resume: { modules: ["src/page.tsx"] } })],
      build: { outDir: "dist", manifest: true, minify: false },
    });
    const manifest: BuiltManifest = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8"));
    assert.deepEqual(
      Object.keys(manifest.symbols).map((id) => id.replace(/\$[0-9a-z]{3,13}$/, "$h")),
      ["src/page.tsx#Page$h", "src/page.tsx#Page$h"],
    );
    const chunks = new Set(Object.values(manifest.symbols));
    for (const url of chunks) {
      const code = await readFile(resolve(root, "dist" + url), "utf8");
      assert.doesNotMatch(code, /Picture|data-rivet-prefetch|srcset/, url);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const groupFixture = async (root: string) => {
  await mkdir(resolve(root, "src"), { recursive: true });
  await writeFile(
    resolve(root, "src/page.tsx"),
    `import { signal } from "@rivetjs/reactivity";
import { ChunkGroup, lazyComponent } from "@rivetjs/runtime/server";
import { Card } from "./card.js";
const Detail = lazyComponent(() => import("./detail.js"));
export function Label() { const n = signal(0); return <b onClick={() => n.set(1)}>{n()}</b>; }
export function Page() {
  const n = signal(0);
  return <main><button onClick={() => n.set(1)}>{n()}</button><Label /><ChunkGroup name="cards" preload="visible"><Card /></ChunkGroup><Detail /></main>;
}
`,
  );
  await writeFile(
    resolve(root, "src/card.tsx"),
    `import { signal } from "@rivetjs/reactivity";
export function Label() { const n = signal(0); return <u onClick={() => n.set(2)}>{n()}</u>; }
export function Card() { const on = signal(false); return <p onClick={() => on.set(!on())}>{on() ? "a" : "b"}<Label /></p>; }
`,
  );
  await writeFile(
    resolve(root, "src/detail.tsx"),
    `import { signal } from "@rivetjs/reactivity";
export const preload = "idle";
export function Detail() { const x = signal(0); return <i onClick={() => x.set(1)}>{x()}</i>; }
export default Detail;
`,
  );
  await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
};
const buildGroups = async (root: string, chunks: "component" | "group" | "route"): Promise<BuiltManifest> => {
  await build({
    configFile: false,
    root,
    logLevel: "silent",
    plugins: [
      rivet({
        resume: { modules: ["src/page.tsx", "src/card.tsx", "src/detail.tsx"], chunks, preload: { rules: [{ match: "src/detail.tsx", strategy: "eager" }] } },
      }),
    ],
    build: { outDir: "dist-" + chunks, manifest: true, minify: false },
  });
  return JSON.parse(await readFile(resolve(root, "dist-" + chunks + "/.vite/rivet-resume.json"), "utf8"));
};

test("chunk strategies: ChunkGroup and route grouping, component-level preload, sibling groups", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-groups-"));
  try {
    await groupFixture(root);
    const url = (m: BuiltManifest, id: string) => m.symbols[Object.keys(m.symbols).find((s) => s.startsWith(id))!];
    // component: one chunk per component; ChunkGroup preload and module `export const preload` beat app rules.
    const component = await buildGroups(root, "component");
    const chunksOf = (m: BuiltManifest) => new Set(Object.values(m.symbols));
    assert.equal(chunksOf(component).size, 5);
    assert.equal(component.preload[Object.keys(component.symbols).find((s) => s.startsWith("src/card.tsx#Card"))!], "visible");
    assert.equal(component.preload[Object.keys(component.symbols).find((s) => s.startsWith("src/detail.tsx#Detail"))!], "idle");
    // Card and card.tsx's Label are both inside the ChunkGroup: siblings.
    assert.ok(component.groups.some((g) => g.includes(url(component, "src/card.tsx#Card")) && g.includes(url(component, "src/card.tsx#Label"))));
    // group: the ChunkGroup's components share one chunk; page components keep theirs.
    const group = await buildGroups(root, "group");
    assert.equal(url(group, "src/card.tsx#Card"), url(group, "src/card.tsx#Label"));
    assert.notEqual(url(group, "src/page.tsx#Page"), url(group, "src/card.tsx#Card"));
    assert.notEqual(url(group, "src/page.tsx#Label"), url(group, "src/card.tsx#Label"));
    // route: main graph (page + card) in one chunk, the lazy detail route in its own.
    const route = await buildGroups(root, "route");
    assert.equal(url(route, "src/page.tsx#Page"), url(route, "src/card.tsx#Card"));
    assert.notEqual(url(route, "src/page.tsx#Page"), url(route, "src/detail.tsx#Detail"));
    // Route chunks import one part per module, and each part registers its symbols under its module id (`_rSym`), so
    // the same symbol names from two modules stay apart without `__rivet(id)` or the chunk's export names.
    const main = await readFile(resolve(root, "dist-route" + url(route, "src/page.tsx#Page")), "utf8");
    assert.doesNotMatch(main, /\b__rivet\b/);
    for (const [file, name] of [
      ["src/page.tsx", "Label"],
      ["src/card.tsx", "Label"],
    ]) {
      const id = Object.keys(route.symbols).find((s) => s.startsWith(file + "#" + name))!;
      const suffix = id.slice(id.indexOf("#") + 1).replace(/\$/g, "\\$");
      assert.match(main, new RegExp(`_rSym\\(${JSON.stringify(file)}, \\{[^}]*(?:"${suffix}"|${suffix}): `), file);
    }
    // The chunk evaluates (registration runs) and exports nothing of its own.
    const mod = await import(resolve(root, "dist-route" + url(route, "src/page.tsx#Page")));
    assert.deepEqual(Object.keys(mod), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("route chunks: imports through a .ts barrel reach their leaves; shared modules are placed by the bundler; fetchAhead", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-route-"));
  try {
    await mkdir(resolve(root, "src/lib"), { recursive: true });
    const leaf = (name: string) => `import { signal } from "@rivetjs/reactivity";
export function ${name}() { const n = signal(0); return <b onClick={() => n.set(1)}>{n()}</b>; }
`;
    for (const name of ["A", "B", "C", "D", "E", "F", "G"]) await writeFile(resolve(root, `src/lib/${name.toLowerCase()}.tsx`), leaf(name));
    // A component library barrel: `export *`, a renamed re-export and a compound defined in the barrel itself.
    await writeFile(
      resolve(root, "src/lib/index.ts"),
      'export * from "./a.tsx";\nexport * from "./b.tsx";\nexport { C as Cee } from "./c.tsx";\nexport * from "./d.tsx";\nexport * from "./compound.ts";\nexport * from "./cyc1.ts";\n',
    );
    // A compound module (`Object.assign(Root, { Part })`, like a ui component's index.ts) and a circular `export *` pair.
    await writeFile(
      resolve(root, "src/lib/compound.ts"),
      'import { E } from "./e.tsx";\nimport { F } from "./f.tsx";\nexport const Box = Object.assign(E, { F });\n',
    );
    await writeFile(resolve(root, "src/lib/cyc1.ts"), 'export * from "./cyc2.ts";\nexport * from "./g.tsx";\n');
    await writeFile(resolve(root, "src/lib/cyc2.ts"), 'export * from "./cyc1.ts";\n');
    const route = (name: string, uses: string[], from = "./lib/index.ts") =>
      `import { ${uses.join(", ")} } from "${from}";
export default function ${name}() { return <main>${uses.map((u) => `<${u} />`).join("")}</main>; }
`;
    await writeFile(resolve(root, "src/r1.tsx"), route("R1", ["A"]));
    await writeFile(resolve(root, "src/r2.tsx"), route("R2", ["A", "B"]));
    await writeFile(resolve(root, "src/r3.tsx"), route("R3", ["B", "Cee"]));
    await writeFile(resolve(root, "src/r4.tsx"), route("R4", ["Box", "G"]));
    // Through the other module of the cycle: G still reached (a miss cut short by the cycle is not memoized).
    await writeFile(resolve(root, "src/r5.tsx"), route("R5", ["G"], "./lib/cyc2.ts"));
    await writeFile(
      resolve(root, "src/app.tsx"),
      `import { lazyComponent } from "@rivetjs/runtime/server";
const R1 = lazyComponent(() => import("./r1.tsx"));
const R2 = lazyComponent(() => import("./r2.tsx"));
const R3 = lazyComponent(() => import("./r3.tsx"));
const R4 = lazyComponent(() => import("./r4.tsx"));
const R5 = lazyComponent(() => import("./r5.tsx"));
export function App() { return <div><R1 /><R2 /><R3 /><R4 /><R5 /></div>; }
`,
    );
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    const modules = [
      "src/app.tsx",
      "src/r1.tsx",
      "src/r2.tsx",
      "src/r3.tsx",
      "src/r4.tsx",
      "src/r5.tsx",
      ...["a", "b", "c", "d", "e", "f", "g"].map((n) => `src/lib/${n}.tsx`),
    ];
    const run = async (chunks: "component" | "route" | undefined, merge?: false) => {
      const out = "dist-" + (chunks ?? "default") + (merge === false ? "-split" : "");
      await build({
        configFile: false,
        root,
        logLevel: "silent",
        plugins: [rivet({ resume: { modules, ...(chunks ? { chunks } : {}), ...(merge === false ? { merge } : {}) } })],
        build: { outDir: out, manifest: true, minify: false },
      });
      return JSON.parse(await readFile(resolve(root, out + "/.vite/rivet-resume.json"), "utf8")) as BuiltManifest & { fetchAhead?: boolean };
    };
    // Route mode is the default: every route-mode branch must read the resolved strategy, not the raw option (a
    // defaulted build once used the per-chunk part scheme and never imported the placed parts: "no chunk holds").
    const m = await run(undefined);
    const url = (id: string, manifest = m) => manifest.symbols[Object.keys(manifest.symbols).find((s) => s.startsWith(id))!]!;
    // A: routes 1 + 2; B: routes 2 + 3; C (renamed `Cee`): route 3 only. Shared modules are placed by the bundler: A and
    // B are not import-adjacent, so each sits in its own chunk (the routes using it), not a route chunk, not main.
    const routes = ["src/r1.tsx#R1", "src/r2.tsx#R2", "src/r3.tsx#R3", "src/r4.tsx#R4", "src/r5.tsx#R5", "src/app.tsx#App"].map((id) => url(id));
    assert.notEqual(url("src/lib/a.tsx#A"), url("src/lib/b.tsx#B"));
    assert.ok(!routes.includes(url("src/lib/a.tsx#A")) && !routes.includes(url("src/lib/b.tsx#B")));
    assert.equal(url("src/lib/c.tsx#C"), url("src/r3.tsx#R3"));
    // D is exported by the barrel but imported by no route: main (with the app), never in a route's chunk.
    assert.equal(url("src/lib/d.tsx#D"), url("src/app.tsx#App"));
    // The compound reaches both modules it imports: route 4 only.
    assert.equal(url("src/lib/e.tsx#E"), url("src/r4.tsx#R4"));
    assert.equal(url("src/lib/f.tsx#F"), url("src/r4.tsx#R4"));
    // G behind the cycle, imported by routes 4 and 5: placed too (no route in common with A / B), not main.
    assert.ok(!routes.includes(url("src/lib/g.tsx#G")));
    assert.notEqual(url("src/lib/g.tsx#G"), url("src/lib/a.tsx#A"));
    // Placed chunks carry sizes and deps like symbol chunks (the server plans and fetches them ahead).
    assert.ok(m.sizes[url("src/lib/a.tsx#A")]! > 0);
    assert.equal(m.fetchAhead, true);
    // `merge: false`: the bundler's split alone — the same placement here.
    const split = await run("route", false);
    assert.notEqual(url("src/lib/a.tsx#A", split), url("src/lib/b.tsx#B", split));
    assert.equal((await run("component")).fetchAhead, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resume.merge: small shared modules loaded by the same symbol chunks merge into one chunk; false = the bundler's split", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-merge-"));
  try {
    await mkdir(resolve(root, "src"));
    // A uses x → y, B uses z → y: the bundler emits x {A}, y {A, B}, z {B} as three shared chunks.
    await writeFile(resolve(root, "src/y.ts"), "export const y = (n: number) => n + 1;\n");
    await writeFile(resolve(root, "src/x.ts"), 'import { y } from "./y.ts";\nexport const x = (n: number) => y(n) * 2;\n');
    await writeFile(resolve(root, "src/z.ts"), 'import { y } from "./y.ts";\nexport const z = (n: number) => y(n) * 3;\n');
    const view = (name: string, use: string) => `import { signal } from "@rivetjs/reactivity";
import { ${use} } from "./${use}.ts";
export function ${name}() { const n = signal(1); return <b onClick={() => n.set(${use}(n()))}>{n()}</b>; }
`;
    await writeFile(resolve(root, "src/a.tsx"), view("A", "x"));
    await writeFile(resolve(root, "src/b.tsx"), view("B", "z"));
    await writeFile(
      resolve(root, "src/page.tsx"),
      `import { A } from "./a.tsx";\nimport { B } from "./b.tsx";\nexport function Page() { return <div><A /><B /></div>; }\n`,
    );
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    const run = async (merge: false | undefined, out: string) => {
      await build({
        configFile: false,
        root,
        logLevel: "silent",
        plugins: [rivet({ resume: { modules: ["src/page.tsx", "src/a.tsx", "src/b.tsx"], chunks: "component", ...(merge === false ? { merge } : {}) } })],
        build: { outDir: out, manifest: true, minify: false },
      });
      const manifest: BuiltManifest = JSON.parse(await readFile(resolve(root, out, ".vite/rivet-resume.json"), "utf8"));
      const url = (prefix: string) => manifest.symbols[Object.keys(manifest.symbols).find((s) => s.startsWith(prefix))!]!;
      return { manifest, a: url("src/a.tsx#A"), b: url("src/b.tsx#B"), files: (await readdir(resolve(root, out, "assets"))).filter((f) => f.endsWith(".js")) };
    };
    const split = await run(false, "dist-split");
    const merged = await run(undefined, "dist-merged");
    const shared = (r: typeof split) => new Set([...(r.manifest.deps[r.a] ?? []), ...(r.manifest.deps[r.b] ?? [])]);
    assert.ok(merged.files.length < split.files.length, `${merged.files.length} vs ${split.files.length}`);
    // A and B now load the same merged chunk for x / y / z.
    const common = (merged.manifest.deps[merged.a] ?? []).filter((d) => (merged.manifest.deps[merged.b] ?? []).includes(d));
    assert.ok(common.length >= 1);
    assert.ok(shared(merged).size < shared(split).size);
    // The merged chunks still run: the symbol chunks of A and B evaluate and expose their symbols.
    const mod = await import(resolve(root, "dist-merged" + merged.a));
    assert.ok(Object.keys(mod).length > 0);
    assert.ok(Object.keys(await import(resolve(root, "dist-merged" + merged.b))).length > 0);
    // Symbol → chunk stays as it was: the same symbols, partitioned into the same chunks, each an entry chunk.
    const partition = (r: typeof split) => {
      const byUrl = new Map<string, string[]>();
      for (const [symbol, url] of Object.entries(r.manifest.symbols)) byUrl.set(url, [...(byUrl.get(url) ?? []), symbol]);
      return [...byUrl.values()].map((list) => list.sort().join(" ")).sort();
    };
    assert.deepEqual(partition(merged), partition(split));
    const viteManifest: Record<string, { file: string; isEntry?: boolean }> = JSON.parse(
      await readFile(resolve(root, "dist-merged/.vite/manifest.json"), "utf8"),
    );
    const entryFiles = new Set(Object.values(viteManifest).flatMap((chunk) => (chunk.isEntry ? ["/" + chunk.file] : [])));
    for (const url of Object.values(merged.manifest.symbols)) assert.ok(entryFiles.has(url), url);
    // Merged chunks carry the rivet-merge- prefix.
    assert.ok(
      merged.files.some((f) => f.startsWith("rivet-merge-")),
      merged.files.join(" "),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resume.merge: the dev server and SSR builds add no chunk group; a client build appends one", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-merge-hooks-"));
  try {
    const hooks = (command: "serve" | "build", ssr: boolean, merge?: false) => {
      const plugin = rivet({ resume: { modules: [], ...(merge === false ? { merge } : {}) } }) as unknown as {
        configResolved: (config: object) => void;
        outputOptions: (options: object) => { codeSplitting?: { groups: { debugName: string }[] } } | undefined;
      };
      plugin.configResolved.call({}, { command, root, build: { ssr }, plugins: [] });
      return plugin.outputOptions.call({}, {});
    };
    assert.equal(hooks("serve", false), undefined);
    assert.equal(hooks("build", true), undefined);
    assert.equal(hooks("build", false, false), undefined);
    assert.deepEqual(
      hooks("build", false)?.codeSplitting?.groups.map((g) => g.debugName),
      ["rivet-merge"],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Function Bridge T3: one chunk per import reference id (only that value, no component chunk), own references with their component, every spelling one id", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-refs-"));
  try {
    await mkdir(resolve(root, "src"));
    await writeFile(resolve(root, "src/util.js"), "export const double = (x) => x * 2;\n");
    const view = (name: string, spec: string) => `import { signal } from "@rivetjs/reactivity";
import { double } from "${spec}";
const half = (x) => x / 2;
export function ${name}() { const n = signal(1); const api = { double, half }; return <b onClick={() => n.set(api.double(n()))}>${name.toUpperCase()}_BODY{n()}</b>; }
`;
    await writeFile(resolve(root, "src/a.tsx"), view("A", "./util.js"));
    await writeFile(resolve(root, "src/b.tsx"), view("B", "./util"));
    await writeFile(
      resolve(root, "src/page.tsx"),
      `import { A } from "./a.tsx";\nimport { B } from "./b.tsx";\nexport function Page() { return <div><A /><B /></div>; }\n`,
    );
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [rivet({ resume: { modules: ["src/page.tsx", "src/a.tsx", "src/b.tsx"], chunks: "component" } })],
      build: { outDir: "dist", manifest: true, minify: false },
    });
    const manifest: BuiltManifest & { deps?: Record<string, string[]> } = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8"));
    // One canonical id (the resolved module id) for `./util.js` and `./util`.
    const refs = Object.keys(manifest.symbols).filter((s) => s.startsWith("src/util.js#"));
    assert.equal(refs.length, 1, refs.join());
    const id = refs[0]!;
    // Own references live with their defining module: in the chunk of the component using them.
    for (const [module, component] of [
      ["src/a.tsx", "A"],
      ["src/b.tsx", "B"],
    ]) {
      const own = Object.keys(manifest.symbols).find((s) => s.startsWith(module + "#half$"))!;
      assert.match(own, /#half\$l\$[0-9a-z]{5}\$ref$/); // not exported: salted own id
      const sibling = Object.keys(manifest.symbols).find((s) => s.startsWith(module + "#" + component + "$"))!;
      assert.equal(manifest.symbols[own], manifest.symbols[sibling], own);
    }
    assert.match(id, /^src\/util\.js#double\$[0-9a-z]{5}\$ref$/);
    const url = manifest.symbols[id]!;
    assert.match(url, /resume-ref-double/);
    // Its own chunk: no component symbol shares it, nor does its import closure reach a component chunk.
    const components = new Set(
      Object.entries(manifest.symbols)
        .filter(([s]) => s !== id)
        .map(([, u]) => u),
    );
    assert.ok(!components.has(url));
    for (const dep of manifest.deps?.[url] ?? []) assert.ok(!components.has(dep), dep);
    const code = await readFile(resolve(root, "dist" + url), "utf8");
    assert.doesNotMatch(code, /A_BODY|B_BODY/);
    const mod = await import(resolve(root, "dist" + url));
    // A single-part chunk exports the symbol by its name (the id after `#`), as `dom-resume` `symbol()` reads it.
    const double = mod[id.slice(id.indexOf("#") + 1)] as () => (x: number) => number;
    assert.equal(double()(4), 8);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Function Bridge T3 (N3): a shared own reference gets its own chunk — B's page never loads A's chunk, an importer never loads the defining component's chunk", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-refs-shared-"));
  try {
    await mkdir(resolve(root, "src"));
    // `inc` (not exported) used by A and B of one module; `inc2` (exported) used by A2 and imported by C; `solo` used by A only.
    await writeFile(
      resolve(root, "src/m.tsx"),
      `import { signal } from "@rivetjs/reactivity";
const inc = (x) => x + 1;
const solo = (x) => x - 1;
export function A() { const n = signal(1); const api = { inc, solo }; return <b onClick={() => n.set(api.inc(n()))}>A_BODY{n()}</b>; }
export function B() { const n = signal(1); const api = { inc }; return <i onClick={() => n.set(api.inc(n()))}>B_BODY{n()}</i>; }
`,
    );
    await writeFile(
      resolve(root, "src/a2.tsx"),
      `import { signal } from "@rivetjs/reactivity";
export const inc2 = (x) => x + 2;
export function A2() { const n = signal(1); const api = { inc2 }; return <b onClick={() => n.set(api.inc2(n()))}>A2_BODY{n()}</b>; }
`,
    );
    await writeFile(
      resolve(root, "src/c.tsx"),
      `import { signal } from "@rivetjs/reactivity";
import { inc2 } from "./a2.tsx";
export function C() { const n = signal(1); const api = { inc2 }; return <u onClick={() => n.set(api.inc2(n()))}>C_BODY{n()}</u>; }
`,
    );
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [rivet({ resume: { modules: ["src/m.tsx", "src/a2.tsx", "src/c.tsx"], chunks: "component" } })],
      build: { outDir: "dist", manifest: true, minify: false },
    });
    const manifest: BuiltManifest & { deps?: Record<string, string[]> } = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8"));
    const find = (prefix: string) => {
      const ids = Object.keys(manifest.symbols).filter((s) => s.startsWith(prefix));
      assert.ok(ids.length > 0, prefix);
      return ids;
    };
    const urlOf = (prefix: string) => {
      const urls = new Set(find(prefix).map((id) => manifest.symbols[id]!));
      assert.equal(urls.size, 1, prefix + ": " + [...urls].join());
      return [...urls][0]!;
    };
    // Every chunk a symbol's chunk loads (its own url + the static import closure).
    const closure = (url: string) => new Set([url, ...(manifest.deps?.[url] ?? [])]);
    const a = urlOf("src/m.tsx#A$"),
      b = urlOf("src/m.tsx#B$"),
      a2 = urlOf("src/a2.tsx#A2$"),
      c = urlOf("src/c.tsx#C$");
    assert.notEqual(a, b);
    const inc = urlOf("src/m.tsx#inc$l$");
    const inc2Ids = find("src/a2.tsx#inc2$");
    assert.equal(inc2Ids.length, 1, inc2Ids.join()); // A2's own id = C's import id
    const inc2 = manifest.symbols[inc2Ids[0]!]!;
    // Shared refs: own per-id chunks, named after the value; a ref used by one component stays co-chunked.
    assert.match(inc, /resume-ref-inc/);
    assert.match(inc2, /resume-ref-inc2/);
    assert.equal(urlOf("src/m.tsx#solo$l$"), a);
    for (const [ref, owner] of [
      [inc, a],
      [inc, b],
      [inc2, a2],
    ])
      assert.ok(!closure(ref).has(owner), ref + " loads " + owner);
    // B's page (B's symbols + `inc`) never loads A's chunk; C (+ `inc2`) never loads A2's component chunk.
    for (const url of [...closure(b), ...closure(inc)]) assert.notEqual(url, a);
    for (const url of [...closure(c), ...closure(inc2)]) assert.notEqual(url, a2);
    for (const [url, body] of [
      [inc, /A_BODY|B_BODY/],
      [inc2, /A2_BODY|C_BODY/],
    ] as const)
      assert.doesNotMatch(await readFile(resolve(root, "dist" + url), "utf8"), body);
    const mod = await import(resolve(root, "dist" + inc2));
    const id = inc2Ids[0]!;
    assert.equal((mod[id.slice(id.indexOf("#") + 1)] as () => (x: number) => number)()(1), 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Function Bridge T3 (L2): an importer of an export alias reuses the own reference — no alias chunk, the own ref in its own chunk", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-refs-alias-"));
  try {
    await mkdir(resolve(root, "src"));
    await writeFile(
      resolve(root, "src/a.tsx"),
      `import { signal } from "@rivetjs/reactivity";
const inc = (x) => x + 1;
export { inc, inc as plus };
export function A() { const n = signal(1); const api = { inc }; return <b onClick={() => n.set(api.inc(n()))}>A_BODY{n()}</b>; }
`,
    );
    await writeFile(
      resolve(root, "src/c.tsx"),
      `import { signal } from "@rivetjs/reactivity";
import { plus } from "./a.tsx";
export function C() { const n = signal(1); const api = { plus }; return <u onClick={() => n.set(api.plus(n()))}>C_BODY{n()}</u>; }
`,
    );
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [rivet({ resume: { modules: ["src/a.tsx", "src/c.tsx"], chunks: "component" } })],
      build: { outDir: "dist", manifest: true, minify: false },
    });
    const manifest: BuiltManifest & { deps?: Record<string, string[]> } = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8"));
    const ids = Object.keys(manifest.symbols);
    assert.deepEqual(
      ids.filter((s) => s.startsWith("src/a.tsx#plus$")),
      [],
    );
    const own = ids.filter((s) => s.startsWith("src/a.tsx#inc$"));
    assert.equal(own.length, 1, own.join());
    const url = manifest.symbols[own[0]!]!;
    assert.match(url, /resume-ref-inc/);
    const a = manifest.symbols[ids.find((s) => s.startsWith("src/a.tsx#A$"))!]!;
    const c = manifest.symbols[ids.find((s) => s.startsWith("src/c.tsx#C$"))!]!;
    for (const dep of [url, ...(manifest.deps?.[url] ?? []), c, ...(manifest.deps?.[c] ?? [])]) assert.notEqual(dep, a);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Function Bridge T3 (G2): one import reference id resolving to two installed copies (eager + lazy route) is a build error naming both files", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-refs-copies-"));
  try {
    for (const [dir, version] of [
      ["node_modules/fake-util", "1.0.0"],
      ["src/lazy/node_modules/fake-util", "2.0.0"],
    ] as const) {
      await mkdir(resolve(root, dir), { recursive: true });
      await writeFile(resolve(root, dir, "package.json"), JSON.stringify({ name: "fake-util", version, type: "module", main: "index.js" }));
      await writeFile(resolve(root, dir, "index.js"), `export const double = (x) => x * 2; // ${version}\n`);
    }
    const view = (name: string) => `import { signal } from "@rivetjs/reactivity";
import { double } from "fake-util";
export function ${name}() { const n = signal(1); const api = { double }; return <b onClick={() => n.set(api.double(n()))}>{n()}</b>; }
`;
    await writeFile(resolve(root, "src/a.tsx"), view("A"));
    await writeFile(resolve(root, "src/lazy/b.tsx"), view("B"));
    await writeFile(
      resolve(root, "src/page.tsx"),
      `import { A } from "./a.tsx";\nconst lazy = () => import("./lazy/b.tsx");\nexport function Page() { return <div onClick={() => lazy()}><A /></div>; }\n`,
    );
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    const run = (files: string[]) =>
      build({
        configFile: false,
        root,
        logLevel: "silent",
        plugins: [rivet({ resume: { modules: files, chunks: "component" } })],
        build: { outDir: "dist", manifest: true, minify: false, emptyOutDir: true },
      });
    await assert.rejects(run(["src/page.tsx", "src/a.tsx", "src/lazy/b.tsx"]), (error: Error) => {
      assert.match(error.message, /module reference fake-util#double\$[0-9a-z]{5}\$ref names two different files/);
      assert.match(error.message, /node_modules\/fake-util\/index\.js \(imported by src\/a\.tsx\)/);
      assert.match(error.message, /src\/lazy\/node_modules\/fake-util\/index\.js \(imported by src\/lazy\/b\.tsx\)/);
      // Fix round 4 (L3 + RV code): the remedy and the registered code.
      assert.match(error.message, /\[RV2010\] Cannot resume: module reference/);
      assert.match(error.message, /`npm dedupe` \/ `pnpm dedupe`, or Vite `resolve\.dedupe: \["fake-util"\]`/);
      assert.equal((error as Error & { errors?: { pluginCode?: string }[] }).errors?.[0]?.pluginCode, "RV2010");
      return true;
    });
    // One copy for every importer: builds.
    await rm(resolve(root, "src/lazy/node_modules"), { recursive: true, force: true });
    await run(["src/page.tsx", "src/a.tsx", "src/lazy/b.tsx"]);
    // Fix round 4 (L4): a symlink to the same installed copy, kept as its own path by `resolve.preserveSymlinks`, is one
    // file (realpath), not two copies.
    await mkdir(resolve(root, "src/lazy/node_modules"), { recursive: true });
    await symlink(resolve(root, "node_modules/fake-util"), resolve(root, "src/lazy/node_modules/fake-util"), "dir");
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      resolve: { preserveSymlinks: true },
      plugins: [rivet({ resume: { modules: ["src/page.tsx", "src/a.tsx", "src/lazy/b.tsx"], chunks: "component" } })],
      build: { outDir: "dist", manifest: true, minify: false, emptyOutDir: true },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resume.lazyOwned: dynamic imports made only by an owning module stay out of the manifest's lazy lists (RA2)", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-owned-"));
  try {
    await mkdir(resolve(root, "src"));
    // `app.tsx` imports its route modules itself (like the router's generated `.rivet/app.tsx`).
    await writeFile(
      resolve(root, "src/app.tsx"),
      `import { signal } from "@rivetjs/reactivity";
const route = () => import("./route.js");
const shared = () => import("./shared.js");
export function App() {
  const n = signal(0);
  return <button onClick={() => route().then(() => n.update((v) => v + 1))}>{n()}</button>;
}
export const keep = shared;
`,
    );
    await writeFile(resolve(root, "src/page.tsx"), `export function Page() { return <i onClick={() => import("./shared.js")}>p</i>; }\n`);
    await writeFile(resolve(root, "src/route.js"), "export const ROUTE = 1;\n");
    await writeFile(resolve(root, "src/shared.js"), "export const SHARED = 1;\n");
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    const lazyOf = async (lazyOwned?: string[]) => {
      await build({
        configFile: false,
        root,
        logLevel: "silent",
        plugins: [rivet({ resume: { modules: ["src/app.tsx", "src/page.tsx"], ...(lazyOwned ? { lazyOwned } : {}) } })],
        build: { outDir: "dist", manifest: true, minify: false, emptyOutDir: true },
      });
      const manifest: BuiltManifest = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8"));
      return Object.values(manifest.lazy).flat();
    };
    const before = await lazyOf();
    assert.ok(
      before.some((url) => /\/route-.*\.js$/.test(url)),
      before.join(),
    );
    const after = await lazyOf(["src/app.tsx"]);
    // Owned: only app.tsx imports route.js → dropped; shared.js has another importer → kept.
    assert.ok(!after.some((url) => /\/route-.*\.js$/.test(url)), after.join());
    assert.equal(
      after.some((url) => /\/shared-.*\.js$/.test(url)),
      before.some((url) => /\/shared-.*\.js$/.test(url)),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resume manifest: a library's own import() is no lazy of its importer", async () => {
  await mkdir(".artifacts", { recursive: true });
  const dir = await mkdtemp(resolve(".artifacts/vite-lazy-app-"));
  const root = resolve(dir, "app");
  try {
    await mkdir(resolve(root, "src"), { recursive: true });
    await mkdir(resolve(dir, "lib"));
    // A library outside the Vite root (a workspace package / node_modules): `widget.js` loads `plugin.js` on use.
    await writeFile(
      resolve(dir, "lib/widget.js"),
      `export const BIG = ${JSON.stringify("x".repeat(10))};\nexport const plugin = () => import("./plugin.js");\n`,
    );
    await writeFile(resolve(dir, "lib/plugin.js"), "export const PLUGIN = 1;\n");
    await writeFile(
      resolve(root, "src/page.tsx"),
      `import { signal } from "@rivetjs/reactivity";
import { BIG, plugin } from "../../lib/widget.js";
export function Page() {
  const n = signal(0);
  return <button onClick={() => plugin().then(() => n.set(BIG.length))} onClickCapture={() => import("./own.js")}>{n()}</button>;
}
// A second chunk using the widget: it becomes a shared chunk both import.
export function Other() {
  const m = signal(0);
  return <i onClick={() => m.set(BIG.length + 1)}>{m()}</i>;
}
`,
    );
    await writeFile(resolve(root, "src/own.js"), "export const OWN = 1;\n");
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [rivet({ resume: { modules: ["src/page.tsx"] } })],
      build: { outDir: "dist", manifest: true, minify: false },
    });
    const manifest = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8")) as BuiltManifest;
    const chunk = Object.entries(manifest.symbols).find(([id]) => id.startsWith("src/page.tsx#Page$"))![1];
    const lazy = manifest.lazy?.[chunk] ?? [];
    assert.ok(
      lazy.some((url) => /\/own-.*\.js$/.test(url)),
      lazy.join(),
    );
    assert.ok(!lazy.some((url) => /\/plugin-.*\.js$/.test(url)), lazy.join());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("compiler warnings print once with their origin, code and location; the module still compiles (T10 W3)", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-warn-"));
  const { createServer } = await import("vite");
  const warnings: string[] = [];
  const server = await createServer({
    configFile: false,
    root,
    logLevel: "warn",
    customLogger: {
      info() {},
      warn: (message: string) => void warnings.push(message),
      warnOnce: (message: string) => void warnings.push(message),
      error() {},
      clearScreen() {},
      hasErrorLogged: () => false,
      hasWarned: false,
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [rivet({ resume: { modules: ["src/page.tsx"] } })],
  });
  try {
    await mkdir(resolve(root, "src"));
    await writeFile(
      resolve(root, "src/page.tsx"),
      `import { signal } from "@rivetjs/reactivity";
export function Page(props: { stmt: { bind(x: number): { id: number } } }) {
  const n = signal(0);
  const s = props.stmt.bind(4);
  return <button onClick={() => n.set(s.id)}>{n()}</button>;
}
`,
    );
    const client = await server.transformRequest("/src/page.tsx");
    const ssr = await server.transformRequest("/src/page.tsx", { ssr: true });
    assert.match(client!.code, /Page/);
    assert.match(ssr!.code, /Page/);
    const rv = warnings.filter((w) => w.includes("RV2013"));
    assert.equal(rv.length, 1, warnings.join("\n----\n"));
    assert.match(rv[0]!, /\[rivet:compiler\] RV2013 `\.bind` of `props\.stmt` may not resume/);
    assert.match(rv[0]!, /page\.tsx:4:/);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
