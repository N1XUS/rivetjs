// PPR-T57 (spec T5): the PPR spike app (`app/`, built by `bench.ts --build` / `loadgen.ts --build`) on the node adapter, one
// process per loadgen target. `RIVET_SHELL_HOLES=0` in the environment keeps every shell entry on H-replay (target `shell-h`).
import { resolve } from "node:path";
import { closeOnSignals, start } from "../../../../libs/router/adapters/node.ts";

process.env.EDITORIAL_CONTENT ??= resolve(import.meta.dirname, "../../fixture/content/n1000");
const serving = await start({
  // `RIVET_RESUME_MODEL=derived` (DERIVED-C3): the derived build.
  dist: resolve(import.meta.dirname, process.env.RIVET_RESUME_MODEL === "derived" ? "app/.artifacts/dist-derived" : "app/.artifacts/dist"),
  port: Number(process.env.PORT ?? 4413),
  host: "127.0.0.1",
  onError: (error) => console.error(error),
});
console.log(`ppr-shell listening on ${serving.url}`);
closeOnSignals(serving);
