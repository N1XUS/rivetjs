// @rivetjs/kit (DOM target): client navigation and client renders keep `head > [data-rh]` in sync
// with the route head (data endpoint) and the head components currently mounted. Resumed pages never
// run these components: their head is the server's, at zero JS.
import { onCleanup, useContext } from "@rivetjs/reactivity";
import { linkKey, metaKey, rankMerge, type RankedHead } from "@rivetjs/router/head";
import type { RoutePayload } from "@rivetjs/router/client";
import {
  HeadLevel,
  KIT_POLICY,
  childText,
  themeScript,
  type Head as HeadFields,
  type HeadLink as HeadLinkFields,
  type HeadMeta,
  type HeadLinkProps,
  type HeadScript,
  type JsonLdProps,
  type MetaProps,
  type ScriptProps,
  type ThemeScriptProps,
} from "./shared.ts";
export * from "./shared.ts";

interface Mounted {
  level: number;
  seq: number;
  head: HeadFields;
}
let route: HeadFields | undefined;
let pageLevel = Infinity;
let seq = 0;
const mounted = new Set<Mounted>();
let queued = false;

type Policy = { createScriptURL(url: string): unknown; createScript(code: string): unknown };
/** The one `rivet-script` policy per page: the script bootstrap's (`document.$rs`) when it ran, else ours. */
type Shared = { p: Policy; l: { u: string }[] };
let policy: Policy | null | undefined;
let allowed: { u: string }[] = [];
function trusted(): Policy | null {
  if (policy !== undefined) return policy;
  const holder = document as unknown as { $rs?: Shared };
  if (holder.$rs) {
    allowed = holder.$rs.l;
    return (policy = holder.$rs.p);
  }
  const tt = (globalThis as { trustedTypes?: { createPolicy(name: string, rules: object): Policy } }).trustedTypes;
  try {
    policy = tt
      ? tt.createPolicy(KIT_POLICY, {
          createScriptURL: (url: string) => {
            if (allowed.some((entry) => entry.u === url)) return url;
            throw new TypeError("rivet-script: unlisted script URL " + url);
          },
          // Only JSON (JSON-LD blocks).
          createScript: (code: string) => (JSON.parse(code), code),
        })
      : null;
  } catch {
    policy = null;
  }
  if (policy) holder.$rs = { p: policy, l: allowed };
  return policy;
}

/** Record head entries of a mounted component; removed when its owner is disposed. */
export function pushHead(head: HeadFields, _component?: string): null {
  if (typeof document === "undefined") return null;
  const entry: Mounted = { level: useContext(HeadLevel), seq: seq++, head };
  mounted.add(entry);
  onCleanup(() => {
    mounted.delete(entry);
    schedule();
  });
  schedule();
  return null;
}
function schedule(): void {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    sync();
  });
}

/**
 * Route head from client navigation (`load` of generated routes): replaces the previous route's
 * head; components at the page level or deeper override it, layout components only fill gaps.
 */
export function applyRouteHead<T extends Pick<RoutePayload, "head">>(result: T, level = Infinity): T {
  route = result.head;
  pageLevel = level;
  schedule();
  return result;
}

const lower: Record<string, string> = { httpEquiv: "http-equiv" };
function apply(head: HeadFields): void {
  if (head.title !== undefined && document.title !== head.title) document.title = head.title;
  const root = document.documentElement;
  for (const [name, value] of Object.entries(head.html ?? {})) if (value !== undefined && root.getAttribute(name) !== value) root.setAttribute(name, value);
  for (const [name, value] of Object.entries(head.body ?? {}))
    if (value !== undefined && document.body.getAttribute(name) !== value) document.body.setAttribute(name, value);
  const wanted = new Map<string, () => Element>();
  // JSON-LD blocks by their data (the server writes them escaped): an equal block in the document stays as it is, so a
  // resumed page never rewrites server JSON-LD (no script text write, no Trusted Types sink).
  const json = new Map<string, string>();
  for (const meta of head.meta ?? []) wanted.set("m " + metaKey(meta), () => element("meta", meta));
  for (const link of head.links ?? []) wanted.set("l " + linkKey(link), () => element("link", link));
  for (const script of head.scripts ?? []) {
    if ("jsonLd" in script) {
      const code = JSON.stringify(script.jsonLd);
      wanted.set("j " + (script.id ?? code), () => jsonLd(code, script.id));
      json.set("j " + (script.id ?? code), code);
    } else if ("src" in script) load(script);
  }
  // Keyed diff over managed tags: keep equal ones, replace changed, drop stale, append new.
  for (const el of [...document.head.querySelectorAll("[data-rh]")]) {
    const key = keyOf(el);
    const make = key === undefined ? undefined : wanted.get(key);
    if (!make) {
      // Root layout entries rendered on the server: the layout persists, so do they.
      if (el.getAttribute("data-rh") !== "0") el.remove();
      continue;
    }
    wanted.delete(key!);
    if (json.has(key!) && canonical(el.textContent) === json.get(key!)) continue;
    const next = make();
    if (!next.isEqualNode(el)) el.replaceWith(next);
  }
  for (const make of wanted.values()) document.head.append(make());
}
function element(tag: "meta" | "link", fields: HeadMeta | HeadLinkFields): Element {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(fields)) if (name !== "key" && value !== undefined) el.setAttribute(lower[name] ?? name, String(value));
  el.setAttribute("data-rh", "");
  return el;
}
function jsonLd(code: string, id: string | undefined): Element {
  const el = document.createElement("script");
  el.type = "application/ld+json";
  if (id !== undefined) el.id = id;
  const p = trusted();
  (el as { text: unknown }).text = p ? p.createScript(code) : code;
  el.setAttribute("data-rh", "");
  return el;
}
/** JSON text as `JSON.stringify` writes it (server blocks are escaped: `\u003c`); other text as it is. */
function canonical(text: string | null): string {
  try {
    return JSON.stringify(JSON.parse(text ?? ""));
  } catch {
    return text ?? "";
  }
}
function keyOf(el: Element): string | undefined {
  const get = (name: string) => el.getAttribute(name) ?? undefined;
  if (el.localName === "meta") {
    const meta = { name: get("name"), property: get("property"), httpEquiv: get("http-equiv"), itemprop: get("itemprop"), media: get("media"), content: "" };
    return "m " + metaKey(Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined)) as unknown as HeadMeta);
  }
  if (el.localName === "link") {
    const link = {
      rel: get("rel") ?? "",
      href: get("href") ?? "",
      hreflang: get("hreflang"),
      type: get("type"),
      sizes: get("sizes"),
      media: get("media"),
      imagesrcset: get("imagesrcset"),
    };
    return "l " + linkKey(Object.fromEntries(Object.entries(link).filter(([, v]) => v !== undefined)) as unknown as HeadLinkFields);
  }
  if (el.localName === "script" && (el as HTMLScriptElement).type === "application/ld+json") return "j " + (el.id || canonical(el.textContent));
  return undefined;
}

