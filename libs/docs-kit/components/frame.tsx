// Example frames: every live example is a page of the docs app at `/examples/<id>/frame/` (plus its other pages
// below it), rendered by the kit's two frame routes (`routes/examples/[id]/frame/index.tsx` and `[...path].tsx`)
// without the docs chrome (SiteFrame and the document shell skip frame paths, `frame-theme.ts`). The frame module of
// an example (`src/generated/example-frames/<id>.tsx`, tools/examples.ts) is loaded by the route's `load(…)` export, so
// the page renders it synchronously; its stylesheets (the example's own CSS only) come from `virtual:docs/frame-styles`
// and go into the head.
/// <reference types="vite/client" />
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { lazyComponent } from "@rivetjs/runtime/dom";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { notFound, type Head } from "@rivetjs/router";
import { frames } from "virtual:docs/example-frames";
import { frameStyles } from "virtual:docs/frame-styles";

// Tag key of `@rivetjs/router` server exports (`shared/server-exports.ts` SERVER_EXPORT).
const TAG = Symbol.for("rivet.server");

/** Props of a frame page: the route's page props, passed through to the example's page and layouts unchanged. */
// The example's own pages type their props (`PageProps<typeof loader>`); the frame does not know them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FrameProps = any;
/** An example's page or layout component, as the frame calls it. */
export type FrameComponent = (props: FrameProps) => JSX.Element;
/** One page of an example: its route module (head, its `load(…)` export) and the page inside its layouts. */
export interface FramePage {
  module: { head?: Head | ((input: never) => Head) } & Record<string, unknown>;
  Page: (props: FrameProps) => unknown;
  /** The page or a layout takes props (data, params, URL): the frame renders it under the `FrameRoot` boundary. */
  props: boolean;
}
/** A generated frame module. */
export interface FrameModule {
  pages: Record<string, FramePage>;
}

interface FrameParams {
  id: string;
  path?: string;
}

// Frame modules loaded on this server (the route's loader fills it before the page and head render).
const loaded = new Map<string, { module: FrameModule; styles: readonly string[] }>();
// ZERO Z7: one module + stylesheet lookup per example per server (production), not one per request.
const memo = new Map<string, Promise<{ module: FrameModule; styles: readonly string[] }>>();

/** Prerender entries: the `/` page of every live example (`sub` false) or their other pages (`sub` true). */
export function frameEntries(sub: boolean): FrameParams[] {
  return Object.entries(frames).flatMap(([id, frame]) => frame.paths.filter((path) => (path === "") !== sub).map((path) => (sub ? { id, path } : { id })));
}

/** Loader of the frame routes (`load(loadFrame)`): load the example's frame module and run the page's own loader (if any). */
export async function loadFrame(event: { params: FrameParams }): Promise<unknown> {
  const { id, path = "" } = event.params;
  const frame = frames[id];
  if (!frame || !frame.paths.includes(path)) throw notFound();
  let entry = memo.get(id);
  if (!entry) {
    entry = Promise.all([frame.load(), frameStyles(id)]).then(([module, styles]) => ({ module, styles }));
    // Production only (the dev server's frame modules and styles change under hot updates); a failed load retries.
    if (!import.meta.env.DEV)
      memo.set(
        id,
        entry.catch((cause) => (memo.delete(id), Promise.reject(cause))),
      );
  }
  const { module, styles } = await entry;
  loaded.set(id, { module, styles });
  // The page's own loader: its export tagged `load` (`@rivetjs/router` wrapper tag, any export name).
  const own = Object.values(module.pages[path]!.module).find((value) => typeof value === "function" && (value as { [TAG]?: unknown })[TAG] === "load");
  return own ? await (own as (event: unknown) => unknown)(event) : null;
}

/** `head` of the frame routes: the example page's own head, plus the example's stylesheets. */
export function frameHead(input: { params: FrameParams; data: unknown }): Head {
  const entry = loaded.get(input.params.id);
  const page = entry?.module.pages[input.params.path ?? ""];
  const own = page?.module.head;
  const head: Head = (typeof own === "function" ? (own as (input: unknown) => Head)(input) : own) ?? {};
  const styles = (entry?.styles ?? []).map((href) => ({ rel: "stylesheet", href }));
  return { ...head, title: head.title ?? "Example", links: [...styles, ...(head.links ?? [])] };
}

/** Server, after the route's loader: whether the frame page takes props (`FramePage.props`). */
export function frameTakesProps(params: FrameParams): boolean {
  return loaded.get(params.id)?.module.pages[params.path ?? ""]?.props ?? false;
}

