import { renderToString } from "solid-js/web";
import { NodeStreamWriter } from "../../../libs/runtime/node.ts";
import { Page } from "./solid-stable.jsx";

/** Buffers the same production Solid 1 JSX with its public synchronous static SSR API. */
export async function renderPage(page, { signal, articleHtml }, sink) {
  signal?.throwIfAborted();
  const html = renderToString(() => <Page page={page} articleHtml={articleHtml} />);
  const writer = new NodeStreamWriter(sink, { signal, threshold: 1 });
  await writer.write(html);
  await writer.finish();
}
