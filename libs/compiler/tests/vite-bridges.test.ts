// T5 `rivet({ bridges })` (framework bridges spec §4): absent / empty adds no plugin and changes no config; bridges put
// their framework plugins, then the facade host, before the Rivet compiler; dedupe / optimizeDeps per framework; the
// Rivet compiler never compiles a bridge-owned module; an explicit Rivet `include` claiming one is RV2145; a bridge-owned
// module importing the Rivet runtime is RV2148 (value imports only: `import type`, comments and strings do not count).
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build, resolveConfig, type Plugin } from "vite";
import { rivet } from "../vite.ts";
import { fixtureApp } from "../../bridge/tests/app.ts";

const names = (plugins: unknown): string[] => [plugins].flat(4).map((plugin) => (plugin as Plugin).name);

test("bridges absent or [] = HEAD: same plugins, same resolved config", async () => {
  assert.deepEqual(names(rivet({ bridges: [] })), names(rivet()));
  const pick = async (plugins: Plugin[] | Plugin) => {
    const config = await resolveConfig({ configFile: false, root: process.cwd(), logLevel: "silent", plugins: [plugins] }, "serve");
    return {
      plugins: config.plugins.map((plugin) => plugin.name),
      dedupe: config.resolve.dedupe,
      include: config.optimizeDeps.include,
      exclude: config.optimizeDeps.exclude,
      noExternal: config.ssr.noExternal,
    };
  };
  assert.deepEqual(await pick(rivet({ bridges: [] })), await pick(rivet()));
});

test("bridges: framework plugins, then the facade host, then the Rivet compiler; dedupe + optimizeDeps (dev)", async () => {
  const app = await fixtureApp("order");
  try {
    const entry = app.fake({ dedupe: ["fake-runtime"] });
    entry.optimize = ["fake-runtime/client"];
    assert.deepEqual(names(rivet({ bridges: [entry] })), ["fake-framework", "vite-plugin-rivet-bridge", "vite-plugin-rivet"]);
    const served = await resolveConfig({ configFile: false, root: app.root, logLevel: "silent", plugins: [rivet({ bridges: [entry] })] }, "serve");
    // Resolved: Vite groups by `enforce` (the host and the compiler are both "pre", in this order); the framework plugins
    // keep their own `enforce` (this one: normal).
    const order = served.plugins.map((plugin) => plugin.name);
    assert.ok(order.includes("fake-framework"));
    assert.ok(order.indexOf("vite-plugin-rivet-bridge") < order.indexOf("vite-plugin-rivet"));
    assert.ok(served.resolve.dedupe.includes("fake-runtime"));
    assert.ok(served.optimizeDeps.include?.includes("fake-runtime/client"));
    const built = await resolveConfig({ configFile: false, root: app.root, logLevel: "silent", plugins: [rivet({ bridges: [app.fake()] })] }, "build");
    assert.ok(!built.optimizeDeps.include?.includes("fake-runtime/client"));
  } finally {
    await app.remove();
  }
});

test("a bridge-owned .tsx is never Rivet-compiled; an explicit Rivet include claiming it is RV2145", async () => {
  const app = await fixtureApp("owned");
  try {
    await mkdir(resolve(app.root, "src/widgets"), { recursive: true });
    await writeFile(
      resolve(app.root, "src/widgets/Widget.tsx"),
      `export const Widget = { html: () => "<em>WIDGET</em>", attach: () => ({ update() {}, destroy() {} }) };\n`,
    );
    await writeFile(
      resolve(app.root, "src/uses.tsx"),
      `import { Widget } from "./widgets/Widget.tsx";\nexport function Uses() { return <section><Widget client="load" /></section>; }\n`,
    );
    const plugins = (include?: string[]) => [
      // A component object (no wrapper call): an island through the `islands.include` override.
      rivet({
        resume: { modules: ["src/uses.tsx"] },
        ...(include ? { include } : {}),
        bridges: [app.fake({ include: ["src/widgets/**"], islands: { include: ["Widget"] } })],
      }),
    ];
    await build({ configFile: false, root: app.root, logLevel: "silent", plugins: plugins(), build: { outDir: "dist", minify: false } });
    const manifest = JSON.parse(await readFile(resolve(app.root, "dist/.vite/rivet-resume.json"), "utf8")) as {
      symbols: Record<string, string>;
      islands: Record<string, string>;
    };
    assert.ok(!Object.keys(manifest.symbols).some((id) => id.startsWith("src/widgets/Widget.tsx#")), Object.keys(manifest.symbols).join(" "));
    assert.deepEqual(Object.keys(manifest.islands), ["src/widgets/Widget.tsx#Widget"]);
    assert.ok(
      [...app.seen].some((file) => file.endsWith("src/widgets/Widget.tsx")),
      "the framework plugin owns it",
    );
    // SSR keeps the framework's packages external (Node loads them once), bundling the island module itself.
    await writeFile(
      resolve(app.root, "src/widgets/Widget.tsx"),
      `import { version } from "react";\nexport const Widget = { html: () => "<em>" + version + "</em>", attach: () => ({ update() {}, destroy() {} }) };\n`,
    );
    await writeFile(
      resolve(app.root, "src/entry.tsx"),
      `import { renderToString } from "@rivetjs/runtime/server";\nimport { Uses } from "./uses.tsx";\nexport const html = () => renderToString(() => <Uses />);\n`,
    );
    await build({
      configFile: false,
      root: app.root,
      logLevel: "silent",
      plugins: plugins(),
      build: { outDir: "dist-server", ssr: "src/entry.tsx", minify: false },
    });
    const server = await readFile(resolve(app.root, "dist-server/entry.js"), "utf8");
    assert.match(server, /from "react"/);
    assert.match(server, /<em>/);
    await assert.rejects(
      build({ configFile: false, root: app.root, logLevel: "silent", plugins: plugins(["src/**"]), build: { outDir: "dist2", minify: false } }),
      /\[RV2145\] src\/widgets\/Widget\.tsx matches both the Rivet compiler and fake\(\{ include \}\) — pick one owner/,
    );
    // RV2148 ignores type-only imports and the runtime's name in comments / strings (T6 review L1).
    await writeFile(
      resolve(app.root, "src/widgets/Widget.tsx"),
      `import type { JSX } from "@rivetjs/runtime/jsx-runtime";\nimport { type ServerValue } from "@rivetjs/runtime/server";\n// import { Show } from "@rivetjs/runtime";\nexport type View = JSX.Element | ServerValue;\nexport const Widget = { html: () => "<em>@rivetjs/runtime</em>", attach: () => ({ update() {}, destroy() {} }) };\n`,
    );
    await build({ configFile: false, root: app.root, logLevel: "silent", plugins: plugins(), build: { outDir: "dist-types", minify: false } });
    // RV2148: the bridge-owned module uses the Rivet runtime (never compiled by Rivet: a build error, not a silent skip).
    await writeFile(
      resolve(app.root, "src/widgets/Widget.tsx"),
      `import { Show } from "@rivetjs/runtime";\nexport const Widget = { html: () => String(Show), attach: () => ({ update() {}, destroy() {} }) };\n`,
    );
    await assert.rejects(
      build({ configFile: false, root: app.root, logLevel: "silent", plugins: plugins(), build: { outDir: "dist3", minify: false } }),
      /\[RV2148\] src\/widgets\/Widget\.tsx is owned by fake but uses the Rivet runtime \(@rivetjs\/runtime\)/,
    );
  } finally {
    await app.remove();
  }
});
