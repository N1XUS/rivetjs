import { onGet, type RequestEvent } from "@rivetjs/router";
import { answer, userOf } from "../../../../server/http.server.ts";
import { orderFor, Fault } from "../../../../server/service.server.ts";
export const GET = onGet((e: RequestEvent) =>
  answer(() => {
    const order = orderFor(userOf(e), e.params.id);
    if (!order) throw new Fault(404, "Order not found");
    return order;
  }),
);
