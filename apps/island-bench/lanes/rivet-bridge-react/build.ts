// Rivet + React islands lane build: client (resume chunks + island chunks) and SSR bundles → dist/rivet-bridge-react.
import { buildRivetLane } from "../../rivet-build.ts";

export const build = (outDir: string) => buildRivetLane(new URL("./", import.meta.url), outDir, "react");
