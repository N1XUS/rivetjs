import type { Writable } from "node:stream";
import { emitPage, type Page } from "../fixture/emitter.ts";
import { StringWriter, NodeStreamWriter } from "@rivetjs/runtime/node";

export interface RenderOptions {
  signal?: AbortSignal;
  articleHtml?: string;
  variant?: string;
}

/** Renders the experimental emitter's static output using the selected buffer strategy. */
export async function renderPage(
  page: Page,
  { signal, articleHtml, variant = process.env.RIVET_VARIANT ?? "stream" }: RenderOptions,
  sink: Writable,
): Promise<void> {
  const writer = variant === "string" ? new StringWriter() : new NodeStreamWriter(sink, { signal });
  await emitPage(page, writer, { signal, rawArticleHtml: articleHtml });
  const pending = writer.finish();
  if (typeof pending === "string") {
    const stream = new NodeStreamWriter(sink, { signal, threshold: 1 });
    await stream.write(pending);
  } else await pending;
}
