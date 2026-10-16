// Incremental prerender for `serve` rebuilds. Every page embeds the resume manifest's chunk lists (the
// App's resume chunk lazy-loads every route chunk), so after a rebuild an unchanged page differs from
// its previous output only in content-hashed asset names. Pages whose sources changed are rendered
// again; the rest are copied from the previous build with old → new asset names rewritten (mapped
// through the two Vite manifests) and their CSP hashes recomputed. Safety nets, any of which falls
// back to a full prerender: canary pages rendered fresh must equal their rewritten copies, and every
// `/assets/…` reference in the output must exist.
import { constants, existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { hashCSP } from "@rivetjs/router/static";
import { restoreLinks } from "./critical-css.ts";
// Deep imports (no package subpath): the build type and the wire constants the static adapter uses.
import type { LoadedBuild } from "../../router/adapters/build.ts";
import { DATA_PARAM } from "../../router/shared/data.ts";
import { slashPath, type TrailingSlash } from "../../router/shared/slash.ts";

type ViteManifest = Record<string, { file: string; css?: string[]; assets?: string[] }>;

/** Manifest key without the content hash of a shared chunk (`_dom-Bi2CtnTl.js` → `_dom.js`); other keys are source paths. */
export const stableKey = (key: string) => (key.startsWith("_") ? key.replace(/-[\w-]{8}(\.\w+)$/, "$1") : key);

/** Output file → stable key (`<key>|file`, `<key>|css<i>`, `<key>|asset<i>`); keys two outputs share are dropped (ambiguous). */
function outputs(manifest: ViteManifest): Map<string, string> {
  const byKey = new Map<string, string | null>();
  const add = (key: string, file: string) => byKey.set(key, byKey.has(key) && byKey.get(key) !== file ? null : file);
  for (const [key, entry] of Object.entries(manifest)) {
    const stable = stableKey(key);
    add(stable + "|file", entry.file);
    entry.css?.forEach((file, i) => add(`${stable}|css${i}`, file));
    entry.assets?.forEach((file, i) => add(`${stable}|asset${i}`, file));
  }
  const files = new Map<string, string>();
  for (const [key, file] of byKey) if (file !== null) files.set(key, file);
  return files;
}

/** Old output file → new output file, for files whose name changed between two builds. */
export function renameMap(previous: ViteManifest, next: ViteManifest): Map<string, string> {
  const before = outputs(previous);
  const after = outputs(next);
  const map = new Map<string, string>();
  for (const [key, file] of before) {
    const now = after.get(key);
    if (now !== undefined && now !== file) map.set(file, now);
  }
  return map;
}

// Root-relative `/assets/…` only: `/<example>/assets/…` in embedded example HTML belongs to the examples origin.
const ASSET = /(?<![\w.~%/-])\/assets\/[\w.~-]+/g;
const CSP_META = /<meta http-equiv="Content-Security-Policy" content="[^"]*">/;

/** `/assets/…` references in a page or data file. */
export const assetRefs = (text: string): string[] => text.match(ASSET) ?? [];

/**
 * Rewrite asset names (and the resume manifest hash, `"h":"…"` in the resume state) in a prerendered
 * file; HTML gets its CSP `<meta>` recomputed (inline scripts may name assets).
 */
export function rewritePage(text: string, map: ReadonlyMap<string, string>, html: boolean, hash?: { from: string; to: string }): string {
  let changed = false;
  // Copies start from the page as prerendered: buildSite inlines critical CSS again (from the new stylesheets).
  if (html) text = restoreLinks(text);
  let out = text.replace(ASSET, (ref) => {
    const now = map.get(ref.slice(1));
    if (now === undefined) return ref;
    changed = true;
    return "/" + now;
  });
  if (hash && hash.from !== hash.to) {
    const from = `"h":${JSON.stringify(hash.from)}`;
    if (out.includes(from)) {
      out = out.replaceAll(from, `"h":${JSON.stringify(hash.to)}`);
      changed = true;
    }
  }
  if (!changed || !html || !CSP_META.test(out)) return out;
  return hashCSP(out.replace(CSP_META, ""));
}

/** Files of a built client dir that belong to pages (not assets, Vite metadata, search index or host files). */
async function pageFiles(client: string): Promise<string[]> {
  const entries = await readdir(client, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => relative(client, join(e.parentPath, e.name)).split(sep).join("/"))
    .filter((file) => !/^(assets|\.vite|pagefind)\//.test(file) && !["404.html", "_headers", "speculation-rules.json"].includes(file));
}

async function pool<T>(items: readonly T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]!);
    }),
  );
}

/** Where two texts first differ (for the fallback reason). */
function difference(before: string, after: string): string {
  let at = 0;
  while (at < before.length && before[at] === after[at]) at++;
  const show = (text: string) => JSON.stringify(text.slice(Math.max(0, at - 30), at + 50));
  return `at ${at}: ${show(before)} → ${show(after)}`;
}

export type PartialResult = { ok: true; rendered: number; copied: number } | { ok: false; why: string };

/**
 * Prerender `pages` (URL paths, `/components/menu/`) of the fresh build in `dist` and carry every other
 * page over from `previous` (the served client dir). `{ ok: false, why }` = do a full prerender.
 */
