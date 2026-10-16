// Deno server (`rivetRouter({ adapter: "deno" })` → `deno run --allow-net --allow-read --allow-env dist/server/deno.js`):
// `Deno.serve` (https://docs.deno.com/runtime/fundamentals/http_server/) with the built client files
// first (`files.ts`, streamed from `Deno.open`) and the app through the fetch adapter (Uint8Array
// web streams). Deno compresses compressible responses itself (gzip / brotli by `Accept-Encoding`).
// The handler's `info` (`remoteAddr`) reaches loaders as `event.platform.ctx`; environment: `Deno.env.get()`.
import { fileURLToPath } from "node:url";
import type { GeneratedEntry } from "../server/app.ts";
import type { BuildManifests } from "./assemble.ts";
import { createFetch, type FetchOptions } from "./fetch.ts";
import { staticFiles } from "./files.ts";
import { immutableOf, listenOptions, type ServerTargetOptions } from "./server-target.ts";

interface DenoServeInfo {
  readonly remoteAddr: { readonly hostname?: string };
}
interface DenoServer {
  readonly finished: Promise<void>;
  shutdown(): Promise<void>;
}
interface DenoGlobal {
  serve(
    options: { port: number; hostname: string; onListen?: (address: { hostname: string; port: number }) => void },
    handler: (request: Request, info: DenoServeInfo) => Response | Promise<Response>,
  ): DenoServer;
  open(path: string): Promise<{ readable: ReadableStream<Uint8Array> }>;
  addSignalListener(signal: string, handler: () => void): void;
  exit(code: number): never;
}

export interface DenoOptions extends Omit<FetchOptions, "serveAssets">, ServerTargetOptions {}

/** Start `Deno.serve`; shuts down (in-flight requests finish) on SIGTERM / SIGINT. */
export function start(entry: GeneratedEntry, build: BuildManifests, options: DenoOptions = {}): DenoServer {
  const Deno = (globalThis as { Deno?: DenoGlobal }).Deno;
  if (!Deno) throw new Error('rivetRouter({ adapter: "deno" }): dist/server/deno.js runs under Deno (deno run -A dist/server/deno.js)');
  const { client, port, hostname, signals, ...fetchOptions } = options;
  const base = entry.base ?? "";
  const lookup = client ? staticFiles(typeof client === "string" ? client : fileURLToPath(client), base, immutableOf(base, build)) : () => null;
  const app = createFetch(entry, build, { address: (_request, _env, info) => (info as DenoServeInfo).remoteAddr.hostname, ...fetchOptions });
  const server = Deno.serve(
    { ...listenOptions({ port, hostname }), onListen: ({ hostname, port }) => console.log(`Listening on http://${hostname}:${port}/`) },
    async (request, info) => {
      if (request.method === "GET" || request.method === "HEAD") {
        const file = lookup(request, new URL(request.url).pathname);
        if (file === 304) return new Response(null, { status: 304 });
        if (file) return new Response(request.method === "HEAD" ? null : (await Deno.open(file.path)).readable, { headers: file.headers });
      }
      return app.fetch(request, undefined, info);
    },
  );
  if (signals !== false) {
    const stop = () => void server.shutdown().then(() => Deno.exit(0));
    for (const signal of ["SIGTERM", "SIGINT"]) Deno.addSignalListener(signal, stop);
  }
  return server;
}
