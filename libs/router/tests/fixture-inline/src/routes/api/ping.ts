// Endpoint-only route: a plain `.ts` file exporting request handlers.
import type { RequestEvent } from "@rivetjs/router";
import { onGet, onPost } from "@rivetjs/router";

export const GET = onGet(({ url }: RequestEvent) => Response.json({ pong: url.searchParams.get("q") ?? "" }));
export const POST = onPost(async ({ request }: RequestEvent) => Response.json({ echo: await request.text() }));
