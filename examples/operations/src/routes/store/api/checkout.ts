import { onPost, type RequestEvent } from "@rivetjs/router";
import { answer, userOf } from "../../../server/http.server.ts";
import { checkout } from "../../../server/service.server.ts";
export const POST = onPost((e: RequestEvent) => answer(async () => checkout(userOf(e), await e.request.json())));
