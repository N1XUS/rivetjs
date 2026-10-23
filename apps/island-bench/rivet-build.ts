// Shared build of the Rivet lanes: Vite client build (resume mode; `react()` / `preact()` bridge for the islands lanes) + SSR
// build of `server.tsx`. Output: <outDir>/client (static assets + .vite manifests), <outDir>/server/server.js.
// `preactFrom` (the same-version Preact lane): `preact` / `preact-render-to-string` resolve from that node_modules
// folder in both builds (aliased, and bundled into the SSR output so Node never resolves the workspace's Preact).
import { build as vite, type InlineConfig, type PluginOption } from "vite";
import { rivet } from "@rivetjs/compiler/vite";
import { react } from "@rivetjs/bridge-react/vite";
import { preact } from "@rivetjs/bridge-preact/vite";
import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function buildRivetLane(dir: URL, outDir: string, bridge: "react" | "preact" | null, preactFrom?: string): Promise<void> {
  const root = fileURLToPath(dir);
  await rm(outDir, { recursive: true, force: true });
  const plugins = (): PluginOption[] => [
    rivet({ resume: { modules: ["page.tsx"] }, ...(bridge ? { bridges: [bridge === "react" ? react() : preact()] } : {}) }),
  ];
  const pinned = preactFrom
    ? {
        resolve: {
          alias: [
            { find: /^preact-render-to-string$/, replacement: resolve(preactFrom, "preact-render-to-string") },
            { find: /^preact(\/.*)?$/, replacement: resolve(preactFrom, "preact") + "$1" },
          ],
        },
        ssr: { noExternal: ["preact", "preact-render-to-string", "@rivetjs/bridge-preact"] },
      }
    : {};
  const common = (): InlineConfig => ({ configFile: false, root, logLevel: "warn", plugins: plugins(), ...pinned });
  await vite({
    ...common(),
    build: { outDir: resolve(outDir, "client"), minify: true, sourcemap: false, emptyOutDir: true, rollupOptions: { input: resolve(root, "page.tsx") } },
  });
  await vite({ ...common(), build: { ssr: resolve(root, "server.tsx"), outDir: resolve(outDir, "server"), minify: false, emptyOutDir: true } });
  await cp(fileURLToPath(new URL("./site.css", import.meta.url)), resolve(outDir, "client/site.css"));
}
