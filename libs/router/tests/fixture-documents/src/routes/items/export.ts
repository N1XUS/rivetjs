// Endpoint the server matches before `items/[id]` (static before param): a document load, not a page.
import { onGet } from "@rivetjs/router";
export const GET = onGet(() => new Response("export", { headers: { "content-type": "text/plain" } }));
