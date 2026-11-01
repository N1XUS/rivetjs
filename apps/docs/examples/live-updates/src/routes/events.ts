import type { RequestEvent } from "@rivetjs/router";
import { eventStream } from "@rivetjs/router/sse";
import { currentVisitors } from "../visitors.server.ts";
import { onGet } from "@rivetjs/router";

// #region demo
/** `GET /events`: a plain `.ts` route with a handler is an endpoint (no page). It streams Server-Sent Events. */
export const GET = onGet((event: RequestEvent) =>
  eventStream(event, (send) => {
    send({ visitors: currentVisitors() });
    const timer = setInterval(() => send({ visitors: currentVisitors() }), 2000);
    // Runs once when the browser closes the page or the connection: stop sending.
    return () => clearInterval(timer);
  }),
);
// #endregion
