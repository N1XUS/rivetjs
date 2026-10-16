import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";

const root = dirname(fileURLToPath(import.meta.url));
const css =
  "body{margin:0;font:14px system-ui;color:#222}main{padding:16px}section{border-bottom:1px solid #ccc;padding:8px}h2,p{margin:4px}.fields{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.field{display:flex;gap:4px;padding:4px}button{font:inherit}footer{padding:4px}";

/** Serve isolated production fixtures on a loopback port; callers own shutdown. `dist` defaults to this app's dist. */
export async function startServer(port = 0, dist = resolve(root, "dist")): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url!, "http://localhost").pathname;
      const match = /^\/([a-z][a-z0-9-]*)(\.js)?$/.exec(path);
      if (!match) {
        response.writeHead(404, { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" }).end("Not found");
        return;
      }
      response.setHeader("Cache-Control", "no-store");
      // Cross-origin isolation (B4): without it Chromium coarsens performance.now() to 100 µs (a 0.3 ms update
      // = 3 ticks). Every resource is same-origin, so require-corp blocks nothing.
      response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      if (match[2]) {
        response.setHeader("Content-Type", "text/javascript");
        response.end(await readFile(resolve(dist, `${match[1]}.js`)));
      } else {
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(
          `<!doctype html><html><head><meta charset="utf-8"><title>DOM benchmark</title><style>${css}</style></head><body><div id="host"></div><script type="module" src="/${match[1]}.js"></script></body></html>`,
        );
      }
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  await new Promise<void>((yes, no) => {
    server.once("error", no);
    server.listen(port, "127.0.0.1", yes);
  });
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((yes, no) => server.close((error) => (error ? no(error) : yes()))),
  };
}
