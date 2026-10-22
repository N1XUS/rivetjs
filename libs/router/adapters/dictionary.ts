// Compression Dictionary Transport (RFC 9842; M5 E3, `docs/benchmarks/2026-10-22-dictionary-transport.md`): raw
// dictionaries built from sample responses of a route group, served with `Use-As-Dictionary`, and `dcz` (zstd with the
// dictionary) answers for requests whose `Available-Dictionary` names one. Node only (`node:zlib` zstd `dictionary`).
// - Build: `writeDictionaries(outDir)` (the static adapter's `prerender`, docs-kit) → the site's dictionary `<outDir>/_rivet/dict/<id>.dict`
//   + `<outDir>/.vite/rivet-dictionaries.json`; server mode: `serve({ dictionary: { samples } })` renders the sample
//   paths once at start and builds the site dictionary in memory.
// - Serve: the node adapter loads the registry (`readDictionaries`, sync, at `createListener`) and asks it per request.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { constants as zlib, createZstdCompress, zstdCompress, zstdCompressSync } from "node:zlib";
import type { Transform } from "node:stream";
import { acceptWeights, weightOf } from "./files.ts";

/** Options of `buildDictionary`. */
export interface DictionaryBuildOptions {
  /** Byte cap of the dictionary (default 131072). */
  max?: number;
  /** A segment is kept when it occurs in at least this many samples (default 2; 1 = every segment of a single sample). */
  minSamples?: number;
}

const MIN_SEGMENT = 24;
const MAX_SEGMENT = 512;
/** Content-defined cut points: after a tag, a JSON value separator or a line end (shared markup cuts at the same bytes on every page). */
const cut = (byte: number) => byte === 0x3e /* > */ || byte === 0x2c /* , */ || byte === 0x7d /* } */ || byte === 0x0a; /* \n */
/** zstd's formatted-dictionary magic (little endian): a raw dictionary must not start with it or zlib would parse it. */
const ZSTD_DICT_MAGIC = [0x37, 0xa4, 0x30, 0xec];

/**
 * A raw dictionary from `samples`: each sample is cut into content-defined segments (24–512 bytes, ending after `>`,
 * `,`, `}` or a newline); a segment seen in at least `minSamples` samples scores (samples − 1) × length — the bytes it
 * saves across them. The best-scoring segments fill the dictionary up to `max` bytes, written in the order they first
 * occur (runs of adjacent shared segments stay adjacent, so one match spans them). Deterministic for the same samples.
 */
export function buildDictionary(samples: readonly Uint8Array[], options: DictionaryBuildOptions = {}): Buffer {
  const max = options.max ?? 128 * 1024;
  const minSamples = Math.max(1, options.minSamples ?? 2);
  interface Segment {
    count: number;
    order: number;
    bytes: Uint8Array;
    seen: number;
  }
  const segments = new Map<string, Segment>();
  let order = 0;
  for (let s = 0; s < samples.length; s++) {
    const sample = samples[s]!;
    let start = 0;
    for (let i = 0; i < sample.length; i++) {
      const length = i + 1 - start;
      if ((length >= MIN_SEGMENT && cut(sample[i]!)) || length >= MAX_SEGMENT || i === sample.length - 1) {
        const bytes = sample.subarray(start, i + 1);
        const key = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
        const known = segments.get(key);
        if (!known) segments.set(key, { count: 1, order: order++, bytes, seen: s });
        else if (known.seen !== s) {
          known.count++;
          known.seen = s;
        }
        start = i + 1;
      }
    }
  }
  const kept = [...segments.values()]
    .filter((segment) => segment.count >= minSamples)
    .sort((a, b) => (b.count - 1 || 1) * b.bytes.length - (a.count - 1 || 1) * a.bytes.length || a.order - b.order);
  const chosen: Segment[] = [];
  let size = 0;
  for (const segment of kept) {
    if (size + segment.bytes.length > max) continue;
    chosen.push(segment);
    size += segment.bytes.length;
  }
  chosen.sort((a, b) => a.order - b.order);
  const out = Buffer.concat(
    chosen.map((segment) => segment.bytes),
    size,
  );
  if (ZSTD_DICT_MAGIC.every((byte, i) => out[i] === byte)) out[0] = 0x20;
  return out;
}

