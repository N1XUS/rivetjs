import { onGet } from "@rivetjs/router";
import { backend } from "../../server/backend.server.ts";
export const GET = onGet(() => Response.json(backend.stats));
