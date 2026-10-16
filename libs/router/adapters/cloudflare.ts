// Cloudflare Workers runtime (`rivetRouter({ adapter: "cloudflare" })`): the Worker's
// `export default { fetch(request, env, ctx) }` (https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/),
// the fetch adapter underneath. Static assets (`assets.directory`) are served by Cloudflare before the
// Worker runs (https://developers.cloudflare.com/workers/static-assets/routing/). Bindings (`env`)
// and `ctx` (`waitUntil`) reach loaders as `event.platform.env` / `event.platform.ctx`. The one node import (`node:async_hooks`,
// resume state) needs `nodejs_als` (or `nodejs_compat`); the generated `wrangler.json` sets `nodejs_als`
// and turns the default-on `nodejs_compat` off (see `pack.ts` `WORKER_FLAGS`).
import type { GeneratedEntry } from "../server/app.ts";
import type { BuildManifests } from "./assemble.ts";
import { createFetch, type FetchModule, type FetchOptions } from "./fetch.ts";

export type CloudflareOptions = FetchOptions;

export function create(entry: GeneratedEntry, build: BuildManifests, options: CloudflareOptions = {}): FetchModule {
  return createFetch(entry, build, {
    // Cloudflare sets it to the connecting client's address (clients cannot override it).
    address: (request) => request.headers.get("cf-connecting-ip") ?? undefined,
    ...options,
  });
}
