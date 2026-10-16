// Static files for the Bun and Deno servers: the client directory indexed once at start (both
// runtimes implement `node:fs` / `node:path`), looked up per GET/HEAD by URL path. Same rules as the
// node adapter: below the base only, no `\0` or dot segments (except a root `.well-known/`), hashed
// `<base>/assets/` immutable, everything else `no-cache` + weak ETag (304 on `If-None-Match`),
// precompressed `.br` / `.gz` siblings when the client accepts them. Directory pages
// (`a/index.html`, `a.html`, as the static adapter writes them) answer at `/a` and `/a/`.
import { readdirSync, realpathSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

export interface StaticFile {
  /** Absolute file path to send (the precompressed sibling when `encoding` is set). */
  readonly path: string;
  readonly headers: Record<string, string>;
}
interface Indexed {
  readonly path: string;
  readonly type: string;
  readonly etag: string;
  readonly modified: string;
  readonly immutable: boolean;
  readonly br?: string;
  readonly gz?: string;
}

/** Index `client` (served under `base`); returns the per-request lookup. */
export function staticFiles(client: string, base: string, immutable: readonly string[]): (request: Request, pathname: string) => StaticFile | 304 | null {
  const files = new Map<string, Indexed>();
  let root: string;
  try {
    root = realpathSync(client);
  } catch {
    return () => null;
  }
  const entries = readdirSync(root, { recursive: true, withFileTypes: true });
  const names = new Set(entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)));
  for (const full of names) {
    const key = relative(root, full).split(sep).join("/");
    const segments = key.split("/");
    if (segments.some((segment, i) => segment.startsWith(".") && !(i === 0 && segment === ".well-known"))) continue;
    if (/\.(br|gz)$/.test(key) && names.has(full.slice(0, -3))) continue;
    const info = statSync(full);
    const url = base + "/" + key;
    const file: Indexed = {
      path: full,
      type: MIME[extname(key).toLowerCase()] ?? "application/octet-stream",
      etag: `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`,
      modified: info.mtime.toUTCString(),
      immutable: immutable.some((prefix) => url.startsWith(prefix)),
      ...(names.has(full + ".br") ? { br: full + ".br" } : {}),
      ...(names.has(full + ".gz") ? { gz: full + ".gz" } : {}),
    };
    files.set(url, file);
    const page = /^(.*?)(?:\/?index)?\.html$/.exec(key);
    if (page && key !== "404.html" && key !== "200.html") {
      const at = page[1] ? base + "/" + page[1] : base;
      for (const alias of [at || "/", at + "/"]) if (!files.has(alias)) files.set(alias, file);
    }
  }
  return (request, pathname) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    if (decoded.includes("\0")) return null;
    const file = files.get(decoded);
    if (!file) return null;
    const match = request.headers.get("if-none-match");
    if (match && match.split(",").some((tag) => tag.trim() === "*" || tag.trim().replace(/^W\//, "") === file.etag.slice(2))) return 304;
    const headers: Record<string, string> = {
      "Content-Type": file.type,
      "Cache-Control": file.immutable ? "public, max-age=31536000, immutable" : "no-cache",
      ETag: file.etag,
      "Last-Modified": file.modified,
    };
    if (file.br || file.gz) {
      headers.Vary = "Accept-Encoding";
      const accept = request.headers.get("accept-encoding") ?? "";
      const encoding = file.br && /\bbr\b/.test(accept) ? "br" : file.gz && /\bgzip\b/.test(accept) ? "gzip" : null;
      if (encoding) {
        headers["Content-Encoding"] = encoding;
        return { path: encoding === "br" ? file.br! : file.gz!, headers };
      }
    }
    return { path: file.path, headers };
  };
}
