// Browser fixtures: server HTML of a Preact island rendered by the real server adapter (preact-render-to-string runs in the
// browser too), wrapped in the island root, and island chunks (component + real client adapter) with a load counter.
import { adapter as server } from "../../server.ts";
import { adapter as client } from "../../client.ts";
import type { ClientAdapter, IslandRender, SlotMark } from "@rivetjs/bridge/adapter";
import { env } from "./components.ts";

const mark = (name: string): SlotMark => ({
  name,
  html: "<rivet-slot" + (name === "default" ? "" : ` name="${name}"`) + ' style="display:contents"></rivet-slot>',
});

const serverRender = (id: string, component: unknown, props: Record<string, unknown>, slots: Record<string, string>) => {
  const marks = Object.fromEntries(Object.keys(slots).map((name) => [name, mark(name)]));
  env.server = true;
  try {
    return server.render(component as never, props, marks, { id, nonce: undefined, signal: new AbortController().signal, slot: mark }) as
      string | IslandRender | Promise<string | IslandRender>;
  } finally {
    env.server = false;
  }
};

/** `<rivet-island data-ri=id>` + the server render of `component(props)`; `slots`: slot name → inner HTML for its hole. */
export function islandHtml(id: string, component: unknown, props: Record<string, unknown>, slots: Record<string, string> = {}): string {
  const out = serverRender(id, component, props, slots);
  if (out instanceof Promise) throw new Error("islandHtml: the render suspended (use islandHtmlAsync)");
  return wrap(id, out, slots);
}
/** `islandHtml` for a render that may go through renderToStringAsync (Suspense). */
export async function islandHtmlAsync(id: string, component: unknown, props: Record<string, unknown>, slots: Record<string, string> = {}): Promise<string> {
  return wrap(id, await serverRender(id, component, props, slots), slots);
}

function wrap(id: string, out: string | IslandRender, slots: Record<string, string>): string {
  let html = typeof out === "string" ? out : out.html;
  for (const [name, inner] of Object.entries(slots)) html = html.replace(mark(name).html, mark(name).html.replace("></", ">" + inner + "</"));
  return `<rivet-island data-ri="${id}" style="display:contents">${html}</rivet-island>`;
}

/** An island chunk loader (component + the Preact client adapter), counting loads. */
export function chunk(component: unknown) {
  const loader = Object.assign(
    () => {
      loader.calls++;
      return Promise.resolve({ default: component, adapter: client as ClientAdapter });
    },
    { calls: 0 },
  );
  return loader;
}
