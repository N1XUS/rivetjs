// Production server of the Rivet lane: the router's node adapter over dist/ (no compression, like the Next lane).
// Usage: node serve.ts [port]
import { fileURLToPath } from "node:url";
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({
  dist: fileURLToPath(new URL(process.env.BD_DIST ?? "./dist", import.meta.url)),
  port: Number(process.argv[2] ?? process.env.PORT ?? 4441),
  host: "127.0.0.1",
  compress: false,
});
closeOnSignals(serving);
console.log(`ready ${serving.url}`);
