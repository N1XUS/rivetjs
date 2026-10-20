// rivet-derived lane entry (`dist/rivet-derived.mjs`): `server.ts` over the derived-model build in
// `dist/rivet-derived/` (`vite.derived.config.ts`). Same production node adapter, no bench fast path.
import { fileURLToPath } from "node:url";
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({
  dist: fileURLToPath(new URL("./rivet-derived/", import.meta.url)),
  port: Number(process.env.PORT ?? 8080),
  host: "0.0.0.0",
  workers: Number(process.env.RIVET_WORKERS ?? 1),
});
console.log(`SSR rivet-derived listening on ${serving.url}`);
closeOnSignals(serving);
