import { onGet } from "@rivetjs/router";
export const GET = onGet(() => new Response("pong"));
