import { counts } from "../counts.server.ts";
export const onGet = () => new Response(JSON.stringify(counts), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
