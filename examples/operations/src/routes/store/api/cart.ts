import { onGet, onPut, type RequestEvent } from "@rivetjs/router";
import { answer, userOf } from "../../../server/http.server.ts";
import { cartFor, setCart } from "../../../server/service.server.ts";
export const GET = onGet((e: RequestEvent) => answer(() => cartFor(userOf(e))));
export const PUT = onPut((e: RequestEvent) => answer(async () => setCart(userOf(e), await e.request.json())));
