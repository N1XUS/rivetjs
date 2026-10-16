// Direct page bodies: a host adapter (node) takes a rendered page's bytes straight from the renderer's
// slabs instead of reading the web `ReadableStream` (no queue, read promises or per-chunk races).

/** Where a directly attached page body goes. Web-standard: no Node types. */
export interface BodySink {
  /**
   * One chunk: a view into a pooled slab. Call `done` once its bytes are no longer needed (written out,
   * copied, or dropped) — the slab is reused after every handed-off view of it is done. Returns a wait
   * when the sink applies backpressure; throws once the sink is closed (the render then ends).
   */
  write(chunk: Uint8Array, done: () => void): Promise<void> | undefined;
  /** The body is complete. */
  end(): void;
  /** The render failed after the Response was handed out. */
  error(error: unknown): void;
}

/**
 * Own property of `renderPage` / `renderDocument` Responses: `(sink) => boolean`. True: every body byte
 * (already rendered and later) goes to `sink` and the Response's `body` stream stays unread forever;
 * false: the stream was already read (a copied Response, a consumer that started) — read the body.
 */
export const DIRECT_BODY: unique symbol = Symbol.for("rivet.body") as never;

export type DirectBody = (sink: BodySink) => boolean;
