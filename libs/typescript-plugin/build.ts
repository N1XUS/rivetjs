// Bundle the plugin for tsserver: one CommonJS file (`dist/index.cjs`; tsserver `require`s plugins and
// cannot run this repo's TypeScript sources) plus the compiler WASM it falls back to.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

export const distDir = fileURLToPath(new URL("./dist/", import.meta.url));

export async function buildPlugin(): Promise<void> {
  mkdirSync(distDir, { recursive: true });
  await build({
    entryPoints: [fileURLToPath(new URL("./index.ts", import.meta.url))],
    outfile: distDir + "index.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    // VS Code's and WebStorm's bundled Node runtimes.
    target: "node18",
    external: ["typescript"],
    // tsserver calls the module itself: `module.exports = init`.
    footer: { js: "module.exports = module.exports.default;" },
    logLevel: "warning",
  });
  copyFileSync(fileURLToPath(new URL("../compiler/rivet_compiler.wasm", import.meta.url)), distDir + "rivet_compiler.wasm");
}

if (import.meta.main) await buildPlugin();
