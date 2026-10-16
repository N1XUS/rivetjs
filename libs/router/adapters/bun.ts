// Bun server (`rivetRouter({ adapter: "bun" })` → `bun dist/server/bun.js`): `Bun.serve`
// (https://bun.com/docs/api/http) with the built client files first (`files.ts`, sent as `Bun.file`,
// zero-copy) and the app through the fetch adapter (web-standard Response bodies, Bun's native
// streams). The Bun `Server` reaches loaders as `event.platform.ctx`; environment: `process.env` /
// `Bun.env`. Bun.serve does not compress: precompressed `.br` / `.gz` siblings are served for files,
// pages go out uncompressed (put a compressing proxy / CDN in front for HTML).
import { fileURLToPath } from "node:url";
import type { GeneratedEntry } from "../server/app.ts";
import type { BuildManifests } from "./assemble.ts";
import { createFetch, type FetchOptions } from "./fetch.ts";
import { staticFiles } from "./files.ts";
import { immutableOf, listenOptions, type ServerTargetOptions } from "./server-target.ts";

interface BunServer {
  readonly port: number;
  readonly hostname: string;
  readonly url: URL;
  requestIP(request: Request): { address: string } | null;
  stop(force?: boolean): Promise<void> | void;
}
interface BunGlobal {
  serve(options: { port: number; hostname: string; fetch(request: Request, server: BunServer): Response | Promise<Response> }): BunServer;
  file(path: string): Blob;
}

export interface BunOptions extends Omit<FetchOptions, "serveAssets">, ServerTargetOptions {}

/** Start `Bun.serve`; stops (in-flight requests finish) on SIGTERM / SIGINT. */
export function start(entry: GeneratedEntry, build: BuildManifests, options: BunOptions = {}): BunServer {
  const Bun = (globalThis as { Bun?: BunGlobal }).Bun;
  if (!Bun) throw new Error('rivetRouter({ adapter: "bun" }): dist/server/bun.js runs under Bun (bun dist/server/bun.js)');
  const { client, port, hostname, signals, ...fetchOptions } = options;
  const base = entry.base ?? "";
  const lookup = client ? staticFiles(typeof client === "string" ? client : fileURLToPath(client), base, immutableOf(base, build)) : () => null;
  const app = createFetch(entry, build, { address: (request, _env, server) => (server as BunServer).requestIP(request)?.address, ...fetchOptions });
  const listen = listenOptions({ port, hostname });
  const server = Bun.serve({
    ...listen,
    fetch(request, server) {
      if (request.method === "GET" || request.method === "HEAD") {
        const file = lookup(request, new URL(request.url).pathname);
        if (file === 304) return new Response(null, { status: 304 });
        if (file) return new Response(request.method === "HEAD" ? null : Bun.file(file.path), { headers: file.headers });
      }
      return app.fetch(request, undefined, server);
    },
  });
  if (signals !== false) {
    const stop = async () => {
      await server.stop();
      process.exit(0);
    };
    for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, stop);
  }
  console.log(`Listening on ${server.url.href}`);
  return server;
}