/** One dictionary of the registry (manifest entry + bytes). */
export interface Dictionary {
  /** `Use-As-Dictionary` `id` (16 hex digits of the SHA-256), echoed by browsers as `Dictionary-Id`. */
  readonly id: string;
  /** URL path of the dictionary file (`<base>/_rivet/dict/<id>.dict`). */
  readonly url: string;
  /** URL path prefix the dictionary covers: `match="<prefix>*"`. */
  readonly prefix: string;
  /** `Available-Dictionary` value naming it: `:<base64 SHA-256>:` (RFC 8941 byte sequence). */
  readonly available: string;
  readonly bytes: Buffer;
  /** `dcz` stream header: the skippable-frame magic + its SHA-256 (RFC 9842 §4.2). */
  readonly header: Buffer;
  /** `Use-As-Dictionary` value. */
  readonly use: string;
}
/** The dictionaries a server offers, most specific prefix first. */
export interface DictionaryRegistry {
  readonly entries: readonly Dictionary[];
  /** Dictionary file by URL path. */
  readonly files: ReadonlyMap<string, Dictionary>;
  /** Dictionary by `Available-Dictionary` value. */
  readonly available: ReadonlyMap<string, Dictionary>;
}
/** Manifest written next to the client build (`.vite/rivet-dictionaries.json`). */
export interface DictionaryManifest {
  readonly dictionaries: readonly { readonly id: string; readonly url: string; readonly prefix: string; readonly file: string }[];
}
export const DICTIONARY_MANIFEST = ".vite/rivet-dictionaries.json";
const DCZ_MAGIC = Buffer.from([0x5e, 0x2a, 0x4d, 0x18, 0x20, 0x00, 0x00, 0x00]);

/** A registry entry from dictionary bytes (`url` = where it is served, `prefix` = the URL space it covers). */
export function dictionaryEntry(bytes: Buffer, url: string, prefix: string): Dictionary {
  const digest = createHash("sha256").update(bytes).digest();
  const id = digest.subarray(0, 8).toString("hex");
  return {
    id,
    url,
    prefix,
    available: ":" + digest.toString("base64") + ":",
    bytes,
    header: Buffer.concat([DCZ_MAGIC, digest]),
    use: `match="${prefix.replace(/[\\"]/g, "\\$&")}*", id="${id}"`,
  };
}
/** Registry from entries (sorted: longest prefix first, the match browsers prefer). */
export function dictionaryRegistry(entries: readonly Dictionary[]): DictionaryRegistry | null {
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => b.prefix.length - a.prefix.length);
  return { entries: sorted, files: new Map(sorted.map((entry) => [entry.url, entry])), available: new Map(sorted.map((entry) => [entry.available, entry])) };
}

/** The registry of a client build (`writeDictionaries` output); null when it has none. Synchronous (read once at start). */
export function readDictionaries(client: string): DictionaryRegistry | null {
  let manifest: DictionaryManifest;
  try {
    manifest = JSON.parse(readFileSync(join(client, DICTIONARY_MANIFEST), "utf8")) as DictionaryManifest;
  } catch {
    return null;
  }
  const entries: Dictionary[] = [];
  for (const item of manifest.dictionaries ?? []) {
    try {
      const entry = dictionaryEntry(readFileSync(join(client, item.file)), item.url, item.prefix);
      // A file edited after the build would name another hash than its URL promises: skipped.
      if (entry.id === item.id) entries.push(entry);
    } catch {
      // Missing file: skipped.
    }
  }
  return dictionaryRegistry(entries);
}

/** The most specific dictionary covering `pathname`. */
export function dictionaryFor(registry: DictionaryRegistry, pathname: string): Dictionary | undefined {
  for (const entry of registry.entries) if (pathname.startsWith(entry.prefix)) return entry;
  return undefined;
}

/**
 * The dictionary to encode a response with: the request's `Available-Dictionary` names one of the registry's, it covers
 * `pathname` and `Accept-Encoding` takes `dcz`. Otherwise undefined (the usual encodings apply).
 */
export function dictionaryOf(
  registry: DictionaryRegistry,
  available: string | string[] | undefined,
  acceptEncoding: string | undefined,
  pathname: string,
): Dictionary | undefined {
  if (typeof available !== "string" || !acceptEncoding) return undefined;
  const entry = registry.available.get(available.trim());
  if (!entry || !pathname.startsWith(entry.prefix)) return undefined;
  return weightOf(acceptWeights(acceptEncoding), "dcz") > 0 ? entry : undefined;
}

// Levels as the adapter's zstd (`node.ts` `zstdLevel`): −1 for bodies ≥ 256 KiB, −3 below; sync up to 4 MiB.
const LARGE_BODY = 256 * 1024;
const ZSTD_SYNC = 4 * 1024 * 1024;
const level = (size: number) => ({ [zlib.ZSTD_c_compressionLevel]: size >= LARGE_BODY ? 1 : 3 });
const framed = (entry: Dictionary, packed: Buffer) => Buffer.concat([entry.header, packed]);
const zstdAsync = (body: Uint8Array, options: object) =>
  new Promise<Buffer>((done, fail) => zstdCompress(body, options, (error, out) => (error ? fail(error) : done(out))));

/** One `dcz` body: header + zstd with the dictionary, at the per-request level. */
export function dczOnce(entry: Dictionary, body: Uint8Array): Buffer | Promise<Buffer> {
  const options = { params: level(body.length), dictionary: entry.bytes };
  return body.length > ZSTD_SYNC ? zstdAsync(body, options).then((out) => framed(entry, out)) : framed(entry, zstdCompressSync(body, options));
}
/** A `dcz` body compressed once and reused (static files, stored pages): zstd 19. */
export function dczBest(entry: Dictionary, body: Uint8Array): Promise<Buffer> {
  return zstdAsync(body, { params: { [zlib.ZSTD_c_compressionLevel]: 19 }, dictionary: entry.bytes }).then((out) => framed(entry, out));
}
/** Streaming `dcz` (flushes every chunk, as the adapter's other streams): the header leaves first. */
export function dczStream(entry: Dictionary, collected = 0): Transform {
  const stream = createZstdCompress({ flush: zlib.ZSTD_e_flush, params: level(collected), dictionary: entry.bytes });
  stream.push(entry.header);
  return stream;
}

