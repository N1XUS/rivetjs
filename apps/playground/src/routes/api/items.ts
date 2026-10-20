import type { RequestEvent } from "@rivetjs/router";
import { createServerServices } from "../../services/server.js";
import { onGet } from "@rivetjs/router";

/** Public REST list. */
export const GET = onGet(async ({ signal }: RequestEvent) =>
  Response.json(await createServerServices().list(signal), { headers: { "cache-control": "no-store" } }),
);
