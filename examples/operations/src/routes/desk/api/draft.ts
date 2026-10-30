import { onGet, onPut, type RequestEvent } from "@rivetjs/router";
import { answer, userOf } from "../../../server/http.server.ts";
import { draftFor, saveDraft } from "../../../server/service.server.ts";
export const GET = onGet((e: RequestEvent) => answer(() => draftFor(userOf(e))));
export const PUT = onPut((e: RequestEvent) => answer(async () => saveDraft(userOf(e), await e.request.json())));
