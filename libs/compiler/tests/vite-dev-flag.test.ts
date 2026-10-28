// Public `DEV` (`@rivetjs/runtime/dev`): the dev server resolves the `development` condition (true); a build through the
// plugin resolves `false` whatever its conditions, so user code behind `if (DEV)` is dropped from the bundle.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build, createServer, type Rollup } from "vite";
import { rivet } from "../vite.ts";

const SOURCE =
  'import { DEV } from "@rivetjs/runtime/dev";\nexport function f(x: number) {\n  if (DEV) console.log("DEV-ONLY-MARK", x);\n  return DEV ? x + 1 : x;\n}\nexport const dev = DEV;\n';

async function app() {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-dev-flag-"));
  await mkdir(resolve(root, "src"));
  await writeFile(resolve(root, "src/entry.ts"), SOURCE);
  return root;
}

const bundled = async (root: string, conditions?: string[]) => {
  const env = process.env.NODE_ENV;
  const out = (await build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [rivet()],
    resolve: conditions ? { conditions } : {},
    build: { write: false, minify: true, lib: { entry: resolve(root, "src/entry.ts"), formats: ["es"], fileName: "entry" } },
  }).finally(() => {
    // A build sets NODE_ENV=production for the rest of the process.
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
  })) as Rollup.RollupOutput[] | Rollup.RollupOutput;
  const output = (Array.isArray(out) ? out[0]! : out).output;
  return output.map((chunk) => (chunk.type === "chunk" ? chunk.code : "")).join("\n");
};

test("DEV: a build folds `if (DEV)` away, also when its conditions include `development`", async () => {
  const root = await app();
  try {
    for (const conditions of [undefined, ["development", "module", "browser", "default"]]) {
      const code = await bundled(root, conditions);
      assert.doesNotMatch(code, /DEV-ONLY-MARK/, String(conditions));
      assert.doesNotMatch(code, /flag-on|@rivetjs\/runtime\/dev/, String(conditions));
      const mod = (await import("data:text/javascript," + encodeURIComponent(code))) as { f(x: number): number; dev: boolean };
      assert.equal(mod.dev, false);
      assert.equal(mod.f(1), 1);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("DEV: the dev server resolves the development flag (true)", async () => {
  const root = await app();
  const env = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const server = await createServer({ root, configFile: false, logLevel: "silent", plugins: [rivet()], server: { middlewareMode: true }, appType: "custom" });
  try {
    const mod = (await server.ssrLoadModule("/src/entry.ts")) as { f(x: number): number; dev: boolean };
    assert.equal(mod.dev, true);
  } finally {
    await server.close();
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
    await rm(root, { recursive: true, force: true });
  }
});
