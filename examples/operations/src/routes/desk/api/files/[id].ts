import { onGet, type RequestEvent } from "@rivetjs/router";
import { answer, userOf } from "../../../../server/http.server.ts";
import { fileFor, Fault } from "../../../../server/service.server.ts";
export const GET = onGet((e: RequestEvent) =>
  answer(() => {
    const file = fileFor(userOf(e), e.params.id);
    if (!file) throw new Fault(404, "File not found");
    return new Response(file.data as BodyInit, {
      headers: {
        "content-type": file.type,
        "content-disposition": `attachment; filename="${file.name}"`,
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-store",
      },
    });
  }),
);
