import { writeBuildManifest } from "../../provenance.ts";
import { build as vite, type InlineConfig } from "vite";
import { rivet, type RivetResumeOptions } from "@rivetjs/compiler/vite";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { cp, readFile, rm, writeFile } from "node:fs/promises";

const laneRoot = fileURLToPath(new URL("./", import.meta.url));
const root = process.env.RESUME_BENCH_SOURCE ?? laneRoot;
const work = resolve(laneRoot, "../../.build/rivet");
const resume: RivetResumeOptions = {
  modules: process.env.RESUME_BENCH_SOURCE ? ["root.tsx", "page.tsx"] : ["root.tsx", "page.tsx", "detail.tsx"],
  roots: ["root.tsx"],
};

/** Client (resume chunks) + SSR builds, then prerender `/` into outDir/index.html. */
export async function build(outDir: string): Promise<void> {
  await rm(work, { recursive: true, force: true });
  const client: InlineConfig = { configFile: false, root, logLevel: "warn", plugins: [rivet({ resume })] };
  const server: InlineConfig = {
    configFile: false,
    root,
    logLevel: "warn",
    plugins: [rivet({ resume })],
    resolve: {
      alias: [
        { find: resolve(root, "router.browser.ts"), replacement: resolve(root, "router.server.ts") },
        // Vite also resolves aliases before normalizing Root's relative import.
        { find: /^\.\/router\.browser\.ts$/, replacement: resolve(root, "router.server.ts") },
      ],
    },
  };
  await vite({
    ...client,
    build: { outDir: resolve(work, "client"), minify: true, sourcemap: false, emptyOutDir: true, rollupOptions: { input: resolve(root, "root.tsx") } },
  });
  await vite({ ...server, build: { ssr: resolve(root, "server.tsx"), outDir: resolve(work, "server"), minify: false, emptyOutDir: true } });
  const manifest = JSON.parse(await readFile(resolve(work, "client/.vite/rivet-resume.json"), "utf8")) as ResumeManifest;
  const { render } = (await import(pathToFileURL(resolve(work, "server/server.js")).href + "?" + Date.now())) as {
    render(manifest: ResumeManifest): Promise<string>;
  };
  await rm(outDir, { recursive: true, force: true });
  await cp(resolve(work, "client"), outDir, { recursive: true, filter: (path) => !path.includes("/.vite") });
  await writeFile(resolve(outDir, "index.html"), await render(manifest));
  await writeBuildManifest("rivet", outDir);
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) await build(resolve(work, "out"));
