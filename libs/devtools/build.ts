// Build the panel UI (a Rivet app) into `dist/ui`: static files with relative URLs, served by the
// dev server under `<base>__rivet/devtools/` and opened in the docked iframe or a pop-out window.
import { build } from "vite";
import { fileURLToPath } from "node:url";
import { rivet } from "@rivetjs/compiler/vite";
import { sourceHash, _uiDir } from "./server.ts";

export { _uiDir };

export async function buildUI(): Promise<void> {
  await build({
    root: fileURLToPath(new URL("./ui/", import.meta.url)),
    configFile: false,
    base: "./",
    mode: "production",
    logLevel: "warn",
    plugins: [rivet()],
    // The sources this build is made from: the panel compares it with the live hash (stale-build banner).
    define: { __RIVET_DEVTOOLS_BUILD__: JSON.stringify(await sourceHash()) },
    build: { outDir: _uiDir, emptyOutDir: true, minify: true, sourcemap: false },
  });
}

if (import.meta.main) await buildUI();
