// Google Fonts for kit `?font` (build time only, imported lazily by vite.ts): `google-font:<Family>?…&font`
// downloads the family's css2 stylesheet and the one woff2 file for the requested subset into a
// local cache, then resolves to that file so the regular `?font` pipeline self-hosts it. Pages never
// request fonts.googleapis.com / fonts.gstatic.com; a warm cache needs no network.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const GOOGLE_PREFIX = "google-font:";
const CSS_ORIGIN = "https://fonts.googleapis.com";
const FILE_ORIGIN = "https://fonts.gstatic.com/";
// css2 picks the format by user agent: a current Chromium gets woff2 split into unicode-range subsets.
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export interface GoogleFontRequest {
  family: string;
  /** css2 URL (`/css2?family=Inter:ital,wght@0,100..900&display=swap`). */
  url: string;
  subset: string;
  /** Params handed on to the local `?font` import (family, weight, style, unicodeRange added later). */
  params: URLSearchParams;
}

const RANGE = /^-?\d{1,4}(?:\.\d+)?(?:\.\.-?\d{1,4}(?:\.\d+)?)?$/;
// css2 wants axis tags sorted: lowercase (registered) axes first, then uppercase (custom) ones, each alphabetical.
const axisOrder = (a: string, b: string) => {
  const upper = (t: string) => (t[0]! >= "A" && t[0]! <= "Z" ? 1 : 0);
  return upper(a) - upper(b) || (a < b ? -1 : a > b ? 1 : 0);
};

/**
 * `google-font:Plus+Jakarta+Sans?weight=200..800&style=italic&subset=latin&axes=opsz:14..32&text=Hi&font`
 * (all optional but `font`; `display`, `fallback` pass through to `?font`). `null` when not a Google id.
 */
export function parseGoogleFontId(id: string): GoogleFontRequest | null {
  if (!id.startsWith(GOOGLE_PREFIX)) return null;
  const q = id.indexOf("?");
  const name = decodeURIComponent((q < 0 ? id.slice(GOOGLE_PREFIX.length) : id.slice(GOOGLE_PREFIX.length, q)).replaceAll("+", " ")).trim();
  const params = new URLSearchParams(q < 0 ? "" : id.slice(q + 1));
  if (!params.has("font")) throw new Error(`${id}: Google font imports need "&font" (google-font:${name || "Inter"}?weight=400&font)`);
  if (!/^[A-Za-z0-9][A-Za-z0-9 ]*$/.test(name)) throw new Error(`${id}: invalid Google font family "${name}"`);
  const weight = params.get("weight") ?? "400";
  if (!/^\d{1,4}(?:\.\.\d{1,4})?$/.test(weight)) throw new Error(`${id}: invalid weight "${weight}"`);
  const style = params.get("style") ?? "normal";
  if (style !== "normal" && style !== "italic") throw new Error(`${id}: style must be normal or italic`);
  const subset = params.get("subset") ?? "latin";
  if (!/^[a-z0-9-]+$/.test(subset)) throw new Error(`${id}: invalid subset "${subset}"`);
  const axes = new Map<string, string>([["wght", weight]]);
  if (style === "italic") axes.set("ital", "1");
  for (const entry of (params.get("axes") ?? "").split(",").filter(Boolean)) {
    const [tag = "", range = ""] = entry.split(":");
    if (!/^[A-Za-z]{4}$/.test(tag) || !RANGE.test(range) || tag === "ital" || tag === "wght")
      throw new Error(`${id}: invalid axis "${entry}" (axes=opsz:14..32,wdth:75..100; weight/style set wght/ital)`);
    axes.set(tag, range);
  }
  const tags = [...axes.keys()].sort(axisOrder);
  const family = `${name.replaceAll(" ", "+")}:${tags.join(",")}@${tags.map((t) => axes.get(t)).join(",")}`;
  const text = params.get("text");
  const url = `${CSS_ORIGIN}/css2?family=${family}&display=swap${text ? `&text=${encodeURIComponent(text)}` : ""}`;
  const local = new URLSearchParams();
  local.set("family", params.get("family") ?? name);
  local.set("weight", weight);
  local.set("style", style);
  for (const key of ["display", "fallback"]) {
    const value = params.get(key);
    if (value !== null) local.set(key, value);
  }
  return { family: name, url, subset: text ? "text" : subset, params: local };
}

interface Face {
  subset: string | undefined;
  src: string;
  unicodeRange: string | undefined;
}
/** `@font-face` blocks of a css2 response (`/* latin *\/` comment before each subset). */
export function googleFaces(css: string): Face[] {
  const faces: Face[] = [];
  for (const match of css.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g)) {
    const body = match[2] ?? "";
    const src = /url\(([^)]+)\)\s*format\(['"]?woff2['"]?\)/.exec(body)?.[1]?.replace(/^['"]|['"]$/g, "");
    if (!src) continue;
    faces.push({ subset: match[1], src, unicodeRange: /unicode-range:\s*([^;]+)/.exec(body)?.[1]?.trim() });
  }
  return faces;
}

const sha = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);
async function writeAtomic(path: string, data: string | Uint8Array): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}
async function download(url: string, family: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  } catch (error) {
    throw new Error(
      `Google font "${family}": download of ${url} failed (${(error as Error).message}). ` +
        `Builds need network once; the cache (kit({ fonts: { cacheDir } }), default node_modules/.rivet/fonts) then serves it offline — ` +
        `restore it in CI, or self-host the file with a local "?font" import.`,
    );
  }
  if (!response.ok) throw new Error(`Google font "${family}": ${url} answered ${response.status}`);
  return response;
}

/**
 * The local `?font` id for a Google font: `<cacheDir>/<family>-<subset>-<hash>.woff2?family=…&unicodeRange=…&font`.
 * Cached by css2 URL (stylesheet) and file URL (woff2); delete the cache directory to refresh.
 */
export async function resolveGoogleFont(request: GoogleFontRequest, cacheDir: string): Promise<{ id: string; file: string }> {
  await mkdir(cacheDir, { recursive: true });
  const cssFile = join(cacheDir, `${sha(request.url)}.css`);
  let css: string;
  if (existsSync(cssFile)) css = await readFile(cssFile, "utf8");
  else {
    css = await (await download(request.url, request.family)).text();
    await writeAtomic(cssFile, css);
  }
  const faces = googleFaces(css);
  const face = request.subset === "text" ? faces[0] : faces.find((f) => f.subset === request.subset);
  if (!face) {
    const known = faces.map((f) => f.subset).filter(Boolean);
    throw new Error(`Google font "${request.family}": no "${request.subset}" subset (available: ${known.join(", ") || "none"}) in ${request.url}`);
  }
  if (!face.src.startsWith(FILE_ORIGIN)) throw new Error(`Google font "${request.family}": unexpected font URL ${face.src}`);
  const slug = request.family.toLowerCase().replaceAll(" ", "-");
  const file = join(cacheDir, `${slug}-${request.subset}-${sha(face.src)}.woff2`);
  if (!existsSync(file)) await writeAtomic(file, new Uint8Array(await (await download(face.src, request.family)).arrayBuffer()));
  const params = new URLSearchParams(request.params);
  if (face.unicodeRange) params.set("unicodeRange", face.unicodeRange);
  params.delete("font");
  return { id: `${file}?${params.toString()}&font`, file };
}
