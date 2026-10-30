import { onGet } from "@rivetjs/router";
import { release } from "../../gate.server";
export const GET = onGet(({ url }) => {
  release(url.searchParams.get("key") ?? "");
  return new Response("released");
});
