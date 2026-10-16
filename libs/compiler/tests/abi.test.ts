// Compiler ↔ runtime ABI handshake: the compiler's RUNTIME_ABI matches the runtime it ships with, and
// the Vite plugin refuses to build against a runtime that implements another ABI (skewed install).
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { RUNTIME_ABI } from "../index.ts";
import { runtimeAbiProblem, runtimePackage } from "../abi.ts";
import { rivet } from "../vite.ts";

const runtimeDir = fileURLToPath(new URL("../../runtime/", import.meta.url));

test("RUNTIME_ABI equals the workspace runtime's package.json rivet.abi", async () => {
  const json = JSON.parse(await readFile(join(runtimeDir, "package.json"), "utf8")) as { rivet?: { abi?: number } };
  assert.equal(json.rivet?.abi, RUNTIME_ABI);
  const found = runtimePackage(join(runtimeDir, "server.ts"));
  assert.equal(found?.abi, RUNTIME_ABI);
  assert.equal(runtimeAbiProblem(found!), undefined);
  assert.match(runtimeAbiProblem({ dir: "/x", version: "9.9.9", abi: undefined })!, /ABI unknown \(older than the handshake\)/);
});

async function app(abi: number | null): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rivet-abi-"));
  const pkg = join(root, "node_modules/@rivetjs/runtime");
  await mkdir(pkg, { recursive: true });
  const manifest = {
    name: "@rivetjs/runtime",
    version: "9.9.9",
    type: "module",
    ...(abi === null ? {} : { rivet: { abi } }),
    exports: { "./server": "./server.js" },
  };
  await writeFile(join(pkg, "package.json"), JSON.stringify(manifest));
  await writeFile(join(pkg, "server.js"), "export {};\n");
  await writeFile(join(root, "entry.js"), "export const x = 1;\n");
  return root;
}
const bundle = (root: string) =>
  build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [rivet({ devtools: false })],
    build: { write: false, rollupOptions: { input: join(root, "entry.js") } },
  });

test("the Vite plugin fails the build on a runtime with another (or no) ABI, and builds against a matching one", async () => {
  for (const abi of [RUNTIME_ABI + 1, null]) {
    const root = await app(abi);
    try {
      await assert.rejects(bundle(root), (error: Error) => {
        assert.match(error.message, new RegExp(`emits code for runtime ABI ${RUNTIME_ABI}, but the resolved @rivetjs/runtime 9\\.9\\.9`));
        assert.match(error.message, /install @rivetjs\/compiler and @rivetjs\/runtime from the same release/);
        return true;
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
  const root = await app(RUNTIME_ABI);
  try {
    await bundle(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
