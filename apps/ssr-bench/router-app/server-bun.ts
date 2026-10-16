// UWS-SPIKE comparison lane entry (`dist/rivet-router-bunserve.mjs`, compose `rivet-router-bunserve` /
// `rivet-resume-bunserve`): the same file-routed build and app handler, served by Bun's native HTTP server
// (`Bun.serve`, web-standard Request / Response, Bun reads the page's ReadableStream). Unlike `rivet-router-bun`
// (Bun running the node adapter over its `node:http` layer), no Node HTTP compatibility layer. Runs under Bun only.
import { fileURLToPath } from "node:url";
import { loadBuild } from "../../../libs/router/adapters/build.ts";
import { nonce } from "../../../libs/router/shared/nonce.ts";

interface BunServer {
  readonly url: URL;
  requestIP(request: Request): { address: string } | null;
  stop(): Promise<void> | void;
}
interface BunGlobal {
  serve(options: { port: number; hostname: string; fetch(request: Request, server: BunServer): Response | Promise<Response> }): BunServer;
}
const Bun = (globalThis as { Bun?: BunGlobal }).Bun;
if (!Bun) throw new Error("rivet-router-bunserve runs under Bun");
const { handler } = await loadBuild(fileURLToPath(new URL("./rivet-router/", import.meta.url)));
const server = Bun.serve({
  port: Number(process.env.PORT ?? 8080),
  hostname: "0.0.0.0",
  fetch(request, server) {
    const address = server.requestIP(request)?.address;
    return handler(request, { nonce: nonce(), ...(address ? { address } : {}) });
  },
});
console.log(`SSR rivet-router-bunserve listening on ${server.url.href}`);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, async () => {
    await server.stop();
    process.exit(0);
  });
