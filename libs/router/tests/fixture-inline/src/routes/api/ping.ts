// Endpoint-only route: a plain `.ts` file exporting request handlers.
import type { RequestEvent } from "@rivetjs/router";

export const onGet = ({ url }: RequestEvent) => Response.json({ pong: url.searchParams.get("q") ?? "" });
export const onPost = async ({ request }: RequestEvent) => Response.json({ echo: await request.text() });
