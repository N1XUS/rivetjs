import { onGet } from "@rivetjs/router";
import { privateToken } from "../../private.server";
export const PUBLIC_STEP = 7;
export const GET = onGet(({ request }) => {
  const privateHandler = "ENDPOINT_HANDLER_CANARY_931fd008";
  return Response.json(
    request.headers.has("x-audit-proof") ? { privateToken, privateHandler } : { ready: privateToken.length > 0 && privateHandler.length > 0 },
  );
});
