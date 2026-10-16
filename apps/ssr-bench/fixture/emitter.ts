// SSR benchmark fixture page: hand-written emitter used as the hand-optimized baseline lane.
const TEXT = /[&<>]/g;
const ATTRIBUTE = /[&<>"]/g;
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const fieldStart = Array.from({ length: 10 }, (_, i) => `<div><dt>Field ${i}</dt><dd>`);
const ROW_START = "<header><h2>Record</h2><p>Static description and supporting HTML.</p></header><section><dl>";
const ROW_END =
  '</dl></section><footer><button type="button" disabled>Increment</button><label>Selected<input type="checkbox" readonly></label></footer></article>';
export { PAGE_STYLE } from "./style.ts";
import { PAGE_STYLE } from "./style.ts";

/** Fixture row: identity plus exactly ten scalar field values. */
export interface Row {
  id: unknown;
  values: unknown[];
}
/** Fixture page as decoded from the content service. */
export interface Page {
  title?: unknown;
  token?: unknown;
  markdown?: string;
  rows: Row[];
}
/** Minimal writer contract: a write may return a promise when the sink applies backpressure. */
export interface ChunkWriter {
  write(chunk: string): unknown;
}
export interface EmitOptions {
  signal?: AbortSignal;
  rawArticleHtml?: string;
}

/** Escapes a scalar value for an ordinary HTML text position. */
export function escapeText(value: unknown): string {
  return String(value ?? "").replace(TEXT, (c) => ESCAPES[c]);
}
/** Escapes a scalar value for a double-quoted HTML attribute. */
export function escapeAttribute(value: unknown): string {
  return String(value ?? "").replace(ATTRIBUTE, (c) => ESCAPES[c]);
}

/** Emits the experimental static page output, suspending only when its writer applies backpressure. */
export function emitPage(
  page: Page,
  writer: ChunkWriter,
  { signal, rawArticleHtml = "" }: EmitOptions = {},
): PromiseLike<void> | void {
  let position = -1;
  function step(): PromiseLike<void> | void {
    while (position <= page.rows.length) {
      signal?.throwIfAborted();
      let chunk: string;
      if (position === -1) {
        const title = escapeText(page.title);
        chunk = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${PAGE_STYLE}</style></head><body><main data-token="${escapeAttribute(page.token)}"><h1>${title}</h1>${rawArticleHtml ? `<div data-article="">${rawArticleHtml}</div>` : ""}<section data-grid="">`;
      } else if (position === page.rows.length) {
        chunk = "</section></main><!--complete--></body></html>";
      } else {
        const row = page.rows[position];
        if (row.values.length !== 10) throw new Error("A row requires ten field values");
        chunk = `<article data-row="${escapeAttribute(row.id)}" data-state="even">${ROW_START}`;
        for (let i = 0; i < 10; i++) chunk += fieldStart[i] + escapeText(row.values[i]) + "</dd></div>";
        chunk += ROW_END;
      }
      position++;
      const pending = writer.write(chunk) as PromiseLike<unknown> | undefined;
      if (pending?.then) return pending.then(step);
    }
  }
  return step();
}
