// Router lane entry (`dist/rivet-router.mjs`): the production node adapter serves the file-routed
// build in `dist/rivet-router/` — static lookup, Request bridge, handler (match, loaders, head),
// streamed resumable render. No bench-specific fast path.
import { fileURLToPath } from "node:url";
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({
  dist: fileURLToPath(new URL("./rivet-router/", import.meta.url)),
  port: Number(process.env.PORT ?? 8080),
  host: "0.0.0.0",
  // benchmark.py --cores N (compose SSR_BENCH_CORES): N node adapter workers; 1 (this process) by default.
  workers: Number(process.env.RIVET_WORKERS ?? 1),
});
console.log(`SSR rivet-router listening on ${serving.url}`);
closeOnSignals(serving);
