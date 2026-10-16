import { writeBuildManifest } from "../../provenance.ts";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { stableModule, stableRequire, stableSolidAliases, stableSolidIsolation } from "../../stable-dependencies.ts";

const root = fileURLToPath(new URL("./", import.meta.url));
const work = resolve(root, "../../.build/solid-stable");

/** Solid 1 stable: production SSR + hydration with native resource state serialization. */
export async function build(outDir: string): Promise<void> {
  const { build: vite } = await import(stableModule("vite"));
  const solid = stableRequire("vite-plugin-solid");
  await rm(work, { recursive: true, force: true });
  const common = { configFile: false as const, root, base: "/", mode: "production", logLevel: "warn" as const };
  await vite({
    ...common,
    plugins: [solid({ ssr: true, dev: false, hot: false }), stableSolidIsolation()],
    resolve: { alias: stableSolidAliases() },
    build: { outDir: resolve(work, "client"), emptyOutDir: true, minify: true, sourcemap: false },
  });
  await vite({
    ...common,
    plugins: [solid({ ssr: true, dev: false, hot: false }), stableSolidIsolation()],
    resolve: { alias: stableSolidAliases(true) },
    ssr: { noExternal: true },
    build: { ssr: resolve(root, "src/entry-server.tsx"), outDir: resolve(work, "server"), emptyOutDir: true, minify: false, sourcemap: false },
  });
  const template = await readFile(resolve(work, "client/index.html"), "utf8");
  const { render } = (await import(pathToFileURL(resolve(work, "server/entry-server.js")).href + "?" + Date.now())) as {
    render(): Promise<{ head: string; html: string }>;
  };
  const { head, html } = await render();
  await rm(outDir, { recursive: true, force: true });
  await cp(resolve(work, "client"), outDir, { recursive: true, filter: (path) => !path.includes("/.vite") });
  await writeFile(resolve(outDir, "index.html"), template.replace("<!--ssr-head-->", head).replace("<!--ssr-outlet-->", html));
  await writeBuildManifest("solid-stable", outDir);
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) await build(resolve(work, "out"));
