import type { RequestEvent } from "@rivetjs/router";
import { createServerServices } from "../../services/server.js";

/** Public REST list. */
export const onGet = async ({ signal }: RequestEvent) => Response.json(await createServerServices().list(signal), { headers: { "cache-control": "no-store" } });
