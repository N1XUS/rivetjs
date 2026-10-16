// Netlify runtime (`rivetRouter({ adapter: "netlify" })`, Frameworks API:
// https://docs.netlify.com/build/frameworks/frameworks-api/): the default export of a Functions v2
// function or an Edge Function, `(request, context) => Response` (web-standard, the fetch adapter
// underneath; https://docs.netlify.com/build/functions/api/). `context` (`ip`, `geo`, `waitUntil`, …)
// reaches loaders as `event.platform.ctx`; environment variables: `process.env` (functions) or
// `Netlify.env.get()` (edge). Static files are Netlify's (publish dir `dist/netlify`).
import type { GeneratedEntry } from "../server/app.ts";
import type { BuildManifests } from "./assemble.ts";
import { createFetch, type FetchOptions } from "./fetch.ts";

export interface NetlifyOptions extends Omit<FetchOptions, "serveAssets"> {
  /**
   * Edge Functions run before static files: GET/HEAD requests for these URL paths return `undefined`,
   * which hands the request on to Netlify's static file (the packaged edge function lists the
   * publish directory's files). Functions v2 use `preferStatic` instead.
   */
  staticPaths?: readonly string[];
}
export type NetlifyHandler = (request: Request, context?: unknown) => Promise<Response> | undefined;

export function create(entry: GeneratedEntry, build: BuildManifests, options: NetlifyOptions = {}): NetlifyHandler {
  const { staticPaths, ...fetchOptions } = options;
  const app = createFetch(entry, build, {
    // Netlify's context carries the client address it saw.
    address: (_request, _env, context) => (context as { ip?: string } | undefined)?.ip,
    ...fetchOptions,
  });
  const files = staticPaths?.length ? new Set(staticPaths) : null;
  return (request, context) => {
    if (files && (request.method === "GET" || request.method === "HEAD") && files.has(new URL(request.url).pathname)) return undefined;
    return app.fetch(request, undefined, context);
  };
}
