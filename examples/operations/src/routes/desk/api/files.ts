import { onPost, type RequestEvent } from "@rivetjs/router";
import { answer, userOf } from "../../../server/http.server.ts";
import { addFile, Fault } from "../../../server/service.server.ts";
export const POST = onPost((e: RequestEvent) =>
  answer(async () => {
    const form = await e.request.formData(),
      file = form.get("file");
    if (!(file instanceof File)) throw new Fault(400, "File required");
    return addFile(userOf(e), String(form.get("ticket") ?? ""), file.name, file.type, new Uint8Array(await file.arrayBuffer()));
  }),
);
