import { onGet, type RequestEvent } from "@rivetjs/router";
import { answer, userOf, COOKIE } from "../../../server/http.server.ts";
import { eventsFor, sessionUser } from "../../../server/service.server.ts";
export const GET = onGet((e: RequestEvent) =>
  answer(() => {
    userOf(e);
    const token = e.cookies.get(COOKIE);
    let cursor = Math.max(0, Number(e.request.headers.get("last-event-id") ?? e.url.searchParams.get("after") ?? "0") || 0);
    let timer: ReturnType<typeof setInterval>,
      closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      e.signal.removeEventListener("abort", abort);
    };
    let abort = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        const encoder = new TextEncoder();
        c.enqueue(encoder.encode(": connected\n\n"));
        abort = () => {
          close();
          try {
            c.close();
          } catch {}
        };
        e.signal.addEventListener("abort", abort, { once: true });
        timer = setInterval(() => {
          const user = sessionUser(token);
          if (!user) return abort();
          for (const event of eventsFor(user, cursor)) {
            cursor = event.id;
            c.enqueue(encoder.encode(`id: ${event.id}\ndata: ${event.body}\n\n`));
          }
        }, 40);
      },
      cancel() {
        close();
      },
    });
    return new Response(body, { headers: { "content-type": "text/event-stream", "cache-control": "private, no-store", vary: "Cookie" } });
  }),
);
