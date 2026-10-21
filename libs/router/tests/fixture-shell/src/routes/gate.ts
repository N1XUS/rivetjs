// Test endpoint: GET /gate?open=<name> releases the deferred loaders waiting on <name>; GET /gate → run counts.
import { onGet } from "@rivetjs/router";
import { open, runs } from "../gate.server.ts";

export const GET = onGet(({ url }) => {
  const name = url.searchParams.get("open");
  if (name) open(name);
  return Response.json(runs);
});
