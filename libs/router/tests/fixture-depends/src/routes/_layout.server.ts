import type { RequestEvent } from "@rivetjs/router";
import { count } from "../counts.server.ts";
export const load = (event: RequestEvent) => {
  event.depends("session");
  return { loads: count("root") };
};
