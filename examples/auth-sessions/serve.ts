// Production server: serves dist/client files and renders pages with the server build. `/healthz` is built in.
import { closeOnSignals, start } from "@rivetjs/router/node";

process.env.NODE_ENV ??= "production";
// A fixed public origin (APP_ORIGIN): CSRF checks and request URLs never trust the client's Host header.
const serving = await start({
  dist: "dist",
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "127.0.0.1",
  origin: process.env.APP_ORIGIN,
});
closeOnSignals(serving);
console.log(`Listening on ${serving.url}`);
