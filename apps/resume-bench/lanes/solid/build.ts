import { writeBuildManifest } from "../../provenance.ts";
import { build as vite, type InlineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { cp, readFile, rm, writeFile } from "node:fs/promises";

const laneRoot = fileURLToPath(new URL("./", import.meta.url));
const root = process.env.RESUME_BENCH_SOURCE ?? laneRoot;
const work = resolve(laneRoot, "../../.build/solid");

/**
 * Solid 2 RC lane: classic Vite SSR (no Start mode). Client build of index.html (hydrate entry,
 * lazy Detail chunk), SSR build of src/entry-server.tsx, then prerender `/` into outDir/index.html.
 */
export async function build(outDir: string): Promise<void> {
  await rm(work, { recursive: true, force: true });
  const common: InlineConfig = { configFile: false, root, base: "/", mode: "production", logLevel: "warn", plugins: [solid({ ssr: true })] };
  await vite({
    ...common,
    build: { outDir: resolve(work, "client"), emptyOutDir: true, minify: true, sourcemap: false },
  });
  await vite({
    ...common,
    build: { ssr: resolve(root, "src/entry-server.tsx"), outDir: resolve(work, "server"), emptyOutDir: true, minify: false },
  });
  const template = await readFile(resolve(work, "client/index.html"), "utf8");
  const { render } = (await import(pathToFileURL(resolve(work, "server/entry-server.js")).href + "?" + Date.now())) as {
    render(): Promise<{ head: string; html: string }>;
  };
  const { head, html } = await render();
  await rm(outDir, { recursive: true, force: true });
  await cp(resolve(work, "client"), outDir, { recursive: true, filter: (path) => !path.includes("/.vite") });
  await writeFile(resolve(outDir, "index.html"), template.replace("<!--ssr-head-->", head).replace("<!--ssr-outlet-->", html));
  await writeBuildManifest("solid", outDir);
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) await build(resolve(work, "out"));
