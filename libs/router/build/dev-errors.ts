// Dev server error surfaces (`vite serve` only; never part of a build): server failures reach Vite's
// error overlay and a dev error page with the source-mapped stack, unmatched URLs list the route
// table, and browser errors the dev entry forwards (`rivet:client-error`) open the overlay too.
import { AsyncLocalStorage } from "node:async_hooks";
import { join } from "node:path";
import type { ViteDevServer } from "vite";
import { compileRoutes } from "@rivetjs/runtime/router/server";
import { escapeAttribute, escapeText } from "@rivetjs/runtime/escape";
import { escapeJSON } from "@rivetjs/runtime/resume-format";
import type { RouteTable } from "./routes.ts";
import type { AppHandler, ErrorInfo } from "../server/handler.ts";

/** One failure reported during a request (`onError`), with where it happened. */
interface Failure {
  readonly message: string;
  readonly stack: string;
  readonly phase: string;
  readonly route: string | undefined;
  readonly id: string | undefined;
}
const failures = new AsyncLocalStorage<Failure[]>();

/** JSON for an inline `<script>` (no `</script>` / `<!--`, no raw U+2028/U+2029), as resume state. */
const scriptJSON = (value: unknown): string => escapeJSON(JSON.stringify(value));
const overlayOn = (server: ViteDevServer): boolean => {
  const hmr = server.config.server.hmr;
  return !(hmr === false || (typeof hmr === "object" && hmr.overlay === false));
};
/** Diagnostic code (`RV1001`…) of an error that carries one, as an overlay message prefix. */
const codeOf = (error: unknown): string => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^RV\d{4}$/.test(code) ? `[${code}] ` : "";
};

/**
 * Dev `onError`: source-map the stack, log it, send it to Vite's overlay (open pages, e.g. during
 * client navigation) and remember it for the request's dev error page.
 */
export function devReport(server: ViteDevServer, table: () => RouteTable, routesPath: string) {
  return (error: unknown, _request: Request, info?: ErrorInfo): void => {
    if (error instanceof Error) server.ssrFixStacktrace(error);
    // Without info: a render failure reported by a custom renderer (app renders report `phase: "render"`).
    const phase = info?.phase ?? "render";
    const route = info?.route;
    const file = route === undefined ? undefined : table().routes.find((entry) => entry.id === route)?.page;
    const text = error instanceof Error ? error.message : String(error);
    const id = file ? join(routesPath, file) : undefined;
    const message = codeOf(error) + text;
    const stack = error instanceof Error ? (error.stack ?? "") : "";
    server.config.logger.error(`[rivet] ${phase} failed${route === undefined ? "" : ` (route "${route}")`}: ${stack || message}`);
    const failure: Failure = { message, stack, phase, route, id };
    failures.getStore()?.push(failure);
    if (overlayOn(server)) server.ws.send({ type: "error", err: overlayError(failure) });
  };
}

const overlayError = (failure: Failure) => ({
  message: `${failure.phase} failed${failure.route === undefined ? "" : ` in route "${failure.route}"`}: ${failure.message}`,
  stack: failure.stack,
  plugin: "rivet",
  ...(failure.id ? { id: failure.id } : {}),
});

/** Browser errors forwarded by the dev entry (`import.meta.hot.send("rivet:client-error")`) open that page's overlay. */
export function listenClientErrors(server: ViteDevServer): void {
  server.ws.on("rivet:client-error", (data: { message?: unknown; stack?: unknown } | undefined, client) => {
    const message = String(data?.message ?? "Unknown error");
    // Benign ResizeObserver loop notice (older dev clients still forward it): no overlay, no error log.
    if (/^ResizeObserver loop (completed with undelivered notifications|limit exceeded)/.test(message)) return;
    const stack = typeof data?.stack === "string" ? data.stack : "";
    server.config.logger.error(`[rivet] browser error: ${stack || message}`);
    if (overlayOn(server)) client.send({ type: "error", err: { message: "Browser error: " + message, stack, plugin: "rivet" } });
  });
}

let matcher: { table: RouteTable; match: (url: URL) => unknown } | undefined;
const matches = (table: RouteTable, url: URL): boolean => {
  if (matcher?.table !== table) matcher = { table, match: compileRoutes(table.routes.map((route) => ({ path: route.pattern, render: () => route }))) };
  return matcher.match(url) != null;
};
/** The `_404` an unmatched URL renders (longest folder prefix, else the root one). */
const notFoundFor = (table: RouteTable, path: string): string | undefined =>
  table.notFounds?.find(({ prefix }) => path === prefix || path.startsWith(prefix + "/"))?.page ?? table.notFound;

