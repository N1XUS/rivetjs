// Head merging (rank + dedupe keys) and serialization (capo.js order), shared by server and kit.
import { escapeJSON } from "@rivetjs/runtime/resume-format";
import { escapeAttribute, escapeText } from "@rivetjs/runtime/escape";
import type { Head, HeadLink, HeadMeta, HeadScript, HeadStyle, InlineScript } from "./data.ts";

/** One head contribution: `level` −1 document defaults, layouts 0…n−1, page n; `phase` 0 route export, 1 components. */
export interface RankedHead {
  readonly level: number;
  readonly phase: 0 | 1;
  readonly seq: number;
  readonly head: Head;
}

const inline = new WeakSet<object>();
/** Brand static inline script code (kit `?script` imports, `unsafeInlineScript`). */
export function inlineScript(code: string): InlineScript {
  const script = Object.freeze({ code });
  inline.add(script);
  return script;
}
export const isInlineScript = (value: unknown): value is InlineScript => typeof value === "object" && value !== null && inline.has(value);

export function metaKey(meta: HeadMeta): string {
  if (meta.key !== undefined) return "k:" + meta.key;
  const base =
    meta.name !== undefined
      ? "n:" + meta.name
      : meta.property !== undefined
        ? "p:" + meta.property
        : meta.httpEquiv !== undefined
          ? "h:" + meta.httpEquiv.toLowerCase()
          : "i:" + meta.itemprop;
  return meta.media !== undefined ? base + "|" + meta.media : base;
}
export function linkKey(link: HeadLink): string {
  if (link.key !== undefined) return "k:" + link.key;
  const rel = link.rel.toLowerCase();
  if (rel === "canonical") return "canonical";
  // hreflang alternates may share an href (`en` and `x-default`); feeds differ by href.
  if (rel === "alternate") return link.hreflang !== undefined ? `alternate ${link.hreflang} ${link.type ?? ""}` : `alternate ${link.type ?? ""} ${link.href}`;
  if (rel === "icon" || rel === "apple-touch-icon" || rel === "mask-icon") return `${rel} ${link.sizes ?? ""} ${link.media ?? ""}`;
  return `${rel} ${link.href || link.imagesrcset || ""} ${link.media ?? ""}`;
}
let jsonLdSeq = 0;
export function scriptKey(script: HeadScript): string {
  if (script.key !== undefined) return "k:" + script.key;
  if ("src" in script) return "s:" + (script.id ?? script.src);
  if ("inline" in script) return "i:" + (script.id ?? script.inline.code);
  // JSON-LD without an id is never deduplicated (several blocks are fine).
  return script.id !== undefined ? "j:" + script.id : "j#" + jsonLdSeq++;
}

/**
 * Merge contributions by rank `(level, phase, seq)`, later winning per key. The title template
 * applies once to the winning title (the output's `title` is final; `titleTemplate` is kept).
 */
export function rankMerge(entries: readonly RankedHead[]): Head | undefined {
  if (!entries.length) return undefined;
  const sorted = [...entries].sort((a, b) => a.level - b.level || a.phase - b.phase || a.seq - b.seq);
  let title: string | undefined, template: string | undefined, base: Head["base"];
  let html: Head["html"], body: Head["body"];
  const meta = new Map<string, HeadMeta>(),
    links = new Map<string, HeadLink>(),
    scripts = new Map<string, HeadScript>(),
    styles = new Map<string, HeadStyle>();
  for (const { head } of sorted) {
    if (head.title !== undefined) title = head.title;
    if (head.titleTemplate !== undefined) template = head.titleTemplate;
    if (head.base) base = head.base;
    if (head.html) html = { ...html, ...head.html };
    if (head.body) body = { ...body, ...head.body };
    for (const entry of head.meta ?? []) meta.set(metaKey(entry), entry);
    for (const entry of head.links ?? []) links.set(linkKey(entry), entry);
    for (const entry of head.scripts ?? []) scripts.set(scriptKey(entry), entry);
    for (const entry of head.styles ?? []) styles.set(entry.key ?? entry.css, entry);
  }
  if (title !== undefined && template !== undefined) title = template.replace("%s", title);
  // The template stays alongside the final title: client head updates template component titles.
  return {
    ...(title !== undefined ? { title } : {}),
    ...(template !== undefined ? { titleTemplate: template } : {}),
    ...(html ? { html } : {}),
    ...(body ? { body } : {}),
    ...(base ? { base } : {}),
    ...(meta.size ? { meta: [...meta.values()] } : {}),
    ...(links.size ? { links: [...links.values()] } : {}),
    ...(scripts.size ? { scripts: [...scripts.values()] } : {}),
    ...(styles.size ? { styles: [...styles.values()] } : {}),
  };
}

