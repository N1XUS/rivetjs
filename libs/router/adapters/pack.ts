// Packaging for platform targets (Node-only, build time): after `vite build --ssr` wrote
// `dist/server` (with the target's generated entry), lay the build out the way the platform
// deploys it. Static files are copied (never the `.vite/` manifests, which the bundle inlines);
// routes that `export const prerender = true` (every prerenderable route in `mode: "static"`) are
// rendered to HTML files through the built handler, with a hash CSP (`static.ts`).
//
// Platform contracts (verified 2026-10-08):
// - Vercel Build Output API v3: https://vercel.com/docs/build-output-api/v3 (primitives, configuration)
// - Netlify Frameworks API: https://docs.netlify.com/build/frameworks/frameworks-api/
// - Cloudflare Workers static assets: https://developers.cloudflare.com/workers/static-assets/ (+ `_headers`:
//   https://developers.cloudflare.com/workers/static-assets/headers/), redirected Wrangler configuration:
//   https://developers.cloudflare.com/workers/wrangler/configuration/#generated-wrangler-configuration
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { AdapterOptions, CloudflareAdapterOptions, NetlifyAdapterOptions, VercelAdapterOptions } from "./target-build.ts";
import { pathToFileURL } from "node:url";
import { readManifests } from "./build.ts";
import { assemble } from "./assemble.ts";
import type { GeneratedEntry } from "../server/app.ts";
import type { AppHandler } from "../server/handler.ts";
import { prerender } from "./static.ts";
import { loadServer } from "../server/module.ts";
import type { TrailingSlash } from "../shared/slash.ts";

export interface PackContext {
  /** Project (Vite) root. */
  readonly root: string;
  /** Build output with `client/` and `server/`. */
  readonly dist: string;
  /** Server build directory (`dist/server`). */
  readonly server: string;
  /** URL base path (`""` or `/app`). */
  readonly base: string;
  /** `server`: a function renders requests; `static`: files only. */
  readonly mode: "server" | "static";
}
/** One prerendered page: its canonical URL path and the file written for it (relative to the static root). */
export interface PackedPage {
  readonly url: string;
  readonly file: string;
}
export interface PackResult {
  /** Directories written (absolute). */
  readonly outputs: readonly string[];
  readonly pages: readonly PackedPage[];
}

export const IMMUTABLE = "public, max-age=31536000, immutable";
const GENERATOR = "@rivetjs/router";

export async function pack(options: AdapterOptions, context: PackContext): Promise<PackResult | undefined> {
  switch (options.name) {
    case "vercel":
      return packVercel(options, context);
    case "netlify":
      return packNetlify(options, context);
    case "cloudflare":
      return packCloudflare(options, context);
    default:
      return undefined;
  }
}

/** URL path prefixes of content-hashed files (`<base>/assets/`, per locale with i18n). */
export function immutablePrefixes(base: string, locales: readonly string[] | undefined): string[] {
  return locales?.length ? locales.map((locale) => `${base}/${locale}/assets/`) : [`${base}/assets/`];
}

/** Copy the client build into `to`, without dot-named build metadata (`.vite/`); `.well-known/` stays. */
async function copyClient(dist: string, to: string): Promise<void> {
  await mkdir(to, { recursive: true });
  const from = resolve(dist, "client");
  await cp(from, to, {
    recursive: true,
    dereference: true,
    filter: (source) => {
      const name = basename(source);
      return source === from || !name.startsWith(".") || name === ".well-known";
    },
  });
}

/** Files below `dir`, as `/`-joined relative paths. */
export async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isFile()).map((entry) => relative(dir, join(entry.parentPath, entry.name)).split("\\").join("/"));
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

/**
 * Prerender into `staticRoot` (the directory served at `/`): every prerenderable route in static mode,
 * routes exporting `prerender = true` in server mode (no 404 page: the function answers misses).
 */
async function prerenderInto(
  options: AdapterOptions,
  context: PackContext,
  staticRoot: string,
  facts: { trailingSlash?: TrailingSlash } = {},
): Promise<PackedPage[]> {
  // Import a private copy of the server build: Node's module cache is keyed by path, so a later build in
  // the same process (tests, build scripts, watch) would get the first build's modules (chunks import the
  // entry back by path) and its deleted chunks. The bundle imports only built-ins, so any directory does.
  const copy = await mkdtemp(join(tmpdir(), "rivet-pack-"));
  try {
    await cp(context.server, copy, { recursive: true });
    const path = pathToFileURL(join(copy, "entry.server.js")).href;
    const entry = (await import(path)) as GeneratedEntry;
    const manifests = await readManifests(context.dist, { ...(options.locales?.length ? { locales: options.locales } : {}), base: entry.base ?? "" });
    facts.trailingSlash = entry.trailingSlash ?? "ignore";
    return await prerenderWith(entry, assemble(entry, manifests, {}, path), options, context, staticRoot);
  } finally {
    await rm(copy, { recursive: true, force: true });
  }
}

