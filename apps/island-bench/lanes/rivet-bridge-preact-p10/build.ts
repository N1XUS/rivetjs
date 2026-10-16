// Same-version control of the Preact pair (T8 review F3): the rivet-bridge-preact page, built against the astro-preact
// lane's Preact 10.29.8 + preact-render-to-string 6.8.0 (that lane's own install) → dist/rivet-bridge-preact-p10.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRivetLane } from "../../rivet-build.ts";

const modules = fileURLToPath(new URL("../astro-preact/node_modules/", import.meta.url));

/**
 * Guard (T8 re-review N4): the output must hold Preact 10 only. Preact 11's renderer calls `moveBefore`, Preact 10's
 * core still reads `defaultProps`; a build that picked up the workspace's Preact 11 fails here instead of benchmarking
 * the cross-version lane twice.
 */
function assertPreact10(outDir: string) {
  const files = [
    join(outDir, "server/server.js"),
    ...readdirSync(join(outDir, "client/assets"))
      .filter((f) => f.endsWith(".js"))
      .map((f) => join(outDir, "client/assets", f)),
  ];
  const code = files.map((file) => readFileSync(file, "utf8"));
  if (code.some((text) => text.includes("moveBefore")))
    throw new Error("rivet-bridge-preact-p10: output contains Preact 11 (moveBefore) — the workspace Preact leaked in");
  if (!code.some((text) => text.includes("defaultProps"))) throw new Error("rivet-bridge-preact-p10: no Preact 10 core found in the output");
}

export const build = async (outDir: string) => {
  if (!existsSync(modules + "preact/package.json")) throw new Error("rivet-bridge-preact-p10: install the astro-preact lane first (its Preact 10 is used)");
  const version = JSON.parse(readFileSync(modules + "preact/package.json", "utf8")).version;
  if (version !== "10.29.8") throw new Error(`rivet-bridge-preact-p10: astro-preact lane has preact ${version}, expected 10.29.8`);
  await buildRivetLane(new URL("../rivet-bridge-preact/", import.meta.url), outDir, "preact", modules);
  assertPreact10(outDir);
};
