// Dev server side of DevTools: the prebuilt panel UI as static files, and the agent's script URL.
// Used by `rivet()` on `vite serve` only; nothing here reaches a build.
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { BUILD_PATH, UI_PATH, VERSION } from "./protocol.ts";

export { UI_PATH };
export { nameSignals } from "./names.ts";
/** Built panel files (`nx run devtools:build` / `node libs/devtools/build.ts`). */
export const _uiDir = fileURLToPath(new URL("./dist/ui/", import.meta.url));

const here = fileURLToPath(new URL("./", import.meta.url));
/**
 * Hash of the panel's sources (`protocol.ts` + `ui/` code and styles): baked into `dist/ui` by `build.ts`
 * and served live at `<base>__rivet/devtools/__build`; the panel compares the two and shows a "rebuild
 * the panel" banner when its build is older than the sources (a stale panel otherwise fails silently).
 * Null for an installed package (it ships `dist/ui` only, no `ui/` sources): nothing to be stale against.
 */
export async function sourceHash(dir = here): Promise<string | null> {
  if (!existsSync(join(dir, "ui"))) return null;
  const files = (await readdir(join(dir, "ui"), { recursive: true }))
    .filter((file) => /\.(?:tsx?|css|html)$/.test(file))
    .map((file) => join("ui", file))
    .sort();
  const hash = createHash("sha256");
  for (const file of ["protocol.ts", ...files]) hash.update(file.split(sep).join("/") + "\0").update(await readFile(join(dir, file)));
  return hash.digest("hex").slice(0, 16);
}

/** The agent module through Vite's bare-id route: the first script of every dev page. */
export const agentScript = (base: string): string => base + "@id/@rivetjs/devtools/agent";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

/**
 * Connect-style middleware serving the panel under `<base>__rivet/devtools/`. Never rejects: connect
 * does not await middlewares, and an unhandled rejection would end the dev server (any page can
 * request `/__rivet/devtools/%E0`). Malformed paths answer 400, other failures go to `next(error)`.
 */
export function uiMiddleware(base: string) {
  const serve = panel(base);
  return (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): Promise<void> =>
    serve(req, res, next).catch((error: unknown) => {
      if (res.headersSent) res.destroy();
      else next(error);
    });
}

function panel(base: string) {
  const prefix = base + UI_PATH;
  return async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): Promise<void> => {
    const path = (req.url ?? "").split(/[?#]/, 1)[0]!;
    if (path === base + UI_PATH.slice(0, -1)) {
      res.writeHead(301, { location: prefix });
      res.end();
      return;
    }
    if (!path.startsWith(prefix) || (req.method !== "GET" && req.method !== "HEAD")) return next();
    if (path === prefix + BUILD_PATH) {
      // The panel's staleness check (see `sourceHash`); never cached.
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : JSON.stringify({ v: VERSION, hash: await sourceHash() }));
      return;
    }
    let relative: string;
    try {
      relative = decodeURIComponent(path.slice(prefix.length)) || "index.html";
    } catch {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("Bad Request: malformed URL\n");
      return;
    }
    const file = normalize(join(_uiDir, relative));
    if (!file.startsWith(_uiDir) || file.includes(sep + ".." + sep)) return next();
    if (!existsSync(join(_uiDir, "index.html"))) {
      res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
      res.end("Rivet DevTools UI is not built: run `npx nx run devtools:build` (or `node libs/devtools/build.ts`).\n");
      return;
    }
    const body = await readFile(file).catch(() => null);
    if (!body) return next();
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : body);
  };
}
