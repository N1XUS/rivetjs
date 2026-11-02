// Electron (`rivetRouter({ adapter: "electron" })` → `dist/server/electron.js`): no port. The app answers its own
// `https://` origin in the main process through `session.protocol.handle("https", …)`
// (https://www.electronjs.org/docs/latest/api/protocol#protocolhandlescheme-handler); every other host goes to the
// network. A real `https` origin, not a custom scheme: the URL standard gives a custom scheme the opaque origin "null"
// and Chromium refuses it cookies. Client files first (`files.ts`, streamed), the rest through the fetch adapter.
// Electron is passed in (the session), never imported: this module has no dependency on it.
//
// Verified in Electron 45 (2026-11-02): a protocol handler gets no `Cookie` header and its `Set-Cookie` is ignored, so
// both go through `session.cookies`; `fetch` carries no `Origin` either: the `referrer` is the page URL on the app's own
// pages and empty from a `file:` page, so only a same-origin referrer counts as the app (a foreign POST stays rejected).
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import type { GeneratedEntry } from "../server/app.ts";
import type { BuildManifests } from "./assemble.ts";
import { baseHeaders } from "./base-headers.ts";
import { createFetch, type FetchOptions } from "./fetch.ts";
import { staticFiles } from "./files.ts";
import { immutableOf } from "./server-target.ts";

/** A cookie for Electron's `session.cookies.set`. */
export interface ElectronCookie {
  url: string;
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expirationDate?: number;
  sameSite?: "unspecified" | "no_restriction" | "lax" | "strict";
}
/** The part of an Electron `Session` the adapter uses. */
export interface ElectronSession {
  protocol: {
    handle(scheme: string, handler: (request: Request) => Response | Promise<Response>): void;
    unhandle(scheme: string): void;
  };
  cookies: {
    get(filter: { url: string }): Promise<{ name: string; value: string }[]>;
    set(details: ElectronCookie): Promise<void>;
    remove(url: string, name: string): Promise<void>;
  };
  fetch(request: Request, options: { bypassCustomProtocolHandlers: boolean }): Promise<Response>;
}

export interface ElectronOptions extends Omit<FetchOptions, "serveAssets" | "origin"> {
  /** The Electron session that answers the app: `session.defaultSession`, or `session.fromPartition(…)` for its own storage. */
  session: ElectronSession;
  /** The app's origin (default `https://rivet.invalid`; `.invalid` never reaches the network). */
  origin?: string;
  /** Client build directory (default: `../client/` next to the generated entry). */
  client?: string | URL;
}

export interface ElectronServing {
  /** The app's first page: give it to `BrowserWindow.loadURL`. */
  readonly url: string;
  /** The app's origin. */
  readonly origin: string;
  /** Stop answering: `https` goes back to the network. */
  close(): void;
}

const SAME_SITE: Readonly<Record<string, ElectronCookie["sameSite"]>> = { lax: "lax", strict: "strict", none: "no_restriction" };

/** One `Set-Cookie` value → a store call; an already expired one removes the cookie. */
export function storeCookie(session: ElectronSession, url: string, header: string, now = Date.now()): Promise<void> {
  const [pair = "", ...attributes] = header.split(";");
  const equals = pair.indexOf("=");
  const name = pair.slice(0, Math.max(equals, 0)).trim();
  const details: ElectronCookie = { url, name, value: pair.slice(equals + 1).trim() };
  let maxAge: number | undefined;
  for (const attribute of attributes) {
    const at = attribute.indexOf("=");
    const key = (at < 0 ? attribute : attribute.slice(0, at)).trim().toLowerCase();
    const value = at < 0 ? "" : attribute.slice(at + 1).trim();
    if (key === "path") details.path = value;
    else if (key === "domain") details.domain = value;
    else if (key === "secure") details.secure = true;
    else if (key === "httponly") details.httpOnly = true;
    else if (key === "samesite") {
      const sameSite = SAME_SITE[value.toLowerCase()];
      if (sameSite) details.sameSite = sameSite;
    } else if (key === "max-age") maxAge = Number(value);
    else if (key === "expires" && maxAge === undefined) {
      const time = Date.parse(value);
      if (!Number.isNaN(time)) details.expirationDate = time / 1000;
    }
  }
  // RFC 6265: Max-Age wins over Expires.
  if (maxAge !== undefined && !Number.isNaN(maxAge)) details.expirationDate = now / 1000 + maxAge;
  if (details.expirationDate !== undefined && details.expirationDate * 1000 <= now) return session.cookies.remove(url, name);
  return session.cookies.set(details);
}

/** Answer the app's origin in `session`. Call it after Electron's `ready` event, and open `url`. */
export function start(entry: GeneratedEntry, build: BuildManifests, options: ElectronOptions): ElectronServing {
  const { session, origin: appOrigin = "https://rivet.invalid", client, ...fetchOptions } = options;
  const origin = new URL(appOrigin).origin;
  if (!origin.startsWith("https://")) throw new TypeError(`rivetRouter({ adapter: "electron" }): origin must be https:// (${appOrigin})`);
  const base = entry.base ?? "";
  const lookup = client
    ? staticFiles(typeof client === "string" ? client : fileURLToPath(client), base, immutableOf(base, build), baseHeaders(fetchOptions.headers))
    : () => null;
  const app = createFetch(entry, build, { ...fetchOptions, origin });
  session.protocol.handle("https", async (request) => {
    const url = new URL(request.url);
    if (url.origin !== origin) return session.fetch(request, { bypassCustomProtocolHandlers: true });
    if (request.method === "GET" || request.method === "HEAD") {
      const file = lookup(request, url.pathname);
      if (file) {
        const body = request.method === "HEAD" || !file.path ? null : (Readable.toWeb(createReadStream(file.path)) as ReadableStream<Uint8Array>);
        return new Response(body, { status: file.path ? 200 : 304, headers: file.headers });
      }
    }
    const headers = new Headers(request.headers);
    const cookies = await session.cookies.get({ url: request.url });
    if (cookies.length) headers.set("cookie", cookies.map(({ name, value }) => `${name}=${value}`).join("; "));
    // Fail closed: only a referrer on this origin vouches for a missing `Origin` (`"null"` is rejected by the CSRF check).
    if (!headers.has("origin")) headers.set("origin", request.referrer === origin || request.referrer.startsWith(origin + "/") ? origin : "null");
    const response = await app.fetch(new Request(request, { headers }));
    for (const header of response.headers.getSetCookie()) await storeCookie(session, request.url, header);
    return response;
  });
  return { url: origin + base + "/", origin, close: () => session.protocol.unhandle("https") };
}
