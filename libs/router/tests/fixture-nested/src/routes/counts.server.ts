import { counts } from "../counts.server.ts";
import { onGet } from "@rivetjs/router";
export const GET = onGet(() => new Response(JSON.stringify(counts), { headers: { "content-type": "application/json", "cache-control": "no-store" } }));
