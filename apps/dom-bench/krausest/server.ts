// Static server for built krausest lanes: /<lane>/index.html, /<lane>/main.js, /css/currentStyle.css.
// Cross-origin isolated (COOP/COEP) so performance.measureUserAgentSpecificMemory() works, as in krausest.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";

const here = dirname(fileURLToPath(import.meta.url));
const types: Record<string, string> = { html: "text/html; charset=utf-8", js: "text/javascript", css: "text/css" };

export async function startKrausestServer(dist: string): Promise<{ url: string; close: () => Promise<void> }> {
  const root = resolve(dist);
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url!, "http://localhost").pathname);
      const file = path === "/css/currentStyle.css" ? resolve(here, "style.css") : resolve(root, "." + (path.endsWith("/") ? path + "index.html" : path));
      if (file !== resolve(here, "style.css") && !file.startsWith(root + sep)) return void response.writeHead(403).end();
      const body = await readFile(file);
      response.writeHead(200, {
        "Content-Type": types[file.split(".").pop()!] ?? "application/octet-stream",
        "Cache-Control": "no-store",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Resource-Policy": "same-origin",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise<void>((yes, no) => {
    server.once("error", no);
    server.listen(0, "127.0.0.1", yes);
  });
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((yes) => server.close(() => yes())),
  };
}