async function prerenderWith(
  entry: GeneratedEntry,
  handler: AppHandler,
  options: AdapterOptions,
  context: PackContext,
  staticRoot: string,
): Promise<PackedPage[]> {
  let routes = entry.routes;
  if (context.mode === "server") {
    const marked = await Promise.all(routes.map(async (route) => route.page && (await loadServer(route.server))?.prerender === true));
    routes = routes.filter((_, i) => marked[i]);
    if (!routes.length) return [];
  }
  const outDir = staticRoot + context.base;
  const notFound = join(outDir, "404.html");
  const kept404 = await exists(notFound);
  const trailingSlash: TrailingSlash = entry.trailingSlash ?? "ignore";
  const report = await prerender({
    handler,
    routes,
    outDir,
    trailingSlash,
    ...(context.base ? { base: context.base } : {}),
    ...(options.csp !== undefined ? { csp: options.csp } : {}),
  });
  if (context.mode === "server" && !kept404) await rm(notFound, { force: true });
  return report.pages.map((url) => ({ url, file: pageFile(url, context.base, trailingSlash) }));
}

/** The file `prerender` writes for a canonical page URL, relative to the static root. */
function pageFile(url: string, base: string, trailingSlash: TrailingSlash): string {
  const local = (base && url.startsWith(base) ? url.slice(base.length) : url) || "/";
  const path = decodeURIComponent(local).replace(/\/+$/, "");
  const file = trailingSlash === "never" && path ? path + ".html" : path + "/index.html";
  return (base + file).replace(/^\/+/, "");
}

const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
async function write(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}
/** PCRE-safe literal. */
const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

// ---------------------------------------------------------------------------------------------
// Vercel: `.vercel/output/{config.json, static/, functions/_render.func/}`.

const VERCEL_FUNCTION = "_render";

async function packVercel(options: VercelAdapterOptions, context: PackContext): Promise<PackResult> {
  const out = resolve(context.root, ".vercel/output");
  await rm(out, { recursive: true, force: true });
  const staticRoot = join(out, "static");
  await copyClient(context.dist, staticRoot + context.base);
  const pages = await prerenderInto(options, context, staticRoot);
  const server = context.mode === "server";
  const isr = server && options.isr ? options.isr : null;
  const routes: Record<string, unknown>[] = immutablePrefixes(context.base, options.locales).map((prefix) => ({
    src: `^${literal(prefix)}.+$`,
    headers: { "cache-control": IMMUTABLE },
    continue: true,
  }));
  // Prerendered `a/index.html` / `a.html` answer at `/a` (Vercel's file system matches exact paths).
  const overrides: Record<string, { path: string }> = {};
  const isrRoutes: Record<string, unknown>[] = [];
  if (server) {
    const fn = join(out, "functions", VERCEL_FUNCTION + ".func");
    await cp(context.server, fn, { recursive: true });
    await write(join(fn, "package.json"), json({ type: "module" }));
    const config =
      options.runtime === "edge"
        ? { runtime: "edge", entrypoint: "vercel.js", ...(options.regions ? { regions: options.regions } : {}) }
        : {
            runtime: `nodejs${options.nodeVersion ?? 24}.x`,
            handler: "vercel.js",
            launcherType: "Nodejs",
            shouldAddHelpers: false,
            supportsResponseStreaming: true,
            ...(options.regions ? { regions: options.regions } : {}),
            ...(options.maxDuration !== undefined ? { maxDuration: options.maxDuration } : {}),
            ...(options.memory !== undefined ? { memory: options.memory } : {}),
          };
    await write(join(fn, ".vc-config.json"), json(config));
  }
  for (const page of pages) {
    const path = page.url.replace(/\/+$/, "") || "/";
    if (isr) {
      // ISR: a prerender function per page (symlink to the render function) instead of a file;
      // the page path travels as `__rivet_path` (a prerender function's own path is its name).
      await rm(join(staticRoot, page.file), { force: true });
      const name = "_isr" + (path === "/" ? "/index" : path);
      const link = join(out, "functions", name + ".func");
      await mkdir(dirname(link), { recursive: true });
      await symlink(relative(dirname(link), join(out, "functions", VERCEL_FUNCTION + ".func")), link, "dir");
      await write(
        join(out, "functions", name + ".prerender-config.json"),
        json({ expiration: isr.expiration, allowQuery: ["__rivet_path", "_rivet"], passQuery: true }),
      );
      isrRoutes.push({ src: `^${literal(path === "/" ? "" : path)}/?$`, dest: `/${name}?__rivet_path=${encodeURIComponent(path)}` });
    } else if (page.file !== "index.html") {
      overrides[page.file] = { path: page.file.replace(/(\/index)?\.html$/, "") };
    }
  }
  routes.push({ handle: "filesystem" });
  routes.push(...isrRoutes);
  if (server) routes.push({ src: "^/.*$", dest: "/" + VERCEL_FUNCTION });
  else if (await exists(join(staticRoot, context.base, "404.html")))
    routes.push({ handle: "error" }, { status: 404, src: "^/.*$", dest: `${context.base}/404.html` });
  await write(join(out, "config.json"), json({ version: 3, routes, ...(Object.keys(overrides).length ? { overrides } : {}) }));
  return { outputs: [out], pages };
}

