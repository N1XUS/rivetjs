// Dev server, browser: the client-render fallback of an example frame page (the router's `.rivet/dev-mount.tsx` for
// docs pages). `docsFrames()` (vite.ts) points the router's `.rivet/entry.dev.tsx` here on frame URLs, so a frame's
// browser module graph is the example's own (frame.tsx → the generated frame module → the example's files): no docs
// layout, nav or route table, whose regeneration by content edits must not re-render (and reset) open frames.
/// <reference types="vite/client" />
import { mount } from "@rivetjs/runtime/dom";
import { dataURL, decodeData } from "@rivetjs/router/client";
import { frames } from "virtual:docs/example-frames";
import { frameIdOf } from "../frame-theme.ts";
import { FrameShell } from "./frame.tsx";

let dispose = () => {};

const paramsOf = (url: URL): { id: string; path?: string } => {
  const id = frameIdOf(url.pathname)!;
  const rest = url.pathname.replace(/^\/examples\/[^/]+\/frame\/?/, "").replace(/\/$/, "");
  return rest ? { id, path: decodeURIComponent(rest) } : { id };
};

/** Client-render the frame page into `into` (the page's `[data-rivet-dev]` container), replacing its content. */
export async function start(into: Element): Promise<void> {
  const url = new URL(location.href);
  const body = (await decodeData(await (await fetch(dataURL(url), { headers: { accept: "application/json" } })).text())) as {
    data?: unknown[];
    redirect?: string;
  };
  if (body.redirect !== undefined) return location.assign(body.redirect);
  const params = paramsOf(url);
  // The page module first: the lazy page then renders synchronously.
  await frames[params.id]?.load();
  dispose();
  into.textContent = "";
  const data = body.data?.[body.data.length - 1];
  dispose = mount(() => <FrameShell data={data} params={params} url={url} />, into);
  // Stylesheets linked by the server (no flash) give way to Vite's injected <style>s.
  for (const link of document.querySelectorAll('link[rel="stylesheet"][href$="direct"]')) link.remove();
}

/** Load the frame's modules without rendering (the resumed page then gets their hot updates). */
export const preload = (): Promise<unknown> | undefined => frames[paramsOf(new URL(location.href)).id]?.load();