/** Route patterns, once each, in table order: `[pattern, endpoint-only]`. */
const patterns = (table: RouteTable): [string, boolean][] => {
  const seen = new Map<string, boolean>();
  for (const route of table.routes) if (!seen.has(route.pattern)) seen.set(route.pattern, !route.page);
  return [...seen];
};

const nonceOf = (response: Response): string | undefined => /'nonce-([^']+)'/.exec(response.headers.get("content-security-policy") ?? "")?.[1];
const nonceAttr = (nonce: string | undefined) => (nonce === undefined ? "" : ` nonce="${escapeAttribute(nonce)}"`);
const html = (response: Response, body: string): Response => {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(body, { status: response.status, headers });
};
/** Insert markup before the document's last `</body>` (else append). */
const inject = (page: string, markup: string): string => {
  const at = page.lastIndexOf("</body>");
  return at < 0 ? page + markup : page.slice(0, at) + markup + page.slice(at);
};
/** Inline module script opening Vite's overlay on this page (the request's ws message reached only pages already open). */
const overlayScript = (server: ViteDevServer, failure: Failure, nonce: string | undefined): string => overlayOf(server, overlayError(failure), nonce);
const overlayOf = (server: ViteDevServer, error: { message: string; stack: string; plugin: string }, nonce: string | undefined): string =>
  `<script type="module"${nonceAttr(nonce)}>import { ErrorOverlay } from ${scriptJSON(server.config.base + "@vite/client")};` +
  `document.body.appendChild(new ErrorOverlay(${scriptJSON(error)}));</script>`;

const STYLE =
  "body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#fff;color:#1b1b1f}main{max-width:72rem;margin:0 auto;padding:2rem 1rem}" +
  "h1{font-size:1.4rem;margin:0 0 .5rem}code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}pre{overflow:auto;padding:1rem;border-radius:6px;background:#f4f4f6;white-space:pre-wrap}" +
  ".message{color:#b00020;font-weight:600}ul{padding-left:1.2rem}li{margin:.15rem 0}small{color:#6b6b76}" +
  "@media (prefers-color-scheme:dark){body{background:#151518;color:#e8e8ec}pre{background:#222228}.message{color:#ff8a8a}small{color:#9a9aa6}a{color:#8ab4ff}}";
