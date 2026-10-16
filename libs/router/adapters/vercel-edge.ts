// Vercel Edge Runtime function (`rivetRouter({ adapter: { name: "vercel", runtime: "edge" } })`,
// https://vercel.com/docs/build-output-api/v3/primitives#functions-with-edge-runtime): the
// entrypoint's default export is `(request, context) => Response`, the fetch adapter underneath.
// Web-standard only (Edge Runtime supports `node:async_hooks`, the resume state's one node import:
// https://vercel.com/docs/functions/runtimes/edge#compatible-node.js-modules).
import type { GeneratedEntry } from "../server/app.ts";
import type { BuildManifests } from "./assemble.ts";
import { createFetch, type FetchOptions } from "./fetch.ts";

export type VercelEdgeOptions = Omit<FetchOptions, "serveAssets">;
/** Edge function handler: `context` (`waitUntil`) reaches loaders as `event.platform.ctx`. */
export type VercelEdgeHandler = (request: Request, context?: unknown) => Promise<Response>;

export function create(entry: GeneratedEntry, build: BuildManifests, options: VercelEdgeOptions = {}): VercelEdgeHandler {
  const app = createFetch(entry, build, {
    // Vercel sets `X-Real-IP` / `X-Forwarded-For` to the client address (not client-controlled).
    address: (request) => request.headers.get("x-real-ip") ?? undefined,
    ...options,
  });
  return (request, context) => app.fetch(request, undefined, context);
}
