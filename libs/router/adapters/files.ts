// Static files for the Bun and Deno servers: the client directory indexed once at start (both
// runtimes implement `node:fs` / `node:path`), looked up per GET/HEAD by URL path. Same rules as the
// node adapter: below the base only, no `\0` or dot segments (except a root `.well-known/`), hashed
// `<base>/assets/` immutable, everything else `no-cache` + weak ETag (304 on `If-None-Match`),
// precompressed `.zst` / `.br` / `.gz` siblings when the client accepts them (zstd first). Directory pages
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
  readonly zst?: string;
  readonly br?: string;
  readonly gz?: string;
}

/** A response encoding the adapters produce. */
export type Encoding = "zstd" | "br" | "gzip" | null;

/**
 * `q` per content coding of an `Accept-Encoding` header, parsed once per distinct string (browsers send a handful;
 * bounded: client-controlled text). `weightOf` applies `*` to codings the header does not name.
 */
export function acceptWeights(header: string): Map<string, number> {
  let accepted = weights.get(header);
  if (accepted === undefined) {
    accepted = new Map();
    for (const part of header.toLowerCase().split(",")) {
      const [name, ...params] = part.trim().split(";");
      const q = params.map((p) => /^\s*q=([\d.]+)\s*$/.exec(p)).find(Boolean);
      accepted.set(name!.trim(), q ? Number(q[1]) : 1);
    }
    if (weights.size < 64) weights.set(header, accepted);
  }
  return accepted;
}
const weights = new Map<string, Map<string, number>>();
export const weightOf = (accepted: Map<string, number>, name: string): number => accepted.get(name) ?? accepted.get("*") ?? 0;

/**
 * Pick `zstd`, `br` or `gzip` from an Accept-Encoding header: the highest `q` (a tie: `zstd`, then `br`); q=0 excludes.
 * `zstd: false` never picks zstd (`serve({ compress: { zstd: false } })`).
 */
export function negotiate(header: string | null | undefined, zstd = true): Encoding {
  if (!header) return null;
  const memo = zstd ? negotiated : negotiatedNoZstd;
  let hit = memo.get(header);
  if (hit === undefined) {
    const accepted = acceptWeights(header);
    const zs = zstd ? weightOf(accepted, "zstd") : 0,
      br = weightOf(accepted, "br"),
      gzip = weightOf(accepted, "gzip");
    hit = zs > 0 && zs >= br && zs >= gzip ? "zstd" : br > 0 && br >= gzip ? "br" : gzip > 0 ? "gzip" : null;
    if (memo.size < 64) memo.set(header, hit);
  }
  return hit;
}
const negotiated = new Map<string, Encoding>(),
  negotiatedNoZstd = new Map<string, Encoding>();

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
    if (key.endsWith(".zst") && names.has(full.slice(0, -4))) continue;
    const info = statSync(full);
    const url = base + "/" + key;
    const file: Indexed = {
      path: full,
      type: MIME[extname(key).toLowerCase()] ?? "application/octet-stream",
      etag: `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`,
      modified: info.mtime.toUTCString(),
      immutable: immutable.some((prefix) => url.startsWith(prefix)),
      ...(names.has(full + ".zst") ? { zst: full + ".zst" } : {}),
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
    if (file.zst || file.br || file.gz) {
      headers.Vary = "Accept-Encoding";
      // The best-weighted coding among the siblings that exist (`q=0` excludes; a tie: zstd, then br).
      const accepted = acceptWeights(request.headers.get("accept-encoding") ?? "");
      let path: string | undefined,
        encoding = "",
        best = 0;
      for (const [name, sibling] of [
        ["zstd", file.zst],
        ["br", file.br],
        ["gzip", file.gz],
      ] as const) {
        const q = sibling ? weightOf(accepted, name) : 0;
        if (q > best) ((best = q), (path = sibling), (encoding = name));
      }
      if (path) {
        headers["Content-Encoding"] = encoding;
        return { path, headers };
      }
    }
    return { path: file.path, headers };
  };
}