export async function prerenderPartial(options: {
  dist: string;
  /** The loaded build of `dist` (`loadBuild`). */
  build: LoadedBuild;
  previous: string;
  pages: readonly string[];
  origin: string;
  canaries?: number;
}): Promise<PartialResult> {
  const { dist, previous, origin } = options;
  const client = resolve(dist, "client");
  const oldManifest = resolve(previous, ".vite/manifest.json");
  if (!existsSync(oldManifest)) return { ok: false, why: "no previous build" };
  const map = renameMap(
    JSON.parse(await readFile(oldManifest, "utf8")) as ViteManifest,
    JSON.parse(await readFile(resolve(client, ".vite/manifest.json"), "utf8")) as ViteManifest,
  );
  const { entry, handler } = options.build;
  // Resume manifest hash, embedded in every page's resume state.
  const resumeHash = async (dir: string) =>
    ((await readFile(resolve(dir, ".vite/rivet-resume.json"), "utf8").then(JSON.parse, () => ({}))) as { hash?: string }).hash;
  const [from, to] = await Promise.all([resumeHash(previous), resumeHash(client)]);
  const hash = from && to ? { from, to } : undefined;
  if (from !== to && !hash) return { ok: false, why: "resume manifest hash unknown" };
  if (entry.base) return { ok: false, why: "base path" };
  const policy: TrailingSlash = entry.trailingSlash ?? "ignore";
  const pathOf = (href: string) => (href === "/" ? "/" : href.replace(/\/+$/, ""));
  const htmlFile = (path: string) => (policy === "never" && path !== "/" ? path.slice(1) + ".html" : (path === "/" ? "" : path.slice(1) + "/") + "index.html");
  const dataFile = (path: string) => (path === "/" ? "" : path.slice(1) + "/") + "_data.json";
  const render = async (path: string): Promise<{ html: string; data: Uint8Array } | null> => {
    const url = new URL(slashPath(path, policy), origin);
    const page = await handler(new Request(url, { headers: { accept: "text/html" } }));
    // Gone (a removed example's page): not written, and not carried over either.
    if (page.status === 404) return null;
    if (page.status !== 200) throw new Error(`Prerender ${url.pathname} returned ${page.status}`);
    url.searchParams.set(DATA_PARAM, "data");
    const data = await handler(new Request(url, { headers: { accept: "application/json" } }));
    return { html: hashCSP(await page.text()), data: new Uint8Array(await data.arrayBuffer()) };
  };
  const put = async (file: string, body: string | Uint8Array) => {
    await mkdir(dirname(resolve(client, file)), { recursive: true });
    await writeFile(resolve(client, file), body);
  };

  const fresh = new Set(options.pages.map(pathOf));
  const own = new Set([...fresh].flatMap((path) => [htmlFile(path), dataFile(path)]));
  const carried = (await pageFiles(previous)).filter((file) => !own.has(file) && !existsSync(resolve(client, file)));
  // Canaries: unchanged pages rendered fresh must equal their rewritten copies (catches anything but renamed assets).
  const candidates = carried.filter((file) => file.endsWith("index.html")).map((file) => "/" + file.replace(/(^|\/)index\.html$/, ""));
  const canaries = [...new Set(["/", candidates[Math.floor(candidates.length / 2)]])]
    .filter((path): path is string => !!path && candidates.includes(path))
    .slice(0, options.canaries ?? 2);
  for (const path of canaries) {
    const page = await render(path);
    if (!page) return { ok: false, why: `canary ${path} is gone` };
    const { html, data } = page;
    const copy = rewritePage(await readFile(resolve(previous, htmlFile(path)), "utf8"), map, true, hash);
    if (copy !== html) return { ok: false, why: `canary ${path} changed beyond asset names: ${difference(copy, html)}` };
    const oldData = await readFile(resolve(previous, dataFile(path)), "utf8").catch(() => null);
    if (oldData !== null && rewritePage(oldData, map, false, hash) !== new TextDecoder().decode(data)) return { ok: false, why: `canary ${path} data changed` };
  }
  const missing = new Set<string>();
  const verify = (text: string) => {
    for (const ref of assetRefs(text)) if (!existsSync(resolve(client, ref.slice(1)))) missing.add(ref);
  };
  await pool(carried, 16, async (file) => {
    if (/\.(html|json)$/.test(file)) {
      const text = rewritePage(await readFile(resolve(previous, file), "utf8"), map, file.endsWith(".html"), hash);
      verify(text);
      await put(file, text);
    } else {
      await mkdir(dirname(resolve(client, file)), { recursive: true });
      await copyFile(resolve(previous, file), resolve(client, file), constants.COPYFILE_FICLONE);
    }
  });
  for (const path of fresh) {
    const page = await render(path);
    if (!page) continue;
    const { html, data } = page;
    verify(html);
    await put(htmlFile(path), html);
    await put(dataFile(path), data);
  }
  const notFound = await handler(new Request(new URL("/__rivet_not_found__", origin), { headers: { accept: "text/html" } }));
  if (notFound.status === 404) await put("404.html", hashCSP(await notFound.text()));
  if (missing.size) return { ok: false, why: `${missing.size} asset reference(s) not in the new build (${[...missing][0]})` };
  return { ok: true, rendered: fresh.size, copied: carried.filter((file) => file.endsWith(".html")).length };
}
