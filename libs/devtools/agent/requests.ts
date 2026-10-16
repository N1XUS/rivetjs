// Request dispatch: runs the handler of a panel request and posts its response (same `r`), or an
// `error.request` response when the handler throws / rejects or the type is unknown (the panel would
// otherwise wait for it until its request timeout).
import type { Requests } from "../protocol.ts";

export type Handlers = { [K in keyof Requests]: (d: Requests[K][0]) => Requests[K][1] | Promise<Requests[K][1]> };
export interface Request {
  t: string;
  d: unknown;
  r?: number;
}

/** Answer one request; `respond(t, d, r)` posts the response, `failed` reports handler errors. Resolves once posted. */
export function dispatch(
  handlers: Handlers,
  message: Request,
  respond: (t: string, d: unknown, r?: number) => void,
  failed: (error: unknown) => void,
): Promise<void> {
  const handler = handlers[message.t as keyof Requests] as ((d: unknown) => unknown) | undefined;
  if (!handler) {
    respond("error.request", { message: "unknown request " + message.t }, message.r);
    return Promise.resolve();
  }
  return Promise.resolve()
    .then(() => handler(message.d))
    .then(
      (result) => respond(message.t, result, message.r),
      (error) => {
        failed(error);
        respond("error.request", { message: String((error as Error)?.message ?? error) }, message.r);
      },
    );
}