// ---------------------------------------------------------------------------------------------
// Netlify: publish dir `dist/netlify`, `.netlify/v1/{config.json, functions|edge-functions/rivet-server/}`.

export const NETLIFY_FUNCTION = "rivet-server";

async function packNetlify(options: NetlifyAdapterOptions, context: PackContext): Promise<PackResult> {
  const publish = resolve(context.dist, "netlify");
  const v1 = resolve(context.root, ".netlify/v1");
  await rm(publish, { recursive: true, force: true });
  for (const dir of ["functions", "edge-functions"]) await rm(join(v1, dir, NETLIFY_FUNCTION), { recursive: true, force: true });
  await copyClient(context.dist, publish + context.base);
  const pages = await prerenderInto(options, context, publish);
  const prefixes = immutablePrefixes(context.base, options.locales);
  const headers = prefixes.map((prefix) => ({ for: prefix + "*", values: { "cache-control": IMMUTABLE } }));
  if (context.mode === "server") {
    const name = `"${NETLIFY_FUNCTION}"`;
    if (options.edge) {
      // Edge Functions run before static files: answer only paths with no file (`undefined` = continue).
      const dir = join(v1, "edge-functions", NETLIFY_FUNCTION);
      await cp(context.server, dir, { recursive: true });
      const files = await listFiles(publish);
      const paths = new Set<string>();
      for (const file of files) {
        if (prefixes.some((prefix) => ("/" + file).startsWith(prefix))) continue;
        paths.add("/" + file);
        const page = /^(.*?)(?:\/index)?\.html$/.exec(file);
        if (page) for (const path of ["/" + page[1], "/" + page[1] + "/"]) paths.add(path.replace(/^\/\/$/, "/"));
      }
      await write(
        join(dir, NETLIFY_FUNCTION + ".js"),
        [
          `// Generated by ${GENERATOR}: Netlify Edge Function (Frameworks API). Do not edit.`,
          'import { create } from "./netlify.js";',
          `export default create({ staticPaths: ${JSON.stringify([...paths].sort())} });`,
          `export const config = ${JSON.stringify({ path: "/*", excludedPath: prefixes.map((prefix) => prefix + "*"), name: "Rivet", generator: GENERATOR })};`,
          "",
        ].join("\n"),
      );
    } else {
      const dir = join(v1, "functions", NETLIFY_FUNCTION);
      await cp(context.server, dir, { recursive: true });
      await write(join(dir, "package.json"), json({ type: "module" }));
      const config = {
        path: "/*",
        preferStatic: true,
        name: "Rivet",
        generator: GENERATOR,
        // Already bundled (`ssr.noExternal`): ship the directory as is.
        nodeBundler: "none",
        includedFiles: [relative(context.root, dir).split("\\").join("/") + "/**"],
      };
      await write(
        join(dir, NETLIFY_FUNCTION + ".mjs"),
        [
          `// Generated by ${GENERATOR}: Netlify Function (Functions v2, Frameworks API). Do not edit.`,
          'export { default } from "./netlify.js";',
          `export const config = ${JSON.stringify(config)};`,
          "",
        ].join("\n"),
      );
    }
  }
  await write(join(v1, "config.json"), json({ headers }));
  return { outputs: [publish, v1], pages };
}

// ---------------------------------------------------------------------------------------------
// Cloudflare Workers: `dist/cloudflare/{wrangler.json, static/}` + `.wrangler/deploy/config.json`.

