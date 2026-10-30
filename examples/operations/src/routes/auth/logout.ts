import { onPost, redirect, type RequestEvent } from "@rivetjs/router";
import { logout } from "../../server/http.server.ts";
export const POST = onPost((e: RequestEvent) => {
  logout(e);
  throw redirect("/sign-in", 303);
});
