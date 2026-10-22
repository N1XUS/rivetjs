// Deploy targets (`rivetRouter({ adapter: "vercel" | "netlify" | "cloudflare" | "bun" | "deno" })`):
// one fixture app built once per target. Checks the emitted layout against each platform's documented
// contract (no platform accounts or deploys) and runs every entry that can run here: Vercel's Node.js
// listener under node:http, the web-standard entries with synthetic Requests, `bun.js` under Bun when
// installed. Deno has no local runtime here: its entry is checked for shape only.
import { afterAll, test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { cp, lstat, mkdtemp, readFile, readdir, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { rivetRouter, type RivetRouterOptions } from "../build/vite.ts";
import { isrURL } from "../adapters/vercel.ts";
import { stripJSONC } from "../adapters/pack.ts";

const root = new URL("./fixture-deploy/", import.meta.url).pathname;
const dist = root + "dist/";
const IMMUTABLE = "public, max-age=31536000, immutable";

const config = (adapter: RivetRouterOptions["adapter"], ssr: boolean, extra: Partial<RivetRouterOptions> = {}) => ({
  root,
  configFile: false as const,
  logLevel: "silent" as const,
  plugins: [rivetRouter({ clientRouter: true, styles: ["src/styles.css"], adapter, ...extra })],
  ...(ssr ? { build: { ssr: true } } : {}),
});
/** Client build (shared by every target) + the target's server build (packages the platform output). */
async function target(adapter: RivetRouterOptions["adapter"], extra: Partial<RivetRouterOptions> = {}, client = false): Promise<void> {
  if (client) await build(config(adapter, false, extra));
  await build(config(adapter, true, extra));
}
const files = async (dir: string): Promise<string[]> =>
  (await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []))
    .filter((e) => e.isFile() || e.isSymbolicLink())
    .map((e) => join(e.parentPath, e.name).slice(dir.length))
    .sort();
const readJSON = async <T = Record<string, unknown>>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T;
const only = (value: object, keys: readonly string[], what: string) => {
  for (const key of Object.keys(value)) assert.ok(keys.includes(key), `${what}: undocumented key ${key}`);
};
/** A port nothing listens on right now (the OS picks it), for child servers that take a PORT. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
}

/** Bare/`node:` imports of every JS file below `dir`. */
async function imports(dir: string): Promise<Set<string>> {
  const found = new Set<string>();
  for (const file of await files(dir)) {
    if (!/\.m?js$/.test(file)) continue;
    const source = await readFile(join(dir, file), "utf8");
    for (const [, spec] of source.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)) if (!spec!.startsWith(".")) found.add(spec!);
  }
  return found;
}
async function listen(listener: (req: IncomingMessage, res: ServerResponse) => void): Promise<{ url: string; close(): Promise<void> }> {
  const server = createServer(listener);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((done) => server.close(() => done())) };
}
/**
 * Import a built module from a private copy of its directory: Node caches modules by path, and every
 * target rebuilds `dist/server` (chunks import the entry back by path, so a query string would not do).
 */
async function load<T>(dir: string, file: string): Promise<T> {
  const copy = await mkdtemp(join(tmpdir(), "rivet-deploy-"));
  copies.push(copy);
  await cp(dir, copy, { recursive: true, verbatimSymlinks: true });
  return (await import(pathToFileURL(join(copy, file)).href)) as T;
}
const copies: string[] = [];
afterAll(() => Promise.all(copies.map((copy) => rm(copy, { recursive: true, force: true }))));
const nonceOf = (response: Response) => /'nonce-([^']+)'/.exec(response.headers.get("content-security-policy") ?? "")?.[1];

// Documented key sets (Build Output API v3 primitives / configuration, 2026-10-08).
const VC_NODE = [
  "runtime",
  "handler",
  "memory",
  "architecture",
  "maxDuration",
  "environment",
  "regions",
  "supportsWrapper",
  "supportsResponseStreaming",
  "launcherType",
  "shouldAddHelpers",
  "shouldAddSourcemapSupport",
  "awsLambdaHandler",
];
const VC_EDGE = ["runtime", "entrypoint", "envVarsInUse", "regions"];
const VC_CONFIG = ["version", "routes", "images", "wildcard", "overrides", "cache", "framework", "crons", "services"];
const VC_ROUTE = [
  "src",
  "dest",
  "headers",
  "methods",
  "continue",
  "caseSensitive",
  "check",
  "status",
  "has",
  "missing",
  "locale",
  "middlewareRawSrc",
  "middlewarePath",
  "mitigate",
  "transforms",
  "handle",
];
const VC_PRERENDER = ["expiration", "group", "bypassToken", "fallback", "allowQuery", "passQuery", "initialHeaders", "initialStatus", "exposeErrBody"];
// Netlify Frameworks API in-source config (functions / edge functions) and config.json.
const NF_FUNCTION = [
  "path",
  "excludedPath",
  "preferStatic",
  "name",
  "generator",
  "includedFiles",
  "nodeBundler",
  "externalNodeModules",
  "ignoredNodeModules",
  "nodeVersion",
  "schedule",
  "rateLimit",
];
const NF_EDGE = ["path", "excludedPath", "method", "cache", "name", "generator", "onError", "rateLimit"];
const NF_CONFIG = ["edge_functions", "functions", "headers", "images", "redirects", "redirects!"];

