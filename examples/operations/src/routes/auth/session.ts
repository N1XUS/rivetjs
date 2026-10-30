import { onGet, onPost, onDelete, type RequestEvent } from "@rivetjs/router";
import { answer, json, login, logout, userOf } from "../../server/http.server.ts";
export const GET = onGet((e: RequestEvent) => answer(() => userOf(e)));
export const POST = onPost((e: RequestEvent) =>
  answer(async () => {
    const body = (await e.request.json()) as { email: string; password: string };
    return json(await login(e, String(body.email ?? ""), String(body.password ?? "")));
  }),
);
export const DELETE = onDelete((e: RequestEvent) =>
  answer(() => {
    logout(e);
    return { ok: true };
  }),
);