/** `Vary` with `Available-Dictionary` (and `Accept-Encoding`) added once. */
export function varyDictionary(vary: string | undefined): string {
  if (!vary) return "Accept-Encoding, Available-Dictionary";
  const names = vary.toLowerCase();
  return vary + (names.includes("accept-encoding") ? "" : ", Accept-Encoding") + (names.includes("available-dictionary") ? "" : ", Available-Dictionary");
}
/** `Link` header value that makes the browser fetch the dictionary at idle (`rel="compression-dictionary"`). */
export const dictionaryLink = (entry: Dictionary) => `<${entry.url}>; rel="compression-dictionary"`;

// ---------------------------------------------------------------------------------------------------------------------
// Build: dictionaries of a prerendered site.

/** Options of `writeDictionaries`. */
export interface WriteDictionariesOptions {
  /** URL base path the site is served under (`/app`). */
  base?: string;
  /** Byte cap of the dictionary (default 131072). */
  max?: number;
}
/** Default dictionary cap: 128 KiB saturates on the measured sites (192 / 256 KiB: ≤ 1 point less). */
export const DICTIONARY_MAX = 128 * 1024;
const SAMPLES_PER_GROUP = 12;
const evenly = <T>(list: readonly T[], count: number): T[] =>
  list.length <= count ? [...list] : Array.from({ length: count }, (_, i) => list[Math.floor((i * list.length) / count)]!);

/**
 * Build the compression dictionary of a prerendered site in `outDir`, `match="<base>/*"`: samples = up to 12 HTML pages
 * per route group (first path segment below the base; evenly spaced) and their `_data.json` answers. One dictionary for
 * the whole site measured as good as per-group ones plus the site's, for one download (`docs/benchmarks/2026-10-22-
 * dictionary-transport.md`). Writes `_rivet/dict/<id>.dict` (content-hashed: immutable) and
 * `.vite/rivet-dictionaries.json`; earlier dictionaries in `_rivet/dict/` are removed. Returns the manifest (no
 * dictionary when the site has fewer than 2 pages or they share nothing).
 */
export function writeDictionaries(outDir: string, options: WriteDictionariesOptions = {}): DictionaryManifest {
  const base = (options.base ?? "").replace(/\/+$/, "");
  const max = options.max ?? DICTIONARY_MAX;
  const dir = join(outDir, "_rivet", "dict");
  rmSync(dir, { recursive: true, force: true });
  const pages: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at).sort()) {
      if (name.startsWith(".")) continue;
      const path = join(at, name);
      if (statSync(path).isDirectory()) {
        if (at === outDir && (name === "assets" || name === "_rivet")) continue;
        walk(path);
      } else if (name.endsWith(".html") && name !== "404.html" && name !== "200.html") pages.push(path);
    }
  };
  walk(outDir);
  const groups = new Map<string, string[]>();
  for (const page of pages) {
    const parts = relative(outDir, page).split(sep);
    const group = parts.length > 1 ? parts[0]! : "";
    (groups.get(group) ?? groups.set(group, []).get(group)!).push(page);
  }
  const samples = [...groups.values()].flatMap((list) =>
    evenly(list, SAMPLES_PER_GROUP).flatMap((page) => {
      // `_data.json` beside `a/index.html`, or in `a/` for `a.html` (`trailingSlash: "never"`).
      const data = page.endsWith(sep + "index.html") ? join(page, "..", "_data.json") : join(page.slice(0, -5), "_data.json");
      return existsSync(data) ? [readFileSync(page), readFileSync(data)] : [readFileSync(page)];
    }),
  );
  const out: { id: string; url: string; prefix: string; file: string }[] = [];
  const bytes = pages.length >= 2 ? buildDictionary(samples, { max }) : Buffer.alloc(0);
  if (bytes.length >= 256) {
    const { id } = dictionaryEntry(bytes, "", base + "/");
    const file = `_rivet/dict/${id}.dict`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(outDir, file), bytes);
    out.push({ id, url: `${base}/${file}`, prefix: `${base}/`, file });
  }
  const manifest: DictionaryManifest = { dictionaries: out };
  // No dictionary (one page, too little shared markup): no `.vite/` manifest either, and a stale one goes.
  if (out.length === 0) rmSync(join(outDir, DICTIONARY_MANIFEST), { force: true });
  else {
    mkdirSync(join(outDir, ".vite"), { recursive: true });
    writeFileSync(join(outDir, DICTIONARY_MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
  }
  return manifest;
}
