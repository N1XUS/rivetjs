import { renderToString } from "solid-js/web";
import { NodeStreamWriter } from "../../../libs/runtime/node.ts";
import { Page } from "./solid-stable.jsx";

/** The same Solid 1 page compiled `hydratable: false` (build.ts): static markup, no hydration keys/script —
 * the like-for-like peer of rivet-compiled and Razor. Buffered by Solid's public static API. */
export async function renderPage(page, { signal, articleHtml }, sink) {
  signal?.throwIfAborted();
  const html = renderToString(() => <Page page={page} articleHtml={articleHtml} />);
  const writer = new NodeStreamWriter(sink, { signal, threshold: 1 });
  await writer.write(html);
  await writer.finish();
}
