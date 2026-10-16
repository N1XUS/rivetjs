// Build side of the deploy targets (`rivetRouter({ adapter })`): the server build gets a second
// entry, a generated module that imports the server entry, inlines the client build's manifests
// (read here, at build time, so the bundle needs no file system at run time) and hands both to the
// target's runtime module (`fetch.ts`, `vercel.ts`, `netlify.ts`, …). Platform targets then package
// the build into the layout their platform deploys (`pack.ts`, after the server bundle is written).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, UserConfig } from "vite";
import { readManifests } from "./build.ts";
import type { FetchOptions } from "./fetch.ts";
import type { CSPOptions } from "../shared/csp.ts";
import { normalizeBase } from "../shared/base.ts";

/** Options every target shares: build-time defaults serialized into the generated entry. */
interface TargetOptions extends Pick<FetchOptions, "origin" | "maxBody" | "stream" | "headers"> {
  /** Build-time CSP (serialized into the entry): `false` or `{ trustedTypes, directives }`; a policy function goes to `create({ csp })`. */
  readonly csp?: false | CSPOptions;
  /** i18n: per-locale client builds (`client/<locale>/`, see `loadBuild`). */
  readonly locales?: readonly string[];
}
/** `"fetch"`: `dist/server/fetch.js` (`export default { fetch }`) for any web-standard runtime. */
export interface FetchAdapterOptions extends TargetOptions {
  readonly name: "fetch";
}
/**
 * Vercel, Build Output API v3 (https://vercel.com/docs/build-output-api/v3): `.vercel/output/`
 * with `config.json`, `static/` (client files + prerendered pages) and one function.
 */
export interface VercelAdapterOptions extends TargetOptions {
  readonly name: "vercel";
  /**
   * `"nodejs"` (default; Vercel's recommendation): a Node.js function running the node adapter's
   * listener (direct page bodies, no web-stream reads). `"edge"`: an Edge Runtime function (fetch adapter).
   */
  readonly runtime?: "nodejs" | "edge";
  /** Node.js major for `runtime: "nodejs"` (`.vc-config.json` `runtime: "nodejs<major>.x"`); default 24. */
  readonly nodeVersion?: 20 | 22 | 24;
  /** Function regions (`.vc-config.json` `regions`). */
  readonly regions?: readonly string[];
  /** Node.js function limits (`.vc-config.json` `maxDuration` seconds, `memory` MB). */
  readonly maxDuration?: number;
  readonly memory?: number;
  /**
   * Incremental Static Regeneration for routes that `export const prerender = true` (Node.js runtime
   * only): instead of build-time files, prerender functions cached by Vercel's CDN and regenerated
   * after `expiration` seconds (`false`: never). Cached pages share one CSP nonce: see the deploy guide.
   */
  readonly isr?: { readonly expiration: number | false };
  /** Brotli/gzip in the Node.js function (default true; see `@rivetjs/router/vercel`). */
  readonly compress?: boolean;
}
/**
 * Netlify, Frameworks API (https://docs.netlify.com/build/frameworks/frameworks-api/): a
 * Functions v2 function (or an Edge Function) in `.netlify/v1/`, `config.json` headers, and the
 * publish directory `dist/netlify` (client files + prerendered pages).
 */
export interface NetlifyAdapterOptions extends TargetOptions {
  readonly name: "netlify";
  /** Render in an Edge Function (Deno, at the edge) instead of a Node.js function. */
  readonly edge?: boolean;
}
/**
 * Cloudflare Workers with static assets (https://developers.cloudflare.com/workers/static-assets/):
 * `dist/cloudflare/wrangler.json` (+ `.wrangler/deploy/config.json` pointing Wrangler at it) and the
 * assets directory `dist/cloudflare/static`.
 */
export interface CloudflareAdapterOptions extends TargetOptions {
  readonly name: "cloudflare";
  /**
   * Extra Wrangler configuration merged into the generated `wrangler.json` (bindings, `routes`,
   * `vars`, …). A `wrangler.json` / `wrangler.jsonc` in the project root is merged first.
   */
  readonly wrangler?: Readonly<Record<string, unknown>>;
}
/** Bun: `bun dist/server/bun.js` serves `dist/client` and the app with `Bun.serve`. */
export interface BunAdapterOptions extends TargetOptions {
  readonly name: "bun";
}
/** Deno: `deno run -A dist/server/deno.js` serves `dist/client` and the app with `Deno.serve`. */
export interface DenoAdapterOptions extends TargetOptions {
  readonly name: "deno";
}
export type AdapterOptions =
  FetchAdapterOptions | VercelAdapterOptions | NetlifyAdapterOptions | CloudflareAdapterOptions | BunAdapterOptions | DenoAdapterOptions;
export type AdapterName = AdapterOptions["name"];

/** Generated entry file name (`dist/server/<file>.js`) per target. */
export const ENTRY_FILE: Readonly<Record<AdapterName, string>> = {
  fetch: "fetch",
  vercel: "vercel",
  netlify: "netlify",
  cloudflare: "worker",
  bun: "bun",
  deno: "deno",
};
/** Options that only shape the build output (never serialized into the entry). */
const BUILD_ONLY = new Set(["name", "locales", "runtime", "nodeVersion", "regions", "maxDuration", "memory", "edge", "wrangler"]);

