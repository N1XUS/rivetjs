import type { RequestEvent } from "@rivetjs/router";
import { onGet } from "@rivetjs/router";

// #region demo
// A plain `.ts` file with request handlers is an endpoint: GET /api/time.
export const GET = onGet(({ url }: RequestEvent) =>
  Response.json({ now: new Date().toISOString(), zone: url.searchParams.get("zone") ?? "UTC" }));
// #endregion