// Browser fallback (the dev server client-renders a resumed page after a hot update): the frame module loads lazily.
const lazy = new Map<string, (props: FrameProps) => unknown>();
function lazyPage(id: string, path: string) {
  let page = lazy.get(id + "/" + path);
  if (!page) {
    const frame = frames[id];
    page = lazyComponent(
      (): Promise<FrameModule> => (frame ? frame.load() : Promise.reject(new Error(`docs-kit: no example frame ${id}`))),
      (module: FrameModule) => module.pages[path]!.Page as (props: FrameProps) => JSX.Element,
    ) as (props: FrameProps) => unknown;
    lazy.set(id + "/" + path, page);
  }
  return page;
}

// The example's page component of a frame (loaded on the server by the route's loader, in the browser by `FrameRoot.ready`;
// a dev client render loads it lazily).
const pageOf = (frames: typeof loaded, params: FrameParams) =>
  frames.get(params.id)?.module.pages[params.path ?? ""]?.Page ?? lazyPage(params.id, params.path ?? "");

/** The page of the frame routes: the example's page inside its layouts. */
export function FramePageView(props: FrameProps) {
  const Page = pageOf(loaded, props.params as FrameParams);
  return <Page {...props} />;
}

/**
 * A frame page's root without the router (`frame-page.tsx`) for pages that take no props: the page in an element. Not a
 * boundary itself: the example's own boundaries are the page's top-level ones (a static example ships no JS).
 */
export function FrameShell(props: FrameProps) {
  return (
    <div data-rivet-frame="">
      <FramePageView {...props} />
    </div>
  );
}

/** What a frame page's root carries (`FrameRoot`'s props, resume-format data): the loader result and the route params. */
export interface FramePayload {
  d: unknown;
  p: FrameParams;
}
/** A payload that is not JSON data (a loader's Date, Map, …) as its resume table (server `_rData`, `@rivetjs/runtime/server-derived`). */
interface EncodedFrame {
  t: unknown[];
  r: number;
  x?: string;
}
/** Server: the request's page props, provided around `FrameRoot` by `frame-page.tsx` (never shipped: the browser has its own URL). */
export const FrameServer = createContext<{ data: unknown; params: FrameParams; url: URL } | null>(null);
const payloadOf = (s: FramePayload | EncodedFrame): FramePayload => ("t" in s ? (createDecoder(s.t).get(s.r) as FramePayload) : s);

/**
 * A frame page's root for pages that take props (loader data, params, URL; layouts): the page's independent root boundary,
 * as the router's generated `Root` is for docs pages (`resume.roots`: `docsSite()` users list `FRAME_ROOT`). Its props are
 * the route payload as data (`_rData`); the browser's adopt run decodes it, takes the URL from `location`, and renders the
 * example's page over the server nodes (its dependent boundaries adopt with it). `ready` loads the frame module first.
 */
export default function FrameRoot(props: { s: FramePayload | EncodedFrame }) {
  let page: { data: unknown; params: FrameParams; url: URL };
  if (import.meta.env.SSR) page = useContext(FrameServer)!;
  else {
    const s = payloadOf(props.s);
    page = { data: s.d, params: s.p, url: new URL(globalThis.location.href) };
  }
  // The page renders in a read site over module state (`loaded`: the frame modules this document loaded), which makes
  // `FrameRoot` a boundary of its own (the compiler cannot see the example's boundaries through the dynamic tag);
  // `untrack`: the page component's own reads stay its own.
  return <div data-rivet-frame="">{untrack(() => pageOf(loaded, page.params)(page) as JSX.Element)}</div>;
}
/** Before the adopt run: the example's frame module (the page renders synchronously), and the table's built-in decoders. */
FrameRoot.ready = (props: { s?: FramePayload | EncodedFrame }): Promise<unknown> | undefined => {
  const s = props.s;
  if (!s) return undefined;
  const src = "t" in s ? s.x : undefined;
  const id = payloadOf(s).p.id;
  const frame = frames[id];
  const page = loaded.has(id) || !frame ? undefined : frame.load().then((module) => void loaded.set(id, { module, styles: [] }));
  const builtins = src
    ? new Promise((onload) =>
        globalThis.document.head.append(Object.assign(globalThis.document.createElement("script"), { type: "module", src, onload, onerror: onload })),
      )
    : undefined;
  return page && builtins ? Promise.all([page, builtins]) : (page ?? builtins);
};
