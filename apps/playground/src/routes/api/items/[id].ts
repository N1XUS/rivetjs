import { notFound, type RequestEvent, onGet } from "@rivetjs/router";
import { createServerServices } from "../../../services/server.js";

/** Public REST detail. */
export const GET = onGet(async ({ params, signal }: RequestEvent<{ id: string }>) => {
  const item = await createServerServices().detail(params.id, signal);
  if (!item) throw notFound();
  return Response.json(item, { headers: { "cache-control": "no-store" } });
});