/** Compatibility date of the generated Wrangler configuration. */
export const COMPATIBILITY_DATE = "2026-10-01";
/**
 * From 2026-08-04 `nodejs_compat` (+ `_v2`) is on by default; turned off explicitly, `nodejs_als` keeps
 * `node:async_hooks` (https://developers.cloudflare.com/workers/configuration/compatibility-flags/).
 */
export const WORKER_FLAGS = ["nodejs_als", "no_nodejs_compat", "no_nodejs_compat_v2"] as const;

async function packCloudflare(options: CloudflareAdapterOptions, context: PackContext): Promise<PackResult> {
  const out = resolve(context.dist, "cloudflare");
  await rm(out, { recursive: true, force: true });
  const staticRoot = join(out, "static");
  await copyClient(context.dist, staticRoot + context.base);
  const facts: { trailingSlash?: TrailingSlash } = {};
  const pages = await prerenderInto(options, context, staticRoot, facts);
  const prefixes = immutablePrefixes(context.base, options.locales);
  await write(join(staticRoot, "_headers"), prefixes.map((prefix) => `${prefix}*\n  Cache-Control: ${IMMUTABLE}\n`).join(""));
  const user = await userWrangler(context.root);
  const server = context.mode === "server";
  const rel = (path: string) => relative(out, path).split("\\").join("/");
  const config: Record<string, unknown> = {
    name: (await packageName(context.root)) ?? "rivet-app",
    compatibility_date: COMPATIBILITY_DATE,
    // AsyncLocalStorage only (resume state); no Node.js compatibility layer, so the renderer writes
    // plain Uint8Array slabs (workerd's `Buffer#utf8Write` rejects the in-place writes Node accepts).
    compatibility_flags: [...WORKER_FLAGS],
    ...user,
    ...options.wrangler,
    ...(server
      ? {
          // The server build is already bundled (route modules are relative chunks): upload it as is.
          main: rel(join(context.server, "worker.js")),
          base_dir: rel(context.server),
          no_bundle: true,
          find_additional_modules: true,
          rules: [{ type: "ESModule", globs: ["**/*.js"] }],
        }
      : {}),
    assets: {
      ...((user.assets as object | undefined) ?? {}),
      ...((options.wrangler?.assets as object | undefined) ?? {}),
      directory: "./static",
      // Prerendered `a/index.html` answers at the router's canonical URL (`/a`, or `/a/` with `trailingSlash: "always"`).
      html_handling: facts.trailingSlash === "always" ? "force-trailing-slash" : "drop-trailing-slash",
      ...(server ? {} : { not_found_handling: "404-page" }),
    },
  };
  if (!server) delete config.main;
  await write(join(out, "wrangler.json"), json(config));
  const redirect = resolve(context.root, ".wrangler/deploy/config.json");
  await write(redirect, json({ configPath: relative(dirname(redirect), join(out, "wrangler.json")).split("\\").join("/") }));
  return { outputs: [out, dirname(redirect)], pages };
}

/** The project's own `wrangler.json` / `wrangler.jsonc` (bindings, vars…), merged under the generated config. */
async function userWrangler(root: string): Promise<Record<string, unknown>> {
  for (const name of ["wrangler.jsonc", "wrangler.json"]) {
    const text = await readFile(join(root, name), "utf8").catch(() => null);
    if (text === null) continue;
    const config = JSON.parse(stripJSONC(text)) as Record<string, unknown>;
    // Paths in it are relative to the project root; the generated file sets its own.
    for (const key of ["main", "base_dir", "rules", "no_bundle", "find_additional_modules", "$schema"]) delete config[key];
    return config;
  }
  if (await exists(join(root, "wrangler.toml")))
    console.warn(
      'rivetRouter({ adapter: "cloudflare" }): wrangler.toml is not merged into the generated configuration; use wrangler.jsonc or the adapter\'s `wrangler` option',
    );
  return {};
}

/** JSONC → JSON: comments and trailing commas removed outside strings. */
export function stripJSONC(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"') {
      let end = i + 1;
      while (end < text.length && text[end] !== '"') end += text[end] === "\\" ? 2 : 1;
      out += text.slice(i, end + 1);
      i = end;
    } else if (char === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (char === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 1;
    } else out += char;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

/** `package.json` name as a Worker name (lower-case letters, digits, dashes). */
async function packageName(root: string): Promise<string | undefined> {
  const text = await readFile(join(root, "package.json"), "utf8").catch(() => null);
  const name = text ? (JSON.parse(text) as { name?: unknown }).name : undefined;
  if (typeof name !== "string") return undefined;
  const cleaned = name
    .replace(/^@[^/]+\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  return cleaned || undefined;
}
