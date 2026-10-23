// Server: the body of an example frame page without the docs app's client router. `docsFrames()` (vite.ts) wraps the
// generated `.rivet/entry.server.tsx` so a frame URL renders this instead of `<App>`: no router listeners, layouts or
// route table in the resume state, so the browser loads only the example's own code (as the example's own app would,
// minus its router: links between an example's pages load documents). The route still runs through the router on the
// server (matching, loaders, `head`, errors); a failed render falls back to the router's page (error views).
import type { PageInput } from "@rivetjs/router/server";
import { Provider } from "@rivetjs/runtime/server";
import { _rData } from "@rivetjs/runtime/server-derived";
import { frameIdOf } from "../frame-theme.ts";
import FrameRoot, { FrameServer, FrameShell, frameTakesProps } from "./frame.tsx";

/** The page factory of a frame URL, or undefined (any other page, or an error render). */
export function framePageOf(input: PageInput): (() => unknown) | undefined {
  const id = frameIdOf(input.url.pathname);
  if (!id || input.error) return undefined;
  const rest = input.url.pathname.replace(/^\/examples\/[^/]+\/frame\/?/, "").replace(/\/$/, "");
  const params = rest ? { id, path: decodeURIComponent(rest) } : { id };
  const data = input.data[input.data.length - 1];
  // No router contexts (ServerData, SearchParams): their resumed values need the router's resume entry; the example
  // gets its data, params and URL as props, `useSearchParams()` falls back to the browser's.
  // A page that takes no props renders in a plain element (its own boundaries are the page's top-level ones); one that
  // does renders under `FrameRoot`, the page's independent root boundary carrying the payload as data (as the router's
  // generated `Root`): the browser's adopt run has the loader's data (a Date, Map, … through the resume table).
  if (!frameTakesProps(params)) return () => <FrameShell data={data} params={params} url={input.url} />;
  return () => (
    <Provider token={FrameServer} value={{ data, params, url: input.url }}>
      <FrameRoot s={_rData({ d: data, p: params })} />
    </Provider>
  );
}
