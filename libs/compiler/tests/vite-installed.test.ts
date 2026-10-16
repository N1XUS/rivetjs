// Installed (tarball) framework packages: their components ship as preserved-JSX `.jsx` under node_modules
// (scripts/package/build.ts). The plugin compiles them, bundles `@rivetjs/*` into the server build (Node
// cannot load an externalized `.jsx`) and keeps them out of dev pre-bundling.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build, type Plugin, type UserConfig } from "vite";
import { rivet } from "../vite.ts";

test("framework .jsx under node_modules compiles (client + server) and the server build bundles it", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-installed-"));
  try {
    // Stand-in for an installed `@rivetjs/forms` (framework package, no `rivet.source`).
    const pkg = resolve(root, "node_modules/@rivetjs/forms");
    await mkdir(pkg, { recursive: true });
    await writeFile(resolve(pkg, "package.json"), JSON.stringify({ name: "@rivetjs/forms", type: "module", exports: { "./components": "./components.jsx" } }));
    await writeFile(resolve(pkg, "components.jsx"), `export function Field(props) {\n    return (<label class="installed-field">{props.label}</label>);\n}\n`);
    await mkdir(resolve(root, "src"));
    await writeFile(resolve(root, "src/page.tsx"), `import { Field } from "@rivetjs/forms/components";\nexport function Page() { return <main><Field label="x" /></main>; }\n`);
    await writeFile(resolve(root, "src/main.tsx"), `import { mount } from "@rivetjs/runtime/dom";\nimport { Page } from "./page.tsx";\nmount(() => <Page />, document.body);\n`);
    await writeFile(resolve(root, "index.html"), `<!doctype html><script type="module" src="/src/main.tsx"></script>`);
    await build({ configFile: false, root, logLevel: "silent", plugins: [rivet()], build: { outDir: "dist", minify: false } });
    await build({ configFile: false, root, logLevel: "silent", plugins: [rivet()], build: { outDir: "dist-server", ssr: "src/page.tsx", minify: false } });
    const server = await readFile(resolve(root, "dist-server/page.js"), "utf8");
    assert.doesNotMatch(server, /from ["']@rivetjs\/forms/, "the installed package is bundled, not left for Node to import");
    assert.match(server, /installed-field/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("config: @rivetjs/* noExternal for SSR and excluded from dev pre-bundling", () => {
  const plugin = (rivet() as Plugin[] | Plugin) as Plugin | Plugin[];
  const main = (Array.isArray(plugin) ? plugin : [plugin]).find((p) => p.name === "rivet" || typeof p.config === "function")!;
  const hook = main.config as (config: UserConfig, env: { command: "build" | "serve"; mode: string }) => UserConfig | undefined;
  const config = hook.call({} as never, {}, { command: "serve", mode: "development" })!;
  const noExternal = config.ssr?.noExternal as RegExp[];
  assert.ok(noExternal.some((pattern) => pattern.test("@rivetjs/router") && pattern.test("@rivetjs/cdk")));
  assert.ok(!noExternal.some((pattern) => pattern.test("vite")));
  for (const name of ["@rivetjs/runtime", "@rivetjs/router", "@rivetjs/forms", "@rivetjs/kit", "@rivetjs/cdk"]) assert.ok(config.optimizeDeps?.exclude?.includes(name), name);
});
