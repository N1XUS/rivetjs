// @rivetjs/bridge-react/server — React 19 server adapter (spec §3.3). `renderToString` first (the fast path, T1:
// 2.3–2.9× cheaper than stream-to-string); a tree that suspends (React marks the boundary `<!--$!-->` for client
// rendering, or throws when no boundary is above the suspension: root `use()`, `lazy`, async components) renders again through `renderToReadableStream` read to completion (`allReady`), with the island id as
// `identifierPrefix`, the render's CSP nonce and abort signal. A render error (incl. one inside a Suspense boundary)
// rejects (the bridge's island error path). React 19 hoistables become the island's head (kit head fields).
import { createElement, type ComponentType } from "react";
import { renderToReadableStream, renderToString } from "react-dom/server";
import type { IslandContext, IslandHead, IslandRender, ServerAdapter, SlotMark } from "@rivetjs/bridge/adapter";
import { islandElement } from "./tree.ts";
import { withSlots } from "./slot.ts";

const SENTINEL = "<rivet-head-end></rivet-head-end>";
/**
 * React's error for a suspension `renderToString` cannot wait for (no Suspense boundary above it). Keyed on React's
 * message text (React exposes no code for it): a React upgrade that rewords it fails `tests/ssr.test.ts` ("React's
 * suspension message") loudly instead of rejecting such islands silently.
 */
const SUSPENDED = /suspended while responding to synchronous input/;
const Mark = () => createElement("rivet-head-end");

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

/** Island HTML (head split off at the sentinel). */
function finish(html: string): string | IslandRender {
  const at = html.indexOf(SENTINEL);
  if (at < 0) return html;
  const body = html.slice(at + SENTINEL.length);
  if (at === 0) return body;
  const { head, rest } = headOf(html.slice(0, at));
  return head ? { html: rest + body, head } : rest + body;
}

async function stream(element: ReturnType<typeof islandElement>, ctx: IslandContext): Promise<string | IslandRender> {
  let failure: { error: unknown } | null = null;
  const body = await renderToReadableStream(element, {
    identifierPrefix: ctx.id + "-",
    nonce: ctx.nonce,
    signal: ctx.signal,
    onError(error) {
      failure ??= { error };
    },
  });
  await body.allReady;
  if (failure) throw (failure as { error: unknown }).error;
  return finish(await new Response(body).text());
}

/** The React server adapter (`IslandDef.a` of React islands). */
export const adapter: ServerAdapter<ComponentType<Record<string, unknown>>> = {
  name: "react",
  render(component, props, slots: Record<string, SlotMark>, ctx) {
    const element = islandElement(Mark, component, withSlots(props, Object.keys(slots)));
    let html: string;
    try {
      html = renderToString(element, { identifierPrefix: ctx.id + "-" });
    } catch (error) {
      // A root that suspends outside any Suspense boundary (`use(promise)`, `lazy`, an async component) throws
      // "A component suspended while responding to synchronous input": the stream can wait for it.
      if (SUSPENDED.test(String((error as Error | null)?.message))) return stream(element, ctx);
      throw error;
    }
    // `<!--$!-->`: a Suspense boundary React gave up on (renderToString cannot wait): render it for real.
    return html.includes("<!--$!") ? stream(element, ctx) : finish(html);
  },
};
