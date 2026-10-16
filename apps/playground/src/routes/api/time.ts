// Endpoint-only route from a plain `.ts` file with request handlers: GET /api/time.
import type { RequestEvent } from "@rivetjs/router";

export const onGet = ({ url }: RequestEvent) => Response.json({ now: new Date().toISOString(), zone: url.searchParams.get("zone") ?? "UTC" });
