// What a hash Content-Security-Policy of a rendered page allows: its inline scripts / styles (hashed by the caller)
// and the origins of its script files. Static adapter (`hashCSP`, `<meta>`): every inline script of a build-time page
// (`inlineSources`). Route cache (`server/route-cache.ts`, header): only the elements that carry the render's nonce
// (`noncedSources`) — markup injected into a page never enters the policy. Web-standard, no hashing here.
import type { CSPOptions } from "./csp.ts";
import { cspPolicy } from "./csp-directives.ts";
import { BOOT_LIST_END } from "./head.ts";

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const STYLE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
// Inline scripts script-src governs: no `src`, and no type, a JavaScript one or `speculationrules` (router document prefetch).
const executable = (attrs: string): boolean => {
  if (/\ssrc\s*=/i.test(attrs)) return false;
  const type = /\stype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
  const value = (type?.[1] ?? type?.[2] ?? type?.[3] ?? "").trim().toLowerCase();
  return value === "" || value === "module" || value === "text/javascript" || value === "application/javascript" || value === "speculationrules";
};

/** A page's inline code a hash policy must allow. */
export interface InlineSources {
  /** Bodies of the executable inline scripts, in page order (duplicates kept: callers dedupe the hashes). */
  readonly scripts: string[];
  /** Bodies of the `<style>` elements (only when asked: `styles`). */
  readonly styles: string[];
  /** Origins of third-party script files (`<script src>`, the kit `#rivet-scripts` bootstrap list). */
  readonly origins: Set<string>;
}

/** Collect what a hash policy for `html` allows; `styles`: also the `<style>` bodies (the options set a `style-src`). */
export function inlineSources(html: string, styles: boolean): InlineSources {
  const scripts: string[] = [];
  const origins = new Set<string>();
  for (const [, attrs = "", body = ""] of html.matchAll(SCRIPT)) {
    if (executable(attrs)) scripts.push(body);
    const src = /\ssrc\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
    if (src) addOrigin(origins, src.replaceAll("&amp;", "&"));
    else if (/\sid\s*=\s*"rivet-scripts"/i.test(attrs)) bootOrigins(body, origins);
  }
  const out: string[] = [];
  if (styles) for (const [, body = ""] of html.matchAll(STYLE)) out.push(body);
  return { scripts, styles: out, origins };
}

const NONCE_LEAD = ' nonce="';
// A whole start tag the renderer writes: `<script|style|link` + attributes (quoted values without `<`) + `>`.
const NONCED_TAG = /^<(script|style|link)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"<]*"|'[^'<]*'|[^\s"'=<>`]+))?)*)\s*\/?>$/i;

/** Byte ranges (`[start, end)`) of what a stored page's hash policy allows, and where its nonce attributes are. */
export interface NoncedSources {
  /** Bodies of the executable inline scripts that carry the nonce. */
  readonly scripts: [number, number][];
  /** Bodies of the `<style>` elements that carry the nonce (only when asked: `styles`). */
  readonly styles: [number, number][];
  /** Origins of third-party script files whose `<script src>` carries the nonce (and of the kit `#rivet-scripts` list in a nonce'd bootstrap). */
  readonly origins: Set<string>;
  /** Start offsets of each ` nonce="…"` attribute (`' nonce="'.length + nonce.length + 1` long). */
  readonly attrs: number[];
}

/**
 * Collect what the hash policy of a nonce-rendered page allows: only `<script>` / `<style>` / `<link>` start tags that
 * carry ` nonce="<nonce>"` (the renderer's own elements). `text`: the page as one character per byte (latin1), so
 * offsets are byte offsets; `utf8(start, end)`: those bytes as text (script URLs, the bootstrap list). Null — the page
 * must not be stored — when the nonce appears anywhere else (script text, an attribute value, a malformed tag): a
 * stored copy would hand one nonce to every visitor, or the tag is not one the renderer wrote.
 */
export function noncedSources(text: string, nonce: string, styles: boolean, utf8: (start: number, end: number) => string): NoncedSources | null {
  const scripts: [number, number][] = [];
  const out: [number, number][] = [];
  const origins = new Set<string>();
  const attrs: number[] = [];
  if (!nonce) return null;
  const attr = NONCE_LEAD + nonce + '"';
  for (let at = text.indexOf(nonce); at >= 0; at = text.indexOf(nonce, at + nonce.length)) {
    const start = at - NONCE_LEAD.length;
    if (start < 0 || !text.startsWith(attr, start)) return null;
    const open = text.lastIndexOf("<", start);
    const close = text.indexOf(">", at);
    const tag = open < 0 || close < 0 ? null : NONCED_TAG.exec(text.slice(open, close + 1));
    if (!tag) return null;
    attrs.push(start);
    const name = tag[1]!.toLowerCase();
    if (name === "link") continue;
    const end = text.indexOf(name === "script" ? "</script" : "</style", close + 1);
    if (end < 0) return null;
    if (name === "style") {
      if (styles) out.push([close + 1, end]);
      continue;
    }
    const attributes = tag[2]!;
    if (executable(attributes)) scripts.push([close + 1, end]);
    const src = /\ssrc\s*=\s*"([^"]*)"/i.exec(attributes);
    if (src) {
      // The value's bytes (`"` excluded): the attributes start right after `<script`.
      const end = open + 1 + name.length + src.index + src[0].length - 1;
      addOrigin(origins, utf8(end - src[1]!.length, end).replaceAll("&amp;", "&"));
    } else if (/\sid\s*=\s*"rivet-scripts"/i.test(attributes)) bootOrigins(utf8(close + 1, end), origins);
  }
  return { scripts, styles: out, origins, attrs };
}

function addOrigin(origins: Set<string>, src: string): void {
  const url = URL.canParse(src) ? new URL(src) : null;
  if (url && (url.protocol === "https:" || url.protocol === "http:")) origins.add(url.origin);
}
/** Kit script bootstrap: `{let l=<JSON list>,d=document,…`; the list ends at the first cut that parses. */
function bootOrigins(body: string, origins: Set<string>): void {
  if (!body.startsWith("{let l=")) return;
  for (let at = body.indexOf(BOOT_LIST_END); at > 0; at = body.indexOf(BOOT_LIST_END, at + 1)) {
    let list: { u?: unknown }[];
    try {
      list = JSON.parse(body.slice(7, at));
    } catch {
      continue;
    }
    for (const entry of list) if (typeof entry.u === "string") addOrigin(origins, entry.u);
    break;
  }
}

/**
 * The hash policy: `script-src` = the scripts' hashes + `'self'` + script origins, `object-src` / `base-uri` `'none'`,
 * merged with `options` (`cspPolicy`; `meta`: header-only directives throw). Hashes are CSP sources (`'sha256-…'`).
 * (`'strict-dynamic'` would not do: it trusts the scripts a trusted script inserts with `createElement("script")`, but
 * an `import()` is fetched with the importing script's nonce, and a hash-allowed script has none — Chromium and Firefox
 * block it (WebKit allows it); the resume loader imports its chunks. Pinned in `tests/route-cache-csp.test.ts`.)
 */
export function hashPolicy(
  scripts: Iterable<string>,
  origins: Iterable<string>,
  styles: readonly string[],
  options: CSPOptions | undefined,
  meta: boolean,
): string {
  return cspPolicy(
    [
      ["script-src", [...new Set(scripts), "'self'", ...origins]],
      ["object-src", ["'none'"]],
      ["base-uri", ["'none'"]],
    ],
    options,
    meta,
    [...new Set(styles)],
  );
}