const devPage = (title: string, body: string, scripts: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<title>${escapeText(title)}</title><style>${STYLE}</style></head><body><main>${body}</main>${scripts}</body></html>`;

/** Vite's client (HMR, overlay) plus a reload when server code changes (`rivet:data`) or the route table does. */
const devClient = (server: ViteDevServer, nonce: string | undefined): string =>
  `<script type="module"${nonceAttr(nonce)}>import { createHotContext } from ${scriptJSON(server.config.base + "@vite/client")};` +
  `createHotContext("/@rivet/dev-page").on("rivet:data", () => location.reload());</script>`;

/** Route list markup: static patterns link to their page. */
const routeList = (server: ViteDevServer, table: RouteTable): string => {
  const items = patterns(table).map(([pattern, endpoint]) => {
    const label = `<code>${escapeText(pattern)}</code>`;
    const link = !endpoint && !/[:*]/.test(pattern) ? `<a href="${escapeAttribute(server.config.base + pattern.slice(1))}">${label}</a>` : label;
    return `<li>${link}${endpoint ? " <small>endpoint</small>" : ""}</li>`;
  });
  return items.length ? `<ul id="rivet-dev-routes">${items.join("")}</ul>` : "<p>No routes yet: add a page under the routes directory.</p>";
};
/** HTML comment (`--` cannot appear inside one). */
const comment = (text: string): string => `<!-- ${text.replace(/--/g, "- -")} -->`;

/**
 * Wrap the dev app handler: a reported 5xx page gets the dev error page (no `_error` view) or the
 * overlay over the app's `_error` view; an unmatched URL without a `_404` lists the routes. `reach`: the page's server
 * reach reports (RV3011, `build/reach.ts`): an error opens the overlay over the rendered page.
 */
export function devHandler(
  handler: AppHandler,
  server: ViteDevServer,
  table: () => RouteTable,
  reach?: (url: URL) => Promise<readonly { readonly severity: "error" | "warning"; readonly message: string }[]>,
): AppHandler {
  return async (request, context) => {
    // A page document (not a data request): its route's server reach errors first (the walk may regenerate the App).
    const url = new URL(request.url);
    const reachErrors =
      reach && request.method === "GET" && !url.searchParams.has("_rivet") && (request.headers.get("accept") ?? "text/html").includes("text/html")
        ? (await reach(url)).filter((problem) => problem.severity === "error")
        : [];
    const seen: Failure[] = [];
    const response = await failures.run(seen, () => handler(request, context));
    if (!(response.headers.get("content-type") ?? "").startsWith("text/html")) return response;
    const nonce = nonceOf(response);
    const routes = table();
    const failure = seen[0];
    if (failure && response.status >= 500) {
      const own = failure.route === undefined ? undefined : routes.routes.find((entry) => entry.id === failure.route);
      const overlay = overlayOn(server) ? overlayScript(server, failure, nonce) : "";
      const where = comment(`rivet dev: ${failure.phase} failed${failure.route === undefined ? "" : ` in route "${failure.route}"`}: ${failure.message}`);
      // The app's `_error` view renders as in production; the overlay shows the details over it.
      if (own?.error ?? routes.error) return html(response, inject(await response.text(), where + overlay));
      const body =
        `<h1>Server error</h1><p id="rivet-dev-where">${failure.route === undefined ? "" : `Route <code>${escapeText(failure.route)}</code>, `}phase <code>${escapeText(failure.phase)}</code></p>` +
        `<pre class="message">${escapeText(failure.message)}</pre>${failure.stack ? `<pre class="stack">${escapeText(failure.stack)}</pre>` : ""}` +
        "<p><small>Development only: production answers with a generic message and a digest. Add an <code>_error</code> page to render your own.</small></p>";
      return html(response, devPage(`${response.status} · ${failure.message}`, body, devClient(server, nonce) + overlay));
    }
    if (response.status === 404 && request.method === "GET" && !matches(routes, new URL(request.url))) {
      const path = new URL(request.url).pathname;
      const list = patterns(routes)
        .map(([pattern]) => pattern)
        .join(" ");
      if (notFoundFor(routes, path)) return html(response, inject(await response.text(), comment(`rivet dev: no route matches ${path}. Routes: ${list}`)));
      const body =
        `<h1>No route matches <code>${escapeText(path)}</code></h1><p>Routes:</p>${routeList(server, routes)}` +
        "<p><small>Development only: add a <code>_404</code> page to render your own.</small></p>";
      return html(response, devPage("404 · " + path, body, devClient(server, nonce)));
    }
    if (reachErrors.length && response.status < 400 && overlayOn(server)) {
      const error = { message: reachErrors.map((problem) => problem.message).join("\n\n"), stack: "", plugin: "vite-plugin-rivet-router" };
      return html(response, inject(await response.text(), comment(error.message) + overlayOf(server, error, nonce)));
    }
    return response.body ? lateFailures(response, seen, server, nonce) : response;
  };
}

/**
 * A render that fails after the response started (status sent; e.g. the resume state, encoded at the
 * end of the shell) ends the document early (failure marker, or an errored body): the page then ends
 * with the hint comment and opens the overlay itself (the ws message only reaches pages already
 * open), and reloads on the next update.
 */
function lateFailures(response: Response, seen: Failure[], server: ViteDevServer, nonce: string | undefined): Response {
  const reader = response.body!.getReader();
  const encoder = new TextEncoder();
  const before = seen.length;
  const hint = (failure: Failure): Uint8Array => {
    const where = comment(`rivet dev: ${failure.phase} failed${failure.route === undefined ? "" : ` in route "${failure.route}"`}: ${failure.message}`);
    const reload =
      `<script type="module"${nonceAttr(nonce)}>import { createHotContext } from ${scriptJSON(server.config.base + "@vite/client")};` +
      `const hot = createHotContext("/@rivet/dev-page");hot.on("rivet:data", () => location.reload());hot.on("vite:beforeUpdate", () => location.reload());</script>`;
    return encoder.encode(where + (overlayOn(server) ? overlayScript(server, failure, nonce) : "") + reload);
  };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (error) {
        const failure = seen[0];
        if (!failure) return controller.error(error);
        controller.enqueue(hint(failure));
        return controller.close();
      }
      if (!chunk.done) return controller.enqueue(chunk.value);
      // A failure reported while the body streamed (the document closed with its failure marker).
      if (seen.length > before) controller.enqueue(hint(seen[before]!));
      controller.close();
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}
