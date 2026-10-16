// @rivetjs/kit (server target): head components push into the request's head sink (router head
// hold) and render nothing in place. The kit Vite plugin resolves `@rivetjs/kit/dom` for browsers.
import { useContext } from "@rivetjs/reactivity";
import { template, type ServerValue } from "@rivetjs/runtime/server";
import { ServerData } from "@rivetjs/router/route-context";
import type { RoutePayload } from "@rivetjs/router/client";
import { HeadLevel, childText, themeScript, type Head as HeadFields, type HeadLinkProps, type JsonLdProps, type MetaProps, type ScriptProps, type ThemeScriptProps } from "./shared.ts";
export * from "./shared.ts";

/** Record `head` at the current route level; markup only for late (post-shell) body-valid entries. */
export function pushHead(head: HeadFields, component = "<Head>"): ServerValue {
  const sink = useContext(ServerData)?.headSink;
  if (!sink)
    throw new Error(`${component}: kit head needs @rivetjs/router with the kit Vite plugin (kit() from @rivetjs/kit/vite) or rivetRouter({ head: "components" })`);
  const late = sink.push(useContext(HeadLevel), head, component);
  return late ? template([late]) : null;
}

/** Any head fields (`<Head value={seo({ … })} />`). */
export const Head = (props: { value: HeadFields }): ServerValue => pushHead(props.value, "<Head>");
/** `<title>` (the route's `titleTemplate` applies). */
export const Title = (props: { children?: unknown }): ServerValue => pushHead({ title: childText(props.children) }, "<Title>");
/** A head `<meta>` (deduplicated by name / property / key). */
export const Meta = (props: MetaProps): ServerValue => pushHead({ meta: [props] }, "<Meta>");
/** A head `<link>` (named apart from the router's navigation `Link`). */
export const HeadLink = (props: HeadLinkProps): ServerValue => pushHead({ links: [props] }, "<HeadLink>");
/** External (`src`, with a load strategy) or static inline script. */
export const Script = (props: ScriptProps): ServerValue => pushHead({ scripts: [props] }, "<Script>");
/** `<script type="application/ld+json">`: a data block (no nonce, never executed). */
export const JsonLd = <T extends object>(props: JsonLdProps<T>): ServerValue =>
  pushHead({ scripts: [props.id !== undefined ? { jsonLd: props.data, id: props.id } : { jsonLd: props.data }] }, "<JsonLd>");
/** Sets the stored theme on `<html>` before first paint (blocking inline script, nonce / hash). */
export const ThemeScript = (props: ThemeScriptProps): ServerValue => pushHead({ scripts: [themeScript(props)] }, "<ThemeScript>");

/** Client navigation applies the route head (DOM target); the server render already merged it. */
export const applyRouteHead = <T extends Pick<RoutePayload, "head">>(result: T, _pageLevel?: number): T => result;
/** Load a script once (DOM target); server: resolves immediately. */
export const loadScript = (_src: string, _options?: { type?: "module" | "classic" }): Promise<void> => Promise.resolve();
