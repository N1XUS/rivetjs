import type { RequestEvent } from "@rivetjs/router";
import { count } from "../../counts.server.ts";
export const load = (event: RequestEvent) => {
  event.depends("/api/items/b");
  return { n: count("b") };
};