function sync(): void {
  const template = route?.titleTemplate;
  const final = (head: HeadFields): HeadFields =>
    head.title !== undefined && template !== undefined && head.titleTemplate === undefined ? { ...head, title: template.replace("%s", head.title) } : head;
  // Rank: layout components < the route head (final title) < page-level components.
  const entries: RankedHead[] = [];
  for (const m of mounted) if (m.level < pageLevel) entries.push({ level: 0, phase: 1, seq: m.seq, head: final(m.head) });
  if (route) {
    const { titleTemplate: _, ...head } = route;
    entries.push({ level: 1, phase: 0, seq: 0, head });
  }
  for (const m of mounted) if (m.level >= pageLevel) entries.push({ level: 2, phase: 1, seq: m.seq, head: final(m.head) });
  const merged = rankMerge(entries);
  apply(merged ?? {});
}

// ---- scripts ----

const scripts = new Map<string, Promise<void>>();
/** Load a script once (shared registry with `<Script>`); resolves on `load`. */
export function loadScript(src: string, options: { type?: "module" | "classic"; integrity?: string; crossorigin?: string } = {}): Promise<void> {
  let loading = scripts.get(src);
  if (loading) return loading;
  // Already in the document (server-rendered tag or bootstrap).
  if ([...document.scripts].some((s) => s.getAttribute("src") === src)) return (scripts.set(src, Promise.resolve()), Promise.resolve());
  loading = new Promise<void>((done, fail) => {
    const el = document.createElement("script");
    const p = trusted();
    allowed.push({ u: src });
    (el as { src: unknown }).src = p ? p.createScriptURL(src) : src;
    if (options.type === "module") el.type = "module";
    else el.async = true;
    if (options.integrity) el.integrity = options.integrity;
    if (options.crossorigin) el.crossOrigin = options.crossorigin;
    el.onload = () => done();
    el.onerror = () => fail(new Error("Script failed to load: " + src));
    document.head.append(el);
  });
  scripts.set(src, loading);
  return loading;
}
function load(script: Extract<HeadScript, { src: string }>): void {
  if (scripts.has(script.src)) return;
  const run = () =>
    void loadScript(script.src, {
      ...(script.type ? { type: script.type } : {}),
      ...(script.integrity ? { integrity: script.integrity } : {}),
      ...(script.crossorigin ? { crossorigin: script.crossorigin } : {}),
    }).catch(() => {});
  if (script.strategy === "idle") (globalThis.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1)))(run, { timeout: 4000 });
  else if (script.strategy === "interaction") {
    const events = ["pointerdown", "keydown", "touchstart", "wheel"];
    const once = () => (events.forEach((e) => removeEventListener(e, once, true)), run());
    events.forEach((e) => addEventListener(e, once, { capture: true, passive: true }));
  } else run();
}

// ---- components (same API as the server target) ----

/** Any head fields (browser target of `<Head>`). */
export const Head = (props: { value: HeadFields }): null => pushHead(props.value);
/** The document title (browser target of `<Title>`). */
export const Title = (props: { children?: unknown }): null => pushHead({ title: childText(props.children) });
/** A head `<meta>` (browser target of `<Meta>`). */
export const Meta = (props: MetaProps): null => pushHead({ meta: [props] });
/** A head `<link>` (browser target of `<HeadLink>`). */
export const HeadLink = (props: HeadLinkProps): null => pushHead({ links: [props] });
/** A head script (browser target of `<Script>`). */
export const Script = (props: ScriptProps): null => pushHead({ scripts: [props] });
/** A JSON-LD data block (browser target of `<JsonLd>`). */
export const JsonLd = <T extends object>(props: JsonLdProps<T>): null =>
  pushHead({ scripts: [props.id !== undefined ? { jsonLd: props.data, id: props.id } : { jsonLd: props.data }] });
/** Client renders: the server-rendered theme script already ran; nothing to do. */
export const ThemeScript = (_props: ThemeScriptProps): null => (void themeScript, null);