const TARGET = "\0rivet-target-entry";
// Paths in this form (`new URL("./x.ts", import.meta.url)`) are rewritten to `.js` by the package build.
const runtimes = {
  fetch: fileURLToPath(new URL("./fetch.ts", import.meta.url)),
  vercel: fileURLToPath(new URL("./vercel.ts", import.meta.url)),
  vercelEdge: fileURLToPath(new URL("./vercel-edge.ts", import.meta.url)),
  netlify: fileURLToPath(new URL("./netlify.ts", import.meta.url)),
  cloudflare: fileURLToPath(new URL("./cloudflare.ts", import.meta.url)),
  bun: fileURLToPath(new URL("./bun.ts", import.meta.url)),
  deno: fileURLToPath(new URL("./deno.ts", import.meta.url)),
};

/** `rivetRouter({ adapter })` value → options (a bare name = defaults). */
export function adapterOptions(adapter: AdapterName | AdapterOptions | undefined): AdapterOptions | undefined {
  if (adapter === undefined) return undefined;
  const options = typeof adapter === "string" ? ({ name: adapter } as AdapterOptions) : adapter;
  if (!(options.name in ENTRY_FILE)) throw new Error(`rivetRouter: unknown adapter "${String(options.name)}" (${Object.keys(ENTRY_FILE).join(", ")})`);
  if (options.name === "vercel" && options.isr && options.runtime === "edge") throw new Error('rivetRouter: adapter "vercel": isr needs runtime "nodejs"');
  return options;
}

/** SSR build config: both `entry.server` and the target's entry; dependencies bundled (functions and edge runtimes get no node_modules). */
export function targetBuildConfig(options: AdapterOptions, entry: string, outDir: string): UserConfig {
  return {
    ssr: { noExternal: true },
    build: { ssr: true, outDir, copyPublicDir: false, rollupOptions: { input: { "entry.server": entry, [ENTRY_FILE[options.name]]: TARGET } } },
  };
}

/** Runtime module and the generated entry's tail per target. */
function runtimeOf(options: AdapterOptions): { path: string; name: string; tail: string[] } {
  const created = ["export const create = (options = {}) => createTarget(entry, build, { ...defaults, ...options });", "export default create();"];
  switch (options.name) {
    case "fetch":
      return { path: runtimes.fetch, name: "createFetch", tail: created };
    case "vercel":
      return { path: options.runtime === "edge" ? runtimes.vercelEdge : runtimes.vercel, name: "create", tail: created };
    case "netlify":
      return { path: runtimes.netlify, name: "create", tail: created };
    case "cloudflare":
      return { path: runtimes.cloudflare, name: "create", tail: created };
    case "bun":
    case "deno":
      // Runs when started directly (`bun dist/server/bun.js`); importing it (a custom server) does not listen.
      return {
        path: runtimes[options.name],
        name: "start",
        tail: [
          'const client = "../client/";',
          "export const start = (options = {}) => createTarget(entry, build, { client: new URL(client, import.meta.url), ...defaults, ...options });",
          "if (import.meta.main) start();",
        ],
      };
  }
}

/** Build facts the plugin needs from the router plugin. */
export interface TargetContext {
  /** Generated `entry.server.tsx`. */
  serverEntry(): string;
  /** Router `mode` (`server` / `static`). */
  mode(): "server" | "static" | "csr";
}

/** Plugin generating the target entry and, for platform targets, packaging the build after it is written. */
export function targetEntryPlugin(options: AdapterOptions, context: TargetContext): Plugin {
  let root = "";
  let outDir = "";
  let base = "";
  return {
    name: "vite-plugin-rivet-target",
    applyToEnvironment: (environment) => environment.config.consumer === "server",
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
      base = normalizeBase(config.base);
    },
    resolveId: (id) => (id === TARGET ? id : null),
    async load(id) {
      if (id !== TARGET) return null;
      const { locales } = options;
      const defaults = Object.fromEntries(Object.entries(options).filter(([key]) => !BUILD_ONLY.has(key)));
      const manifests = await readManifests(resolve(outDir, ".."), { ...(locales?.length ? { locales } : {}), base }).catch((error: unknown) => {
        throw new Error(`rivetRouter({ adapter: "${options.name}" }): build the client first (vite build, then vite build --ssr): ${(error as Error).message}`);
      });
      const json = (value: unknown) => `JSON.parse(${JSON.stringify(JSON.stringify(value))})`;
      const runtime = runtimeOf(options);
      return [
        `import * as entry from ${JSON.stringify(context.serverEntry())};`,
        `import { ${runtime.name} as createTarget } from ${JSON.stringify(runtime.path)};`,
        `const build = ${json(manifests)};`,
        `const defaults = ${JSON.stringify(defaults)};`,
        "/** Runtime options (`onError`, `address`, `csp` function, …) over the build-time defaults. */",
        ...runtime.tail,
        "",
      ].join("\n");
    },
    async closeBundle() {
      // `vite build --ssr` only (the client build has no target entry), platform targets only.
      if (this.environment?.config.consumer !== "server" || !["vercel", "netlify", "cloudflare"].includes(options.name)) return;
      const { pack } = await import("./pack.ts");
      await pack(options, { root, dist: resolve(outDir, ".."), server: outDir, base, mode: context.mode() === "static" ? "static" : "server" });
    },
  };
}
