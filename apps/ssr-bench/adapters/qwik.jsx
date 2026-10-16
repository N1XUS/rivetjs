import { renderToStream } from "@qwik.dev/core/server";
import { NodeStreamWriter } from "../../../libs/runtime/node.ts";
import { Page } from "./qwik-page.jsx";

/** Streams production Qwik 2 component output with its standard state/loader metadata intact. */
export async function renderPage(page, { signal, articleHtml }, sink) {
  const writer = new NodeStreamWriter(sink, { signal, threshold: 1 });
  const result = await renderToStream(<Page page={page} articleHtml={articleHtml} />, {
    stream: writer,
    containerAttributes: { lang: "en" },
    streaming: { inOrder: { strategy: "auto", maximumInitialChunk: 16384, maximumChunk: 16384 } },
  });
  await writer.finish();
  if (result.hasCaughtError) throw new Error("Qwik SSR caught an error");
}
