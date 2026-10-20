// Example frames: every live example is a page of the docs app at `/examples/<id>/frame/` (plus its other pages
// below it), rendered by the kit's two frame routes (`routes/examples/[id]/frame/index.tsx` and `[...path].tsx`)
// without the docs chrome (SiteFrame and the document shell skip frame paths, `frame-theme.ts`). The frame module of
// an example (`src/generated/example-frames/<id>.tsx`, tools/examples.ts) is loaded by the route's `load(…)` export, so
// the page renders it synchronously; its stylesheets (the example's own CSS only) come from `virtual:docs/frame-styles`
// and go into the head.
import { lazyComponent } from "@rivetjs/runtime/dom";
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

/** Prerender entries: the `/` page of every live example (`sub` false) or their other pages (`sub` true). */
export function frameEntries(sub: boolean): FrameParams[] {
  return Object.entries(frames).flatMap(([id, frame]) => frame.paths.filter((path) => (path === "") !== sub).map((path) => (sub ? { id, path } : { id })));
}

/** Loader of the frame routes (`load(loadFrame)`): load the example's frame module and run the page's own loader (if any). */
export async function loadFrame(event: { params: FrameParams }): Promise<unknown> {
  const { id, path = "" } = event.params;
  const frame = frames[id];
  if (!frame || !frame.paths.includes(path)) throw notFound();
  const module = await frame.load();
  loaded.set(id, { module, styles: await frameStyles(id) });
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

/** The page of the frame routes: the example's page inside its layouts. */
export function FramePageView(props: FrameProps) {
  const { id, path = "" } = props.params as FrameParams;
  const Page = loaded.get(id)?.module.pages[path]?.Page ?? lazyPage(id, path);
  return <Page {...props} />;
}

/**
 * A frame page's root without the router (`frame-page.tsx`): the page in an element, so the compiler makes it a
 * resumable region (as the router's `<div data-rivet-routes>` does for docs pages).
 */
export function FrameRoot(props: FrameProps) {
  return (
    <div data-rivet-frame="">
      <FramePageView {...props} />
    </div>
  );
}
