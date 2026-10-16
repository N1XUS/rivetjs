// rivet-dynamic lane: the same app built in server mode, rendered per request by the node adapter.
// EDITORIAL_ROUTE_CACHE=1 (rivet-dynamic-cached): route rules store rendered pages (`swr: 60`), hits skip the render.
import { fileURLToPath } from "node:url";
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({
  dist: fileURLToPath(new URL("./dist-dynamic/", import.meta.url)),
  port: Number(process.env.PORT ?? 4400),
  host: "127.0.0.1",
  ...(process.env.EDITORIAL_ROUTE_CACHE === "1" ? { routeRules: { "/**": { swr: 60 } } } : {}),
});
console.log(`rivet-dynamic listening on ${serving.url}`);
closeOnSignals(serving);
