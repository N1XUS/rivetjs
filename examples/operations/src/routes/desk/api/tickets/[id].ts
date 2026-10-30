import { onGet, onPatch, type RequestEvent } from "@rivetjs/router";
import { answer, userOf } from "../../../../server/http.server.ts";
import { ticketFor, updateTicket, Fault } from "../../../../server/service.server.ts";
export const GET = onGet((e: RequestEvent) =>
  answer(() => {
    const t = ticketFor(userOf(e), e.params.id);
    if (!t) throw new Fault(404, "Ticket not found");
    return t;
  }),
);
export const PATCH = onPatch((e: RequestEvent) => answer(async () => updateTicket(userOf(e), e.params.id, await e.request.json())));
