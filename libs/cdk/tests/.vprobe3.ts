import { start } from "@rivetjs/router/node";
import { buildApp } from "./app/serve.ts";
const root = new URL("./app/", import.meta.url).pathname;
await buildApp();
const app = await start({ dist: root + "dist", port: 0, host: "127.0.0.1", onError: (e: unknown) => console.log("ERR", String(e), (e as any)?.cause?.message) });
const r = await fetch(app.url + "/virtualizer");
console.log(r.status);
await app.close();
