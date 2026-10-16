import { renderToStream } from "@builder.io/qwik/server";
import { NodeStreamWriter } from "../../../libs/runtime/node.ts";
import { Page } from "./qwik-stable-page.jsx";

/** Streams production Qwik 1 component output with its standard state/loader metadata intact. */
export async function renderPage(page, { signal, articleHtml }, sink) {
  signal?.throwIfAborted();
  const writer = new NodeStreamWriter(sink, { signal, threshold: 1 });
  let pending;
  // Qwik 1's StreamWriter is synchronous. Once the sink fills, queue later chunks behind the
  // outstanding write instead of accumulating ignored drain promises/listeners on the response.
  const stream = { write(chunk) {
    signal?.throwIfAborted();
    const waiting = pending ? pending.then(() => writer.write(chunk)) : writer.write(chunk);
    if (waiting) {
      pending = waiting;
      // Rendering can yield before we await the transport below; keep early failures handled.
      void pending.catch(() => {});
    }
  } };
  await renderToStream(<Page page={page} articleHtml={articleHtml} />, {
    stream,
    containerAttributes: { lang: "en" },
    streaming: { inOrder: { strategy: "auto", maximunInitialChunk: 16384, maximunChunk: 16384 } },
  });
  await pending;
  await writer.finish();
}
