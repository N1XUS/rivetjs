// Endpoint-only route: no page, so links to it load documents.
import { onGet } from "@rivetjs/router";
export const GET = onGet(() => new Response("pong", { headers: { "content-type": "text/plain" } }));
