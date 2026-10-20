import type { RequestEvent } from "@rivetjs/router";
import { count } from "../../../counts.server.ts";
import { load } from "@rivetjs/router";
export const loader = load(({ params }: RequestEvent<{ id: string }>) => {
  if (params.id === "404") throw new Error("boom");
  return { id: params.id, loads: count("u") };
});
