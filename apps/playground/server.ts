// Playground HTTP server. Production serves the build (`node build.ts`) through the router's node
// adapter; `--dev` runs Vite with the router's dev middleware. The container runs the bundled
// `dist/serve.mjs` (this file as plain JS).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import { closeOnSignals, start } from "@rivetjs/router/node";

export interface PlaygroundServer {
  server: Server;
  url: string;
  close(): Promise<void>;
}

const here = fileURLToPath(new URL(".", import.meta.url));
const root = here.endsWith("/dist/") ? resolve(here, "..") : here;

/** Start the playground. Production requires the client and server builds in `dist/`. */
export async function createPlaygroundServer({ port = 4173, host = "127.0.0.1", dev = false } = {}): Promise<PlaygroundServer> {
  if (!dev) return start({ dist: resolve(root, "dist"), port, host });
  const { createServer } = await import("vite");
  const vite = await createServer({ root, configFile: resolve(root, "vite.config.ts"), server: { port, host, strictPort: port !== 0 } });
  await vite.listen();
  const url = vite.resolvedUrls!.local[0]!.replace(/\/$/, "");
  return { server: vite.httpServer as Server, url, close: () => vite.close() };
}

const entry = process.argv[1] && resolve(process.argv[1]);
if (entry === fileURLToPath(import.meta.url)) {
  const dev = process.argv.includes("--dev");
  const serving = await createPlaygroundServer({ port: Number(process.env.PORT ?? 4173), host: process.env.HOST ?? "127.0.0.1", dev });
  if (!dev) closeOnSignals(serving);
  console.log(`Playground ${dev ? "dev" : "production"} server: ${serving.url}`);
}
