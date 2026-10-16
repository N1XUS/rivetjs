import { createBuilder } from "vite";
import { build as bundle } from "esbuild";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync, brotliCompressSync } from "node:zlib";

const root = fileURLToPath(new URL("./", import.meta.url));
const configFile = resolve(root, "vite.config.ts");

/**
 * One app build: server (app + handler; registers server-only images) first, then client (resume
 * chunks, CSS, every image variant), then the HTTP server as plain JS.
 */
export async function buildPlayground(): Promise<void> {
  await rm(resolve(root, "dist"), { recursive: true, force: true });
  const builder = await createBuilder({
    root,
    configFile,
    builder: {},
    build: { minify: true },
    // The router plugin defaults the client build; the ssr environment builds its generated server entry.
    environments: { ssr: { build: { outDir: "dist/server", manifest: false, rollupOptions: { input: resolve(root, ".rivet/entry.server.tsx") } } } },
  });
  await builder.buildApp();
  // Plain JS for production: Node's type stripping would cost ~24 MB resident memory per process.
  await bundle({
    entryPoints: [resolve(root, "server.ts")],
    outfile: resolve(root, "dist/serve.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    external: ["node:*", "vite"],
    logLevel: "warning",
  });
  const artifacts: { file: string; bytes: number; gzipBytes: number; brotliBytes: number; sha256: string }[] = [];
  async function scan(directory: string, prefix = ""): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await scan(resolve(directory, entry.name), prefix + entry.name + "/");
      else {
        const bytes = await readFile(resolve(directory, entry.name));
        artifacts.push({
          file: prefix + entry.name,
          bytes: bytes.length,
          gzipBytes: gzipSync(bytes).length,
          brotliBytes: brotliCompressSync(bytes).length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
  }
  await scan(resolve(root, "dist/client"), "client/");
  await scan(resolve(root, "dist/server"), "server/");
  await writeFile(
    resolve(root, "dist/artifact-sizes.json"),
    JSON.stringify(
      {
        artifacts,
        note: "Individual emitted files; not initial-page totals. Pages ship CSS plus an inline loader; resume runtime/symbol chunks and deferred chunks count when loaded.",
      },
      null,
      2,
    ) + "\n",
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildPlayground();
