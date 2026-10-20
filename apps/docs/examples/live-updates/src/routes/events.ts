import type { RequestEvent } from "@rivetjs/router";
import { currentVisitors } from "../visitors.server.ts";
import { onGet } from "@rivetjs/router";

// #region demo
/** `GET /events`: a plain `.ts` route with a handler is an endpoint (no page). It streams Server-Sent Events. */
export const GET = onGet(({ signal }: RequestEvent) => {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = () => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ visitors: currentVisitors() })}\n\n`));
      send();
      timer = setInterval(send, 2000);
      // The browser closed the page or the connection: stop sending.
      signal.addEventListener("abort", () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* Already closed. */
        }
      });
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(body, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
});
// #endregion
