import { onGet, type RequestEvent } from "@rivetjs/router";
import { backend } from "../../server/backend.server.ts";
export const GET = onGet(({ url, signal }: RequestEvent) => {
  const limit = Math.max(1, Math.min(10000, Number(url.searchParams.get("limit") ?? "8"))),
    ms = Math.max(5, Number(url.searchParams.get("ms") ?? "25"));
  let timer: ReturnType<typeof setInterval>,
    closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    backend.stats.sseActive--;
    backend.stats.sseClosed++;
    signal.removeEventListener("abort", abort);
  };
  let abort: () => void = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      backend.stats.sseActive++;
      backend.stats.sseStarted++;
      let id = 0;
      abort = () => {
        close();
        try {
          c.close();
        } catch {}
      };
      signal.addEventListener("abort", abort, { once: true });
      timer = setInterval(() => {
        if (closed) return;
        c.enqueue(new TextEncoder().encode(`id: ${++id}\ndata: ${JSON.stringify({ id })}\n\n`));
        if (id >= limit) {
          close();
          c.close();
        }
      }, ms);
    },
    cancel() {
      close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
});
