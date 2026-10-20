import type { RequestEvent } from "@rivetjs/router";
import { count } from "../../counts.server.ts";
import { load } from "@rivetjs/router";
export const loader = load((event: RequestEvent) => {
  event.depends("cart");
  return { loads: count("shop") };
});
