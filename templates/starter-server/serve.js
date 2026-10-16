// Production server: serves dist/client files and renders pages with the server build.
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({ dist: "dist", port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? "127.0.0.1" });
closeOnSignals(serving);
console.log(`Listening on ${serving.url}`);