const attr = (name: string, value: string | undefined | boolean) =>
  value === undefined || value === false ? "" : value === true ? " " + name : ` ${name}="${escapeAttribute(value)}"`;
const LINK_ATTRIBUTES = [
  "rel",
  "href",
  "type",
  "hreflang",
  "media",
  "sizes",
  "as",
  "crossorigin",
  "imagesrcset",
  "imagesizes",
  "fetchpriority",
  "title",
  "color",
  "integrity",
  "referrerpolicy",
] as const;

export interface HeadTagOptions {
  /** Stylesheet URLs, linked before the head's own stylesheets (capo position 7). */
  styles?: readonly string[];
  /** Entries of `styles` written as an inline `<style>` (URL → CSS, with the nonce) instead of a link, in place. */
  inlineStyles?: Readonly<Record<string, string>> | undefined;
  /** CSP nonce for inline and external scripts. */
  nonce?: string | undefined;
  /**
   * Mark managed tags `data-rh` (kit updates them on client navigation); entries in `persistent`
   * (root layout components, never re-rendered in the browser) get `data-rh="0"` and are kept.
   */
  managed?: boolean | HeadManaged | undefined;
}
export interface HeadManaged {
  readonly persistent: ReadonlySet<object>;
}
export function linkTag(link: HeadLink, mark = ""): string {
  let tag = "<link";
  for (const name of LINK_ATTRIBUTES) tag += attr(name, link[name]);
  return tag + mark + ">";
}
export function metaTag(meta: HeadMeta, mark = ""): string {
  const key =
    meta.name !== undefined
      ? attr("name", meta.name)
      : meta.property !== undefined
        ? attr("property", meta.property)
        : meta.httpEquiv !== undefined
          ? attr("http-equiv", meta.httpEquiv)
          : meta.itemprop !== undefined
            ? attr("itemprop", meta.itemprop)
            : "";
  return key ? `<meta${key} content="${escapeAttribute(meta.content)}"${attr("media", meta.media)}${mark}>` : "";
}
export const jsonLdTag = (data: object, id?: string, mark = "") =>
  `<script type="application/ld+json"${attr("id", id)}${mark}>${escapeJSON(JSON.stringify(data))}</script>`;

type SrcScript = Extract<HeadScript, { src: string }>;
const deferred = (s: SrcScript) => s.strategy === "load" || s.strategy === "idle" || s.strategy === "interaction";

// Script bootstrap (minified by hand), one inline script per page: `{let l=<list>,…}` (block scope).
// It runs while the head parses, before `load`. List entries: `{ u: src, k, …script properties }`,
// `k` = index in STRATEGY_CODES. `l` doubles as the policy's allowlist.
const STRATEGY_CODES = ["load", "idle", "interaction"] as const;
export const BOOT_LIST_END = ",d=document,";
const BOOT_CORE =
  BOOT_LIST_END +
  'E=addEventListener,p,r=k=>l.map(({u,k:s,...o})=>s==k&&d.head.append(Object.assign(d.createElement("script"),o,{src:p?.createScriptURL(u)??u})));' +
  // The page's one `rivet-script` policy (unlisted URLs become ""; JSON-only scripts for kit JSON-LD), shared with kit's head manager.
  'try{d.$rs={p:p=trustedTypes.createPolicy("rivet-script",{createScriptURL:u=>l.some(s=>s.u==u)?u:"",createScript:c=>JSON.parse(c)&&c}),l}}catch{}';
