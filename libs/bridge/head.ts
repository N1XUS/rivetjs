// Shared framework-serialized head parser; import only on the server.
import { nativeHeadLifecycle } from "./head-lifecycle.ts";
import type { IslandHead } from "./adapter.ts";

/** React's own escapes in text / attribute values. */
const unescape = (value: string) =>
  value.replace(
    /&(amp|lt|gt|quot|#x27|#39|nbsp);/g,
    (_, name: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'", "#39": "'", nbsp: " " })[name]!,
  );

const TAG = /<(title|meta|link|style|script)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*\/?>(?:([\s\S]*?)<\/\1>)?/y;
const ATTR = /\s+([\w:-]+)(?:="([^"]*)")?/g;
const camel = (name: string) => name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

/**
 * The head entries React wrote before the content (its own serialisation of hoistables), as kit head fields; `rest` =
 * markup that is no head field (an async `<script>`): it stays in the island.
 */
export function headOf(prefix: string): { head: IslandHead | null; rest: string } {
  const head: { title?: string; meta?: Record<string, string>[]; links?: Record<string, string>[]; styles?: { css: string; key?: string; media?: string }[] } =
    {};
  let rest = "";
  TAG.lastIndex = 0;
  while (TAG.lastIndex < prefix.length) {
    const at = TAG.lastIndex;
    const m = TAG.exec(prefix);
    if (!m) {
      rest += prefix.slice(at);
      break;
    }
    const [whole, tag, attrs = "", text = ""] = m;
    const fields: Record<string, string> = {};
    let key: string | undefined;
    for (const [, name, value = ""] of attrs.matchAll(ATTR)) {
      if (name === "data-href") key = unescape(value);
      if (!name!.startsWith("data-")) fields[name === "http-equiv" ? "httpEquiv" : camel(name!)] = unescape(value);
    }
    if (tag === "title") head.title = unescape(text);
    else if (tag === "meta") (head.meta ??= []).push(fields);
    else if (tag === "link") (head.links ??= []).push(fields);
    else if (tag === "style") (head.styles ??= []).push({ css: text, ...(key ? { key } : {}), ...(fields.media ? { media: fields.media } : {}) });
    else rest += whole;
  }
  return { head: Object.keys(head).length ? (head as IslandHead) : null, rest };
}

/** Parse framework head-only prefixes, ignoring hydration/teleport anchors between tags. */
export function headOfMarked(prefix: string): { head: IslandHead | null; rest: string } {
  let normalized = "",
    at = 0;
  while (at < prefix.length) {
    const gap = /^(?:\s+|<!--[\s\S]*?-->)+/.exec(prefix.slice(at));
    if (gap) at += gap[0].length;
    if (at === prefix.length) break;
    TAG.lastIndex = at;
    const tag = TAG.exec(prefix);
    if (!tag) {
      normalized += prefix.slice(at);
      break;
    }
    normalized += tag[0];
    at = TAG.lastIndex;
  }
  return headOf(normalized);
}

/**
 * Native Vue Teleport / Svelte head markup, kept byte-for-byte in its own island range. Normalized enumerable fields
 * remain wire-compatible; adapters use the server-only callback only through the component head sink. It cannot enter JSON.
 */
export function nativeHead(framework: "vue" | "svelte", id: string, raw: string, nonce?: string): { head: IslandHead | null; rest: string } {
  if (!raw) return { head: null, rest: "" };
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Native head island id must contain only letters, digits, underscores or hyphens");
  let titles = 0;
  let at = 0;
  while (at < raw.length) {
    const gap = /^(?:\s+|<!--[\s\S]*?-->)+/.exec(raw.slice(at));
    if (gap) at += gap[0].length;
    if (at === raw.length) break;
    TAG.lastIndex = at;
    const tag = TAG.exec(raw);
    if (!tag) break;
    if (tag[1] === "title") titles++;
    at = TAG.lastIndex;
  }
  if (titles > 1) throw new Error("Native island head titles require one title author: this island rendered more than one title.");
  const { head } = headOfMarked(raw);
  const fallback: IslandHead = head ?? {};
  Object.defineProperty(fallback, Symbol.for("rivet.head.render"), {
    value: {
      titles,
      boot: () => nativeHeadLifecycle(nonce),
      render: () => `<!--rivet-head:${framework}:${id}-->${raw}<!--/rivet-head:${framework}:${id}-->`,
    },
  });
  return { head: fallback, rest: "" };
}