test(
  "deploy targets: platform layouts per documented contract, entries answer like the node adapter",
  { timeout: 240_000 },
  steps(async (t) => {
    await rm(dist, { recursive: true, force: true });
    for (const dir of [".vercel", ".netlify", ".wrangler"]) await rm(root + dir, { recursive: true, force: true });
    await target("vercel", {}, true);

    await t.test("vercel (Node.js): config.json routes, static files, prerendered page, function config", async () => {
      const out = root + ".vercel/output/";
      const vc = await readJSON<{ version: number; routes: Record<string, unknown>[]; overrides?: Record<string, { path: string }> }>(out + "config.json");
      only(vc, VC_CONFIG, "config.json");
      assert.equal(vc.version, 3);
      for (const route of vc.routes) only(route, VC_ROUTE, "route");
      assert.deepEqual(vc.routes, [
        { src: "^\\/assets\\/.+$", headers: { "cache-control": IMMUTABLE }, continue: true },
        { handle: "filesystem" },
        { src: "^/.*$", dest: "/_render" },
      ]);
      assert.deepEqual(vc.overrides, { "about/index.html": { path: "about" } });
      const statics = await files(out + "static/");
      assert.ok(statics.includes("robots.txt"));
      assert.ok(
        statics.some((file) => /^assets\/styles-[^/]+\.css$/.test(file)),
        statics.join(),
      );
      assert.ok(!statics.some((file) => file.startsWith(".vite")), "no build manifests in static/");
      assert.ok(!statics.includes("404.html"), "server mode: the function answers misses");
      const about = await readFile(out + "static/about/index.html", "utf8");
      assert.match(about, /<h1 id="about">About at build time<\/h1>/);
      assert.match(about, /<meta http-equiv="Content-Security-Policy" content="script-src 'sha256-/);
      const fn = out + "functions/_render.func/";
      const vcConfig = await readJSON(fn + ".vc-config.json");
      only(vcConfig, VC_NODE, ".vc-config.json");
      assert.deepEqual(vcConfig, {
        runtime: "nodejs24.x",
        handler: "vercel.js",
        launcherType: "Nodejs",
        shouldAddHelpers: false,
        supportsResponseStreaming: true,
      });
      assert.deepEqual(await readJSON(fn + "package.json"), { type: "module" });
      const fnFiles = await files(fn);
      assert.ok(fnFiles.includes("vercel.js") && fnFiles.includes("entry.server.js"), fnFiles.join());
      // Self-contained: dependencies bundled, only Node built-ins imported.
      for (const spec of await imports(fn)) assert.match(spec, /^node:/, spec);
    });

    await t.test("vercel (Node.js): the listener renders, streams through Vercel's proxy headers, checks CSRF", async () => {
      const fn = root + ".vercel/output/functions/_render.func/";
      const listener = (await load<{ default: (req: IncomingMessage, res: ServerResponse) => void }>(fn, "vercel.js")).default;
      assert.equal(typeof listener, "function");
      const server = await listen(listener);
      const proxied = {
        host: "rivet-app.vercel.app",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "rivet-app.vercel.app",
        "x-forwarded-for": "203.0.113.7",
      };
      try {
        const page = await fetch(server.url + "/", { headers: proxied });
        assert.equal(page.status, 200);
        assert.equal(atob(nonceOf(page)!).length, 16);
        assert.equal(page.headers.get("x-content-type-options"), "nosniff");
        const html = await page.text();
        assert.match(html, /<h1>Hello deploy<\/h1>/);
        assert.match(html, /<p id="platform">address<\/p>/, "X-Forwarded-For (one trusted hop) → clientAddress");
        assert.match(html, /<link rel="stylesheet" href="\/assets\/styles-[^"]+\.css">/);
        assert.equal((await fetch(server.url + "/", { headers: { ...proxied, "accept-encoding": "br" } })).headers.get("content-encoding"), "br");
        const post = (origin: string) =>
          fetch(server.url + "/counter?/inc", {
            method: "POST",
            headers: { ...proxied, origin, accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
            body: "",
          });
        assert.equal((await post("https://rivet-app.vercel.app")).status, 200, "https origin from X-Forwarded-Proto");
        assert.equal((await post("https://evil.example")).status, 403);
        const data = await fetch(server.url + "/counter?_rivet=data", { headers: proxied });
        assert.equal(data.status, 200);
        assert.equal((await fetch(server.url + "/missing", { headers: proxied })).status, 404);
      } finally {
        await server.close();
      }
    });

    await t.test("vercel ISR: prerender functions linked to the render function, path rewrite undone", async () => {
      await target({ name: "vercel", isr: { expiration: 60 } });
      const out = root + ".vercel/output/";
      const vc = await readJSON<{ routes: Record<string, unknown>[]; overrides?: unknown }>(out + "config.json");
      assert.deepEqual(vc.routes.slice(1), [
        { handle: "filesystem" },
        { src: "^\\/about/?$", dest: "/_isr/about?__rivet_path=%2Fabout" },
        { src: "^/.*$", dest: "/_render" },
      ]);
      assert.equal(vc.overrides, undefined);
      const prerender = await readJSON(out + "functions/_isr/about.prerender-config.json");
      only(prerender, VC_PRERENDER, "prerender-config");
      assert.deepEqual(prerender, { expiration: 60, allowQuery: ["__rivet_path", "_rivet"], passQuery: true });
      assert.ok((await lstat(out + "functions/_isr/about.func")).isSymbolicLink());
      assert.equal(await readlink(out + "functions/_isr/about.func"), "../_render.func");
      assert.ok(!(await files(out + "static/")).includes("about/index.html"), "ISR page: no static file");
      assert.equal(isrURL("/_isr/about?__rivet_path=%2Fabout&_rivet=data"), "/about?_rivet=data");
      assert.equal(isrURL("/_isr/about?__rivet_path=%2F%2Fevil"), "/_isr/about?__rivet_path=%2F%2Fevil");
      // The listener serves the rewritten request as the page.
      const listener = (await load<{ default: (req: IncomingMessage, res: ServerResponse) => void }>(out + "functions/_render.func/", "vercel.js")).default;
      const server = await listen(listener);
      try {
        const page = await fetch(server.url + "/_isr/about?__rivet_path=%2Fabout", { headers: { host: "a.vercel.app", "x-forwarded-proto": "https" } });
        assert.equal(page.status, 200);
        assert.match(await page.text(), /About at build time/);
      } finally {
        await server.close();
      }
    });

    await t.test("vercel (Edge): edge function config, web-standard bundle", async () => {
      await target({ name: "vercel", runtime: "edge", regions: ["iad1"] });
      const fn = root + ".vercel/output/functions/_render.func/";
      const vcConfig = await readJSON(fn + ".vc-config.json");
      only(vcConfig, VC_EDGE, "edge .vc-config.json");
      assert.deepEqual(vcConfig, { runtime: "edge", entrypoint: "vercel.js", regions: ["iad1"] });
      assert.deepEqual([...(await imports(fn))], ["node:async_hooks"], "Edge Runtime: only node:async_hooks (supported)");
      const handler = (await load<{ default: (r: Request, c?: unknown) => Promise<Response> }>(fn, "vercel.js")).default;
      const page = await handler(new Request("https://rivet-app.vercel.app/", { headers: { "x-real-ip": "203.0.113.7" } }), { waitUntil() {} });
      assert.equal(page.status, 200);
      assert.match(await page.text(), /<p id="platform">address<\/p>/);
    });

    await t.test("netlify (Functions v2): publish dir, function config, headers, handler", async () => {
      await target("netlify");
      const publish = await files(dist + "netlify/");
      assert.ok(publish.includes("robots.txt") && publish.includes("about/index.html"), publish.join());
      assert.ok(!publish.some((file) => file.startsWith(".vite")));
      const v1 = root + ".netlify/v1/";
      const nf = await readJSON(v1 + "config.json");
      only(nf, NF_CONFIG, "config.json");
      assert.deepEqual(nf, { headers: [{ for: "/assets/*", values: { "cache-control": IMMUTABLE } }] });
      const dir = v1 + "functions/rivet-server/";
      const fn = await load<{ default: (r: Request, c?: unknown) => Promise<Response>; config: Record<string, unknown> }>(dir, "rivet-server.mjs");
      only(fn.config, NF_FUNCTION, "function config");
      assert.deepEqual(fn.config, {
        path: "/*",
        preferStatic: true,
        name: "Rivet",
        generator: "@rivetjs/router",
        nodeBundler: "none",
        includedFiles: [".netlify/v1/functions/rivet-server/**"],
      });
      // The in-source config must be a static literal (Netlify parses it without running the module).
      assert.match(await readFile(dir + "rivet-server.mjs", "utf8"), /^export const config = \{"path":"\/\*"/m);
      assert.deepEqual(await readJSON(dir + "package.json"), { type: "module" });
      for (const spec of await imports(dir)) assert.match(spec, /^node:/, spec);
      const page = await fn.default(new Request("https://rivet-app.netlify.app/"), { ip: "203.0.113.7", waitUntil() {} });
      assert.equal(page.status, 200);
      assert.ok(nonceOf(page));
      assert.match(await page.text(), /<p id="platform">address<\/p>/);
      const post = await fn.default(
        new Request("https://rivet-app.netlify.app/counter?/inc", {
          method: "POST",
          headers: { origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" },
          body: "",
        }),
      );
      assert.equal(post.status, 403);
    });

    await t.test("netlify (Edge): edge function config, static paths handed on", async () => {
      await target({ name: "netlify", edge: true });
      const v1 = root + ".netlify/v1/";
      assert.deepEqual(await files(v1 + "functions/"), [], "previous function removed");
      const dir = v1 + "edge-functions/rivet-server/";
      const source = await readFile(dir + "rivet-server.js", "utf8");
      const fn = await load<{ default: (r: Request, c?: unknown) => Promise<Response> | undefined; config: Record<string, unknown> }>(dir, "rivet-server.js");
      only(fn.config, NF_EDGE, "edge config");
      assert.deepEqual(fn.config, { path: "/*", excludedPath: ["/assets/*"], name: "Rivet", generator: "@rivetjs/router" });
      assert.match(source, /^export const config = \{"path":"\/\*"/m);
      assert.deepEqual([...(await imports(dir))], ["node:async_hooks"]);
      for (const path of ["/robots.txt", "/about", "/about/"]) assert.equal(fn.default(new Request("https://x.netlify.app" + path)), undefined, path);
      const page = await fn.default(new Request("https://x.netlify.app/"), {});
      assert.equal(page?.status, 200);
      assert.equal((await fn.default(new Request("https://x.netlify.app/about", { method: "POST", body: "" }), {}))?.status, 403, "POST still reaches the app");
    });

    await t.test("cloudflare: wrangler.json (+ project wrangler.jsonc merged), redirect, assets, _headers, worker", async () => {
      await writeFile(
        root + "wrangler.jsonc",
        '// project config\n{\n  "name": "my-shop", /* bindings */\n  "kv_namespaces": [{ "binding": "KV", "id": "abc" }],\n  "main": "src/ignored.ts",\n}\n',
      );
      try {
        await target("cloudflare");
      } finally {
        await rm(root + "wrangler.jsonc");
      }
      const out = dist + "cloudflare/";
      const wrangler = await readJSON(out + "wrangler.json");
      assert.deepEqual(wrangler, {
        name: "my-shop",
        compatibility_date: "2026-10-01",
        compatibility_flags: ["nodejs_als", "no_nodejs_compat", "no_nodejs_compat_v2"],
        kv_namespaces: [{ binding: "KV", id: "abc" }],
        main: "../server/worker.js",
        base_dir: "../server",
        no_bundle: true,
        find_additional_modules: true,
        rules: [{ type: "ESModule", globs: ["**/*.js"] }],
        assets: { directory: "./static", html_handling: "drop-trailing-slash" },
      });
      assert.deepEqual(await readJSON(root + ".wrangler/deploy/config.json"), { configPath: "../../dist/cloudflare/wrangler.json" });
      assert.equal(await readFile(out + "static/_headers", "utf8"), `/assets/*\n  Cache-Control: ${IMMUTABLE}\n`);
      const statics = await files(out + "static/");
      assert.ok(statics.includes("about/index.html") && statics.includes("robots.txt"));
      assert.deepEqual([...(await imports(dist + "server/"))], ["node:async_hooks"], "Workers: nodejs_als covers it");
      const worker = (await load<{ default: { fetch(r: Request, env?: unknown, ctx?: unknown): Promise<Response> } }>(dist + "server/", "worker.js")).default;
      const page = await worker.fetch(
        new Request("https://my-shop.workers.dev/", { headers: { "cf-connecting-ip": "203.0.113.7" } }),
        { KV: {} },
        { waitUntil() {} },
      );
      assert.equal(page.status, 200);
      assert.match(await page.text(), /<p id="platform">env<\/p>/);
      assert.equal(stripJSONC('{"a": "x // y", /* c */ "b": [1,],}'), '{"a": "x // y",  "b": [1]}');
    });

    await t.test("base path: platform static files under the base, routes and headers follow", async () => {
      await target("vercel", { base: "/app" }, true);
      const vc = await readJSON<{ routes: Record<string, unknown>[]; overrides: unknown }>(root + ".vercel/output/config.json");
      assert.equal(vc.routes[0]!.src, "^\\/app\\/assets\\/.+$");
      assert.deepEqual(vc.overrides, { "app/about/index.html": { path: "app/about" } });
      const statics = await files(root + ".vercel/output/static/");
      assert.ok(statics.includes("app/robots.txt") && statics.some((file) => file.startsWith("app/assets/")), statics.join());
      await target("cloudflare", { base: "/app" });
      assert.equal(await readFile(dist + "cloudflare/static/_headers", "utf8"), `/app/assets/*\n  Cache-Control: ${IMMUTABLE}\n`);
      assert.ok((await files(dist + "cloudflare/static/")).includes("app/about/index.html"));
    });

    await t.test("static mode: files only, 404 page, no function", async () => {
      await target("vercel", { mode: "static" }, true);
      const out = root + ".vercel/output/";
      assert.deepEqual(await files(out + "functions/"), []);
      const vc = await readJSON<{ routes: Record<string, unknown>[] }>(out + "config.json");
      assert.deepEqual(vc.routes.slice(1), [{ handle: "filesystem" }, { handle: "error" }, { status: 404, src: "^/.*$", dest: "/404.html" }]);
      const statics = await files(out + "static/");
      for (const page of ["index.html", "about/index.html", "counter/index.html", "404.html", "_data.json"]) assert.ok(statics.includes(page), page);
      await target("cloudflare", { mode: "static" });
      const wrangler = await readJSON(dist + "cloudflare/wrangler.json");
      assert.equal(wrangler.main, undefined);
      assert.deepEqual(wrangler.assets, { directory: "./static", html_handling: "drop-trailing-slash", not_found_handling: "404-page" });
    });

    await t.test("bun: bun.js serves client files (immutable assets, ETag/304) and the app", { skip: !has("bun") && "bun not installed" }, async () => {
      await target("bun", {}, true);
      const port = await freePort();
      const child = spawn("bun", [dist + "server/bun.js"], {
        env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", NO_COLOR: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      try {
        await until(
          () => output.includes("Listening on"),
          () => output,
        );
        const url = `http://127.0.0.1:${port}`;
        const page = await fetch(url + "/");
        assert.equal(page.status, 200);
        assert.ok(nonceOf(page));
        const html = await page.text();
        assert.match(html, /<p id="platform">address<\/p>/, "Bun requestIP → clientAddress");
        const css = /href="(\/assets\/styles-[^"]+\.css)"/.exec(html)![1]!;
        const asset = await fetch(url + css);
        assert.equal(asset.status, 200);
        assert.equal(asset.headers.get("cache-control"), IMMUTABLE);
        assert.match(asset.headers.get("content-type")!, /^text\/css/);
        const robots = await fetch(url + "/robots.txt");
        assert.equal(robots.headers.get("cache-control"), "no-cache");
        assert.equal(await robots.text(), "User-agent: *\n");
        assert.equal((await fetch(url + "/robots.txt", { headers: { "if-none-match": robots.headers.get("etag")! } })).status, 304);
        assert.equal((await fetch(url + "/.vite/manifest.json")).status, 404);
        const post = await fetch(url + "/counter?/inc", {
          method: "POST",
          headers: { origin: url, accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
          body: "",
        });
        assert.equal(post.status, 200);
      } finally {
        child.kill("SIGTERM");
      }
    });

    await t.test("deno: deno.js exports start and listens only when run directly", async () => {
      await target("deno");
      const source = await readFile(dist + "server/deno.js", "utf8");
      assert.match(source, /if \(import\.meta\.main\) start\(\);/);
      assert.deepEqual([...(await imports(dist + "server/"))].sort(), ["node:async_hooks", "node:fs", "node:path", "node:url"]);
      const module = await load<{ start(options?: object): unknown }>(dist + "server/", "deno.js");
      assert.throws(() => module.start(), /runs under Deno/);
    });
  }),
);

function has(command: string): boolean {
  try {
    execFileSync(command, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
async function until(ready: () => boolean, detail: () => string, ms = 10_000): Promise<void> {
  const end = Date.now() + ms;
  while (!ready()) {
    if (Date.now() > end) throw new Error("timed out: " + detail());
    await new Promise((done) => setTimeout(done, 50));
  }
}
