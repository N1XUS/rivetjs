// Rivet native lane build (no bridge) → dist/rivet-native.
import { buildRivetLane } from "../../rivet-build.ts";

export const build = (outDir: string) => buildRivetLane(new URL("./", import.meta.url), outDir, null);
