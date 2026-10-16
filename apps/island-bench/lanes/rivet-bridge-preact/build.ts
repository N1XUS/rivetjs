// Rivet + Preact islands lane build: client (resume chunks + island chunks) and SSR bundles → dist/rivet-bridge-preact.
import { buildRivetLane } from "../../rivet-build.ts";

export const build = (outDir: string) => buildRivetLane(new URL("./", import.meta.url), outDir, "preact");
