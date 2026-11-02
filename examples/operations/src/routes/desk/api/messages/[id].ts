import { onGet, onPost, type RequestEvent } from "@rivetjs/router";
import { answer, objectBody, userOf } from "../../../../server/http.server.ts";
import { messagesFor, addMessage } from "../../../../server/service.server.ts";
export const GET = onGet((e: RequestEvent) => answer(() => messagesFor(userOf(e), e.params.id)));
export const POST = onPost((e: RequestEvent) =>
  answer(async () => {
    const body = await objectBody(e.request);
    return addMessage(userOf(e), e.params.id, body.body);
  }),
);
