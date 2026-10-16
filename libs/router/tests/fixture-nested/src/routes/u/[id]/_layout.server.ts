import type { RequestEvent } from "@rivetjs/router";
import { count } from "../../../counts.server.ts";
export const load = ({ params }: RequestEvent<{ id: string }>) => {
  if (params.id === "404") throw new Error("boom");
  return { id: params.id, loads: count("u") };
};