// Window-level scroll / wheel listeners are passive already; listeners stay attached as no-ops. Touch
// interaction arrives as pointerdown.
const BOOT_IDLE =
  'let t,n,g=()=>n||(clearTimeout(t),t=setTimeout(()=>{n=1;(self.requestIdleCallback||setTimeout)(()=>r(1),{timeout:4e3})},150));E("scroll",g);g();';
const BOOT_INTERACTION = 'let i,x=()=>i||(i=r(2));"pointerdown keydown wheel".split(" ").map(e=>E(e,x,!0));';

/**
 * Bootstrap for `load` / `idle` / `interaction` scripts: `list` (escaped JSON array) inlined, code
 * for only the strategies the page uses. Injected scripts are async by default.
 */
export function _scriptBootstrap(strategies: Iterable<string>, list = "[]"): string {
  const used = new Set(strategies);
  const onload = (used.has("load") ? "r(0);" : "") + (used.has("idle") ? BOOT_IDLE : "");
  return "{let l=" + list + BOOT_CORE + (onload ? `E("load",()=>{${onload}});` : "") + (used.has("interaction") ? BOOT_INTERACTION : "") + "}";
}

function scriptTag(script: SrcScript, nonce: string, mark: string): string {
  const module = script.type === "module";
  const strategy = script.strategy ?? "defer";
  const timing = strategy === "eager" ? " async" : strategy === "defer" && !module ? " defer" : "";
  return `<script${module ? ' type="module"' : ""}${timing} src="${escapeAttribute(script.src)}"${attr("id", script.id)}${attr("integrity", script.integrity)}${attr("crossorigin", script.crossorigin)}${attr("referrerpolicy", script.referrerpolicy)}${nonce}${mark}></script>`;
}
/** Inline `<style>` (unmanaged: never `data-rh`). CSS never contains a closing tag. */
const styleTag = (style: HeadStyle, nonce: string): string =>
  `<style${attr("media", style.media)}${nonce}>${style.css.replace(/<\/(style)/gi, "<\\/$1")}</style>`;
/** Inline script: its JSON data block (if any) right before it. Code never contains a closing tag. */
function inlineTag(script: Extract<HeadScript, { inline: InlineScript }>, nonce: string): string {
  if (!isInlineScript(script.inline)) throw new TypeError("head script `inline` must be an InlineScript (`?script` import or unsafeInlineScript)");
  const data = script.data !== undefined ? `<script type="application/json">${escapeJSON(JSON.stringify(script.data))}</script>` : "";
  return `${data}<script${attr("id", script.id)}${nonce}>${script.inline.code.replace(/<\/(script)/gi, "<\\/$1")}</script>`;
}

/**
 * Tags for a merged head in capo.js order: base, title, preconnect, async scripts, blocking scripts,
 * stylesheets (`styles` first), preloads, deferred scripts (+ bootstrap), prefetch, meta / SEO links,
 * JSON-LD. Charset, viewport and the CSP meta belong to the shell.
 */
