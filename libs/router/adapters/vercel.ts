// Vercel Node.js function runtime (`rivetRouter({ adapter: "vercel" })`, Build Output API v3:
// https://vercel.com/docs/build-output-api/v3/primitives#serverless-functions). The function's
// default export is a Node request listener (`launcherType: "Nodejs"`, `shouldAddHelpers: false`,
// `supportsResponseStreaming: true`), so pages go out through the node adapter's listener: direct
// page bodies from the renderer's slabs, no web-stream reads. Static files are Vercel's
// (`.vercel/output/static`, served before the function).
import type { IncomingMessage, ServerResponse } from "node:http";
import type { GeneratedEntry } from "../server/app.ts";
import type { ErrorInfo } from "../server/handler.ts";
import type { BodyLimit } from "../server/security.ts";
import type { AppConfig } from "../server/app.ts";
import { assemble, type BuildManifests } from "./assemble.ts";
import { createListener, type CompressOptions } from "./node.ts";
import type { BaseHeaders } from "./base-headers.ts";

export interface VercelOptions {
  /** Fixed public origin; default: the request's `Host` + `X-Forwarded-Proto` (Vercel's proxy sets both). */
  origin?: string;
  maxBody?: BodyLimit;
  stream?: { deadline?: number };
  /** Extra headers on every response; defaults add nosniff + referrer policy (same name replaces, `null` removes). */
  headers?: BaseHeaders;
  onError?: (error: unknown, request?: Request, info?: ErrorInfo) => void;
  resolveLocale?: (request: Request) => string | undefined | Promise<string | undefined>;
  csp?: AppConfig["csp"];
  /** Preload planner (`createApp` `preload`): `background` byte budget of idle-time visible prefetch, `lean` (nothing before an interaction); per page when a function. */
  preload?: AppConfig["preload"];
  /**
   * zstd / brotli / gzip in the function (default true, as the node adapter; `{ zstd, precompress }` as there — the
   * function has no client files, so nothing is written). Vercel's CDN documents its
   * automatic compression by MIME allowlist (https://vercel.com/docs/compression), which does not list
   * `text/html`; an encoded response passes through as is.
   */
  compress?: boolean | CompressOptions;
  /** Set when the build has ISR pages: their prerender functions get the page path as `__rivet_path`. */
  isr?: unknown;
}

const ISR_PATH = "__rivet_path";

/** `/_isr/a?__rivet_path=%2Fa&x=1` → `/a?x=1` (the ISR route's rewrite, undone). */
export function isrURL(url: string): string {
  const at = url.indexOf("?");
  if (at < 0) return url;
  const query = new URLSearchParams(url.slice(at + 1));
  const path = query.get(ISR_PATH);
  if (path === null || !path.startsWith("/") || path.startsWith("//")) return url;
  query.delete(ISR_PATH);
  const rest = query.toString();
  return path + (rest ? "?" + rest : "");
}

/** The function's request listener over a server entry and its inlined client manifests. */
export function create(entry: GeneratedEntry, build: BuildManifests, options: VercelOptions = {}): (req: IncomingMessage, res: ServerResponse) => void {
  const handler = assemble(
    entry,
    build,
    {
      ...(options.stream ? { stream: options.stream } : {}),
      ...(options.onError ? { onError: options.onError } : {}),
      ...(options.maxBody !== undefined ? { maxBody: options.maxBody } : {}),
      ...(options.csp !== undefined ? { csp: options.csp } : {}),
      ...(options.preload ? { preload: options.preload } : {}),
      ...(options.resolveLocale ? { resolveLocale: options.resolveLocale } : {}),
    },
    "vercel entry",
  );
  const { listener } = createListener({
    handler,
    // Only Vercel's proxy reaches the function: its `X-Forwarded-Proto` / `-Host` / `-For` (one hop) are the client's.
    trustProxy: 1,
    // A function instance has no idle phase worth shrinking the heap for.
    idleMemory: false,
    ...(options.compress !== undefined ? { compress: options.compress } : {}),
    ...(options.origin ? { origin: options.origin } : {}),
    ...(options.headers ? { headers: options.headers } : {}),
    ...(options.onError ? { onError: options.onError } : {}),
  });
  if (!options.isr) return listener;
  return (req, res) => {
    if (req.url?.includes(ISR_PATH)) req.url = isrURL(req.url);
    listener(req, res);
  };
}