export function headTags(head: Head | undefined, options: HeadTagOptions = {}): string {
  const managed = options.managed;
  const markOf = (entry: object) => (!managed ? "" : typeof managed === "object" && managed.persistent.has(entry) ? ' data-rh="0"' : ' data-rh=""');
  const nonce = options.nonce !== undefined ? ` nonce="${options.nonce.replace(/[^\w+/=-]/g, "")}"` : "";
  // One string per capo.js group (index = order), appended in place.
  const groups: string[] = ["", "", "", "", "", "", "", "", "", "", "", ""];
  const sheets = options.inlineStyles;
  for (const href of options.styles ?? []) {
    const css = sheets && Object.hasOwn(sheets, href) ? sheets[href] : undefined;
    groups[5] += css !== undefined ? styleTag({ css }, nonce) : `<link rel="stylesheet" href="${escapeAttribute(href)}">`;
  }
  // Inline styles after the stylesheets (same group): component rules (motion entrances) win ties over sheet rules.
  const inlineStyles = head?.styles?.map((style) => styleTag(style, nonce)).join("") ?? "";
  if (head?.base) groups[0] += `<base href="${escapeAttribute(head.base.href)}"${attr("target", head.base.target)}>`;
  if (head?.title !== undefined) groups[1] += `<title>${escapeText(head.title)}</title>`;
  for (const link of head?.links ?? []) {
    const rel = link.rel.toLowerCase();
    const group =
      rel === "preconnect"
        ? 2
        : rel === "stylesheet"
          ? 5
          : rel === "preload" || rel === "modulepreload"
            ? 6
            : rel === "prefetch" || rel === "dns-prefetch" || rel === "prerender"
              ? 8
              : 10;
    groups[group] += linkTag(link, markOf(link));
  }
  groups[5] += inlineStyles;
  const later: SrcScript[] = [];
  for (const script of head?.scripts ?? []) {
    if ("strategy" in script && script.strategy === "body") continue; // `bodyTags`
    if ("jsonLd" in script) groups[11] += jsonLdTag(script.jsonLd, script.id, markOf(script));
    else if ("inline" in script) {
      const strategy = script.strategy ?? "defer";
      groups[strategy === "eager" ? 3 : strategy === "blocking" ? 4 : 7] += inlineTag(script, nonce);
    } else if (deferred(script)) later.push(script);
    else {
      const strategy = script.strategy ?? "defer";
      groups[strategy === "eager" ? 3 : strategy === "blocking" ? 4 : 7] += scriptTag(script, nonce, markOf(script));
    }
  }
  if (later.length) {
    const list = later.map((s) => ({
      u: s.src,
      k: STRATEGY_CODES.indexOf(s.strategy as (typeof STRATEGY_CODES)[number]),
      ...(s.type === "module" ? { type: "module" } : {}),
      ...(s.id ? { id: s.id } : {}),
      ...(s.integrity ? { integrity: s.integrity } : {}),
      ...(s.crossorigin ? { crossOrigin: s.crossorigin } : {}),
      ...(s.referrerpolicy ? { referrerPolicy: s.referrerpolicy } : {}),
    }));
    groups[7] += `<script id="rivet-scripts"${nonce}>${_scriptBootstrap(
      later.map((s) => s.strategy!),
      escapeJSON(JSON.stringify(list)),
    )}</script>`;
  }
  for (const meta of head?.meta ?? []) groups[9] += metaTag(meta, markOf(meta));
  return groups.join("");
}

const ATTRIBUTE_NAME = /^[A-Za-z_:][-\w:.]*$/;
/** Every attribute of `record` but `skip`, in order (leading spaces); a malformed name or an `on*` handler throws. */
function attributes(record: Readonly<Record<string, string | undefined>> | undefined, html: boolean): string {
  let out = "";
  for (const name in record) {
    if (html && (name === "lang" || name === "dir")) continue; // written first, over the request defaults
    if (!ATTRIBUTE_NAME.test(name) || /^on/i.test(name)) throw new TypeError(`head html / body: attribute name ${JSON.stringify(name)} is not allowed`);
    out += attr(name, record[name]);
  }
  return out;
}
/** `<html>` attributes (leading space) for shells: the head's `html` over request defaults (i18n `locale`/`dir`). */
export function htmlAttributes(head: Head | undefined, defaults: { lang?: string | undefined; dir?: string | undefined } = {}): string {
  const html = { ...defaults, ...head?.html };
  return attr("lang", html.lang) + attr("dir", html.dir) + attributes(head?.html, true);
}
/** `<body>` attributes (leading space): every `head.body` attribute. */
export const bodyAttributes = (head: Head | undefined): string => (head?.body ? attributes(head.body, false) : "");
/**
 * End-of-body tags for shells (before `</body>`): the head's `strategy: "body"` scripts, in order, with the request
 * nonce — they run once the page's markup is parsed. Document loads only: client navigation loads `src` ones (kit) and
 * never runs inline ones again.
 */
export function bodyTags(head: Head | undefined, options: Pick<HeadTagOptions, "nonce"> = {}): string {
  let out = "";
  const nonce = options.nonce !== undefined ? ` nonce="${options.nonce.replace(/[^\w+/=-]/g, "")}"` : "";
  for (const script of head?.scripts ?? [])
    if ("strategy" in script && script.strategy === "body")
      out += "inline" in script ? inlineTag(script, nonce) : scriptTag({ ...script, strategy: "blocking" }, nonce, "");
  return out;
}
